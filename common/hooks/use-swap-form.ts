import { useCallback } from 'react';
import { useInput } from './use-input';
import { useAtom } from 'jotai';
import { useAtomCallback, useAtomValue } from 'jotai/utils';
import { btcAddressState, suppliersState } from '../store';
import { useGenerateInboundSwap } from './use-generate-inbound-swap';
import { useRouter } from 'next/router';
import { pendingInitOutboundState, useInitiateOutbound } from './tx/use-initiate-outbound';
import nProgress from 'nprogress';
import {
  amountState,
  currentSupplierState,
  swapFormValidState,
  amountSatsBNState,
  isOutboundState,
  outputAmountSatsState,
} from '../store/swap-form';

export function useSwapForm() {
  const amount = useInput(useAtom(amountState));
  const router = useRouter();
  const btcAddress = useInput(useAtom(btcAddressState));
  const supplier = useAtomValue(currentSupplierState);
  const { generate } = useGenerateInboundSwap();
  const outputAmount = useAtomValue(outputAmountSatsState);

  const submitInbound = useAtomCallback(
    useCallback(
      async (get, _set) => {
        const suppliers = get(suppliersState);
        const amountBN = get(amountSatsBNState);
        const supplier = get(currentSupplierState);
        const currentSupplier = suppliers.find(s => s.id === supplier.id);
        const isValid = get(swapFormValidState);
        if (!isValid) return;
        if (typeof currentSupplier === 'undefined') throw new Error('Invalid state: no supplier.');
        const swap = await generate({
          supplier: currentSupplier,
          inputAmount: amountBN.toString(),
        });
        void router.push({
          pathname: '/inbound/[swapId]',
          query: { swapId: swap.id },
        });
      },
      [generate, router]
    )
  );

  const outboundTx = useInitiateOutbound({
    address: btcAddress.value,
    supplierId: supplier.id,
    amount: amount.value,
    outputAmount: outputAmount.toString(),
  });

  const submit = useAtomCallback(
    useCallback(
      async (get, set) => {
        nProgress.start();
        const isOutbound = get(isOutboundState);
        const isValid = get(swapFormValidState);
        if (isOutbound) {
          if (!isValid) return;
          await outboundTx.submit();
          set(pendingInitOutboundState, true);
        } else {
          await submitInbound();
        }
        nProgress.done();
      },
      [submitInbound, outboundTx]
    )
  );

  return {
    submit,
  };
}
