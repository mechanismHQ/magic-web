import { atom, useAtom } from 'jotai';
import {
  FungibleConditionCode,
  makeStandardFungiblePostCondition,
} from 'micro-stacks/transactions';
import { useCallback } from 'react';
import { xbtcAssetInfo } from '../../contracts';
import { btcToSats } from '../../utils';
import { useStxAddress } from '../use-stx-address';
import { useTx } from '../use-tx';
import { outboundTxidState, swapFormValidState } from '../../store/swap-form';
import { Address, OutScript } from '@scure/btc-signer';
import { btcNetwork } from '../../constants';
import { useAtomCallback } from 'jotai/utils';

interface OutboundTx {
  supplierId?: number;
  amount: string;
  address: string;
  outputAmount: string;
}

export const pendingInitOutboundState = atom(false);

const outboundErrorState = atom('');

export const useInitiateOutbound = ({ supplierId, address, amount, outputAmount }: OutboundTx) => {
  const sender = useStxAddress();
  const [pendingInitOutbound, setPendingOutbound] = useAtom(pendingInitOutboundState);
  const [error] = useAtom(outboundErrorState);
  const { submit, ...tx } = useTx(
    (contracts, submit) => {
      if (!address || supplierId === undefined || !amount || !sender) {
        throw new Error('Invalid tx payload');
      }
      const payment = Address(btcNetwork).decode(address);
      const output = OutScript.encode(payment);
      const amountBN = btcToSats(amount);
      const tx = contracts.magic.initiateOutboundSwap(
        BigInt(amountBN),
        output,
        supplierId,
        BigInt(outputAmount)
      );
      const postCondition = makeStandardFungiblePostCondition(
        sender,
        FungibleConditionCode.Equal,
        BigInt(amountBN),
        xbtcAssetInfo()
      );
      try {
        return submit(tx, {
          postConditions: [postCondition],
        });
      } catch (error) {
        setPendingOutbound(false);
        throw error;
      }
    },
    { txidAtom: outboundTxidState }
  );

  const _submit = useAtomCallback(
    useCallback(
      async (get, set) => {
        const swapIsValid = get(swapFormValidState);
        if (!swapIsValid) return;
        try {
          return submit();
        } catch (error) {
          set(outboundErrorState, 'Please use a valid BTC address');
          set(pendingInitOutboundState, false);
        }
      },
      [submit]
    )
  );
  return {
    submit: _submit,
    ...tx,
    error: error || tx.error,
    pendingInitOutbound,
  };
};
