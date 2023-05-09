import { useAtomValue } from 'jotai/utils';
import { hexToBytes, intToBigInt } from 'micro-stacks/common';
import { hashSha256 } from 'micro-stacks/crypto-sha';
import { fetchTxData } from '../../api';
import { publicKeyState } from '../../store';
import type { InboundSwapSent } from '../../store/swaps';
import { useTx } from '../use-tx';
import { encodeExpiration } from 'magic-protocol';
import { currentStxAddressState } from '../../store';

export const useEscrowSwap = (swap: InboundSwapSent) => {
  const { btcTxid, secret, supplier, address, feeRate, baseFee } = swap;
  const publicKey = useAtomValue(publicKeyState);
  const stxAddress = useAtomValue(currentStxAddressState);
  return useTx(async (contracts, submit) => {
    // if (!supplier) throw new Error('Invalid supplier');
    if (!publicKey) throw new Error('Not logged in');
    const txData = await fetchTxData(btcTxid, address);
    const hash = hashSha256(hexToBytes(secret));
    const expiration = encodeExpiration(BigInt(swap.expiration));
    const escrowTx = contracts.magic.escrowSwap({
      block: txData.block,
      prevBlocks: txData.prevBlocks,
      tx: txData.txHex,
      proof: txData.proof,
      outputIndex: txData.outputIndex,
      sender: hexToBytes(publicKey),
      recipient: hexToBytes(supplier.publicKey),
      expirationBuff: expiration,
      hash: hash,
      swapper: stxAddress!,
      supplierId: supplier.id,
      maxFeeRate: intToBigInt(feeRate),
      maxBaseFee: intToBigInt(baseFee),
    });
    return submit(escrowTx);
  });
};
