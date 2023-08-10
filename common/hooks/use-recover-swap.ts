import { useCallback, useState } from 'react';
import { ECPair, payments, Psbt, script as bScript } from 'bitcoinjs-lib';
import { hexToBytes } from 'micro-stacks/common';
import { hashSha256 } from 'micro-stacks/crypto-sha';
import { broadcastBtc } from '../api';
import { useAtomCallback, useAtomValue } from 'jotai/utils';
import { stacksSessionAtom } from '@micro-stacks/react';
import { btcNetwork } from '../constants';
import { btcAddressState, fetchInboundSwap, publicKeyState } from '../store';
import { useInboundSwap } from './use-inbound-swap';
import { useBtcTx } from '../store/api';
import { createHtlcScript, encodeHtlcOutput } from 'magic-protocol';
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

/**
 *
 * @deprecated
 */
export function useRecoverSwapOld() {
  const { swap, updateSwap } = useInboundSwap();
  if (!('escrowTxid' in swap)) throw new Error('Invalid swap state');
  const [btcTx] = useBtcTx(swap.btcTxid, swap.address);

  const btcAddress = useAtomValue(btcAddressState);
  const session = useAtomValue(stacksSessionAtom);
  const publicKey = useAtomValue(publicKeyState);
  const [txid, setTxid] = useState('');
  const privateKey = session?.appPrivateKey;
  const submit = useCallback(async () => {
    if (!privateKey || !publicKey) {
      throw new Error('Fatal: not signed in.');
    }
    const signer = ECPair.fromPrivateKey(Buffer.from(privateKey, 'hex'), { network: btcNetwork });
    const hash = hashSha256(hexToBytes(swap.secret));
    const inbound = await fetchInboundSwap(swap.btcTxid);
    if (!inbound) {
      throw new Error('Invalid inbound amount');
    }
    const htlc = createHtlcScript({
      expiration: BigInt(swap.expiration),
      senderPublicKey: hexToBytes(publicKey),
      recipientPublicKey: hexToBytes(swap.supplier.publicKey),
      hash,
      metadata: hexToBytes(swap.metadata),
    });

    const psbt = new Psbt({ network: btcNetwork });
    const weight = 312;
    const feeRate = 3;
    const fee = weight * feeRate;

    const htlcAmount = Number(btcTx.amount);

    psbt.addInput({
      hash: swap.btcTxid,
      index: btcTx.outputIndex,
      nonWitnessUtxo: Buffer.from(btcTx.txHex),
      redeemScript: Buffer.from(htlc),
      sequence: swap.expiration,
    });

    psbt.addOutput({
      address: btcAddress,
      value: htlcAmount - fee,
    });
    await psbt.signInputAsync(0, signer);

    psbt.finalizeInput(0, (index, input, script) => {
      const partialSigs = input.partialSig;
      if (!partialSigs) throw new Error('Error when finalizing HTLC input');
      const inputScript = bScript.compile([
        partialSigs[0].signature,
        Buffer.from('00', 'hex'), // OP_FALSE
      ]);
      const payment = payments.p2sh({
        redeem: {
          output: script,
          input: inputScript,
        },
      });
      return {
        finalScriptSig: payment.input,
        finalScriptWitness: undefined,
      };
    });
    const finalTx = psbt.extractTransaction();
    const broadcastId = await broadcastBtc(finalTx.toHex());
    setTxid(broadcastId);
    void updateSwap({
      ...swap,
      recoveryTxid: broadcastId,
    });
  }, [swap, btcTx, privateKey, btcAddress, publicKey, updateSwap]);

  return {
    submit,
    txid,
  };
}
