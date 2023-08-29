import { useGaia } from '@micro-stacks/react';
import { useCallback } from 'react';
import type { OutboundSwapStarted } from '../store/swaps';
import { createId, gaiaHubConfigAtom, outboundSwapKey } from '../store/swaps';
import { useAtomValue } from 'jotai';

interface Generate {
  txId: string;
  amount: string;
}

export function useGenerateOutboundSwap() {
  const { putFile } = useGaia();

  const gaiaHubConfig = useAtomValue(gaiaHubConfigAtom);

  const generate = useCallback(
    async ({ txId, amount }: Generate) => {
      if (!gaiaHubConfig) throw new Error('Not logged in');
      const swap: OutboundSwapStarted = {
        txId,
        createdAt: new Date().getTime(),
        id: createId(),
        amount,
      };
      const key = outboundSwapKey(swap.id);
      await putFile(key, JSON.stringify(swap), { encrypt: true, gaiaHubConfig });
      return swap;
    },
    [putFile, gaiaHubConfig]
  );

  return { generate };
}
