import { useCallback } from 'react';
import { hexToBytes } from 'micro-stacks/common';
import { broadcastBtc } from '../api';
import { useAtomCallback, useAtomValue } from 'jotai/utils';
import { stacksSessionAtom } from '@micro-stacks/react';
import { btcAddressState } from '../store';
import { useInboundSwap } from './use-inbound-swap';
import { encodeHtlcOutput } from 'magic-protocol';
import { fullInboundState } from '../store/swaps';
import { Transaction } from '@scure/btc-signer';
import { atom } from 'jotai';

const recoverTxidAtom = atom('');

export function useRecoverSwap() {
  const { swap: storageSwap, updateSwap } = useInboundSwap();
  if (!('escrowTxid' in storageSwap)) throw new Error('Invalid swap state');
  const txid = useAtomValue(recoverTxidAtom);

  const submit = useAtomCallback(
    useCallback(
      async (get, set) => {
        const swap = get(fullInboundState(storageSwap.btcTxid));
        if (swap === null) {
          console.debug(`Swap with txid ${storageSwap.btcTxid} not found`);
          return;
        }
        const witnessScript = swap.redeemScript;
        const btcAddress = get(btcAddressState);
        const htlcOutput = encodeHtlcOutput(witnessScript);
        const feeRate = 10;
        const recipient = btcAddress;
        const weight = 350;
        const fee = BigInt(weight * feeRate);
        const session = get(stacksSessionAtom);
        const privateKey = session?.appPrivateKey;
        if (typeof privateKey !== 'string') {
          throw new Error('Cant recover: not signed in.');
        }

        const tx = new Transaction({ allowUnknowInput: true });

        tx.addInput({
          txid: swap.hash,
          index: Number(swap.outputIndex),
          witnessUtxo: {
            script: htlcOutput,
            amount: swap.sats,
          },
          witnessScript,
        });

        tx.addOutput({
          script: recipient,
          amount: swap.sats - fee,
        });

        tx.sign(hexToBytes(privateKey));

        const input = tx.getInput(0)!;
        const partial = input.partialSig!;
        input.finalScriptWitness = [partial[0][1], new Uint8Array([0]), witnessScript];
        tx.updateInput(0, input);

        tx.finalize();
        const broadcastId = await broadcastBtc(tx.hex);
        set(recoverTxidAtom, broadcastId);
        void updateSwap({
          ...storageSwap,
          recoveryTxid: broadcastId,
        });
      },
      [storageSwap, updateSwap]
    )
  );

  return {
    submit,
    txid,
  };
}
