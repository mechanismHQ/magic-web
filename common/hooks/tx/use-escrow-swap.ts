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
  const { btcTxid, secret, supplier, address } = swap;
  const publicKey = useAtomValue(publicKeyState);
  const stxAddress = useAtomValue(currentStxAddressState);
  return useTx(async (contracts, submit) => {
    // if (!supplier) throw new Error('Invalid supplier');
    if (!publicKey) throw new Error('Not logged in');
    const txData = await fetchTxData(btcTxid, address);
    const hash = hashSha256(hexToBytes(secret));
    const amount = txData.amount;
    const amountWithFeeRate = (amount * (10000n - intToBigInt(supplier.inboundFee))) / 10000n;
    const minToReceive = amountWithFeeRate - BigInt(supplier.inboundBaseFee);
    const expiration = encodeExpiration(BigInt(swap.expiration));
    const escrowTx = contracts.magic.escrowSwap(
      txData.block,
      txData.prevBlocks,
      txData.txHex,
      txData.proof,
      txData.outputIndex,
      hexToBytes(publicKey),
      hexToBytes(supplier.publicKey),
      expiration,
      hash,
      stxAddress!,
      supplier.id,
      minToReceive
    );
    return submit(escrowTx);
  });
};
