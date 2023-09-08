import { useRouter } from 'next/router';
import { useEffect, useMemo } from 'react';
import type { InitiateOutboundPrint } from '../events';
import { getPrintFromRawEvent } from '../events';
import { useFinalizedOutboundSwap } from '../store';
import { useStxTx, useListUnspent } from '../store/api';
import { useSwapId } from '../store/swaps';
import { getOutboundAddress } from '../utils';
import { useRevokeOutbound } from './tx/use-revoke-outbound';
import { useDeepMemo } from './use-deep-effect';

export function useOutboundSwap(_txId?: string) {
  let txId: string;
  const router = useRouter();
  if (_txId) {
    txId = _txId;
  } else {
    const routerTxId = router.query.txId;
    if (typeof routerTxId !== 'string') throw new Error('Invalid txId');
    txId = routerTxId;
  }
  const [initTx] = useStxTx(txId);
  const initStatus = initTx?.status || 'pending';

  const swap = useMemo(() => {
    if (!initTx || initTx.status !== 'success') return null;
    if (initTx.tx_type !== 'contract_call') return null;

    const event = getPrintFromRawEvent<InitiateOutboundPrint>(initTx.events[2]);
    if (!event) return null;
    return event.print;
  }, [initTx]);

  const swapId = swap === null ? null : swap.swapId;

  const [footerSwapId, setSwapId] = useSwapId();

  useEffect(() => {
    if (footerSwapId !== txId) {
      setSwapId(txId);
    }
  }, [txId, setSwapId, footerSwapId]);

  const btcAddress = useMemo(() => {
    if (!swap) return '';
    return getOutboundAddress(swap.output);
  }, [swap]);
  const [unspentApiResponse] = useListUnspent(btcAddress);
  const unspent = useDeepMemo(() => {
    if (!swap || unspentApiResponse.unspents === undefined) return undefined;
    const initBurnHeight = swap.createdAt;
    return unspentApiResponse.unspents.find(unspent => {
      const heightOk = unspent.height === 0 || unspent.height >= initBurnHeight;
      const amountOk = BigInt(unspent.value) === swap.sats;
      return heightOk && amountOk;
    });
  }, [unspentApiResponse, swap]);

  const [finalizeTxid] = useFinalizedOutboundSwap(swapId);

  const isCanceled = finalizeTxid === '00';

  const { revokeTxid, submitRevoke } = useRevokeOutbound(swapId, swap?.xbtc);

  return {
    initTx,
    initStatus,
    swapId,
    swap,
    btcAddress,
    finalizeTxid,
    txId,
    unspent,
    btcConfirmed: unspent && unspent?.height !== 0,
    btcTxId: finalizeTxid || unspent?.tx_hash,
    submitRevoke,
    revokeTxid,
    isCanceled,
  };
}
