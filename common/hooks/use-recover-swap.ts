import { useCallback, useState } from 'react';
import { ECPair, payments, Psbt, script as bScript } from 'bitcoinjs-lib';
import { hexToBytes } from 'micro-stacks/common';
import { hashSha256 } from 'micro-stacks/crypto-sha';
import { broadcastBtc } from '../api';
import { useAtomValue } from 'jotai/utils';
import { stacksSessionAtom } from '@micro-stacks/react';
import { btcNetwork } from '../constants';
import {
  btcAddressState,
  currentStxAddressState,
  fetchInboundSwap,
  publicKeyState,
} from '../store';
import { useInboundSwap } from './use-inbound-swap';
import { useBtcTx } from '../store/api';
import { createHtlcScript, generateMetadataHash } from 'magic-protocol';

export function useRecoverSwap() {
  const { swap, updateSwap } = useInboundSwap();
  if (!('escrowTxid' in swap)) throw new Error('Invalid swap state');
  const [btcTx] = useBtcTx(swap.btcTxid, swap.address);

  const btcAddress = useAtomValue(btcAddressState);
  const stxAddress = useAtomValue(currentStxAddressState);
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
    // TODO: get the correct metadata hash
    const metadata = generateMetadataHash({
      swapperAddress: stxAddress!,
      minAmount: inbound.xbtc,
    });
    const htlc = createHtlcScript({
      expiration: BigInt(swap.expiration),
      senderPublicKey: hexToBytes(publicKey),
      recipientPublicKey: hexToBytes(swap.supplier.publicKey),
      hash,
      metadata,
      // swapper: swap.swapperId,
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
  }, [swap, btcTx, privateKey, btcAddress, publicKey, updateSwap, stxAddress]);

  return {
    submit,
    txid,
  };
}
