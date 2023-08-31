import { useCallback, useState } from 'react';
import { hexToBytes } from 'micro-stacks/common';
import { broadcastBtc } from '../api';
import { useAtomCallback, useAtomValue } from 'jotai/utils';
import { stacksSessionAtom } from '@micro-stacks/react';
import { btcAddressState } from '../store';
import { useInboundSwap } from './use-inbound-swap';
import { encodeHtlcOutput } from 'magic-protocol';
import { getSwapRedeemScript } from '../store/swaps';
import { Transaction } from '@scure/btc-signer';
import { atom } from 'jotai';
import { btcNetwork } from '../constants';
import { btcTxState } from '../store/api';

const recoverTxidAtom = atom('');

export function useRecoverSwap() {
  const { swap: storageSwap, updateSwap } = useInboundSwap();
  if (!('btcTxid' in storageSwap)) throw new Error('Invalid swap state');
  const txid = useAtomValue(recoverTxidAtom);
  const [broadcastErr, setBroadcastErr] = useState('');

  const submit = useAtomCallback(
    useCallback(
      async (get, set) => {
        const { btcTxid } = storageSwap;
        setBroadcastErr('');
        const redeemScript = getSwapRedeemScript(storageSwap);
        const witnessScript = redeemScript;
        const btcAddress = get(btcAddressState);
        const htlcOutput = encodeHtlcOutput(witnessScript);
        const btcTx = get(btcTxState([storageSwap.btcTxid, storageSwap.address]));
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
          txid: btcTxid,
          index: Number(btcTx.outputIndex),
          witnessUtxo: {
            script: htlcOutput,
            amount: btcTx.amount,
          },
          sequence: storageSwap.expiration,
          witnessScript,
        });

        tx.addOutputAddress(recipient, btcTx.amount - fee, btcNetwork);

        tx.sign(hexToBytes(privateKey));

        const input = tx.getInput(0)!;
        const partial = input.partialSig!;
        input.finalScriptWitness = [partial[0][1], new Uint8Array([]), witnessScript];
        tx.updateInput(0, input);
        // console.log(`btcdeb --tx=${tx.hex} --txin=${bytesToHex(btcTx.txHex)}`);

        try {
          const broadcastId = await broadcastBtc(tx.hex);
          set(recoverTxidAtom, broadcastId);
          void updateSwap({
            ...storageSwap,
            recoveryTxid: broadcastId,
          });
        } catch (error) {
          console.error(error);
          let msg = 'Error broadcasting transaction';
          if (error instanceof Error) {
            msg = error.message;
          }
          setBroadcastErr(msg);
        }
      },
      [storageSwap, updateSwap]
    )
  );

  return {
    submit,
    txid,
    broadcastErr,
  };
}
