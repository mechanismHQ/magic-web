import { primaryGaiaHubConfigAtom, stacksSessionAtom } from '@micro-stacks/react';
import { atom, useAtom } from 'jotai';
import { atomFamilyWithQuery, useQueryAtom } from 'jotai-query-toolkit';
import { bytesToHex, hexToBytes } from 'micro-stacks/common';
import { getRandomBytes } from 'micro-stacks/crypto';
import { hashSha256 } from 'micro-stacks/crypto-sha';
import { getFile } from 'micro-stacks/storage';
import { generateHTLCAddress } from '../htlc';
import type { Supplier } from './index';
import {
  QueryKeys,
  fetchFullInboundSwap,
  finalizedOutboundSwapState,
  privateKeyState,
} from './index';
import { atomWithQuery } from 'jotai-query-toolkit';
import { fetchPrivate } from 'micro-stacks/common';
import type { TransactionStatus } from '../api/stacks';
import { stxTxResultState } from './api';
import { waitForAll } from 'jotai/utils';
import { APP_VERSION, NETWORK_CONFIG } from '../constants';
import { generateMetadataHash } from 'magic-protocol';
import type { InboundSwapFull } from '../events';

export const swapIdState = atom<string | undefined>(undefined);

export function useSwapId() {
  return useAtom(swapIdState);
}

export interface InboundSwapStarted {
  id: string;
  supplier: Supplier;
  swapper: string;
  createdAt: number;
  secret: string;
  expiration: number;
  publicKey: string;
  inputAmount: string;
  feeRate: string;
  baseFee: string;
}

export interface InboundSwapReady extends InboundSwapStarted {
  address: string;
  metadata: string;
}

export interface InboundSwapWarned extends InboundSwapReady {
  warned: true;
}

export interface InboundSwapBtcPending extends InboundSwapWarned {
  pendingBtcTxid: string;
}

export interface InboundSwapSent extends InboundSwapBtcPending {
  btcTxid: string;
  satsAmount: string;
  outputIndex: number;
}

export interface InboundSwapEscrowed extends InboundSwapSent {
  escrowTxid: string;
}

export interface InboundSwapRecovered extends InboundSwapEscrowed {
  recoveryTxid: string;
}

export interface InboundSwapFinalized extends InboundSwapEscrowed {
  finalizeTxid: string;
}

export interface InboundSwapDone extends InboundSwapFinalized {
  finalizeTxStatus: TransactionStatus;
}

export type InboundSwap =
  | InboundSwapStarted
  | InboundSwapReady
  | InboundSwapWarned
  | InboundSwapBtcPending
  | InboundSwapSent
  | InboundSwapEscrowed
  | InboundSwapRecovered
  | InboundSwapFinalized
  | InboundSwapDone;

export function getSwapStep(swap: InboundSwap) {
  if ('finalizeTxid' in swap) return 'finalize';
  if ('escrowTxid' in swap) return 'escrowed';
  if ('btcTxid' in swap) return 'sent';
  if ('warned' in swap) return 'warned';
  return 'ready';
  // if ('swapperId' in swap) return 'ready';
  // return 'start';
}

export type SwapStep = ReturnType<typeof getSwapStep>;

export function createId() {
  return `${new Date().getTime()}`;
}

export function createInboundSwap({
  supplier: supplier,
  swapper,
  publicKey,
  inputAmount,
  expiration = 500,
  baseFee,
  feeRate,
}: {
  supplier: Supplier;
  swapper: string;
  publicKey: string;
  inputAmount: string;
  expiration?: number;
  baseFee: string;
  feeRate: string;
}): InboundSwapReady {
  const secret = getRandomBytes(32);
  const swap = {
    id: createId(),
    secret: bytesToHex(secret),
    createdAt: new Date().getTime(),
    supplier,
    publicKey,
    inputAmount,
    expiration,
    baseFee,
    feeRate,
    swapper,
  };
  // if (swapperId !== undefined) {
  //   return createReadySwap(swap, swapperId);
  // }
  // return swap;
  return createReadySwap(swap);
}

export function createReadySwap(swap: InboundSwapStarted): InboundSwapReady {
  const { secret, publicKey, supplier } = swap;
  const hash = hashSha256(hexToBytes(secret));
  const metadata = generateMetadataHash({
    swapperAddress: swap.swapper,
    feeRate: swap.feeRate,
    baseFee: swap.baseFee,
  });
  const address = generateHTLCAddress({
    senderPublicKey: Buffer.from(publicKey, 'hex'),
    recipientPublicKey: Buffer.from(supplier.publicKey, 'hex'),
    metadata,
    hash: Buffer.from(hash),
    expiration: BigInt(swap.expiration),
  });
  return {
    ...swap,
    metadata: bytesToHex(metadata),
    address,
  };
}

export const SWAP_STORAGE_PREFIX = `swaps-${NETWORK_CONFIG}-${APP_VERSION}/`;
export const INBOUND_SWAP_STORAGE_PREFIX = 'inbounds';
export const OUTBOUND_SWAP_STORAGE_PREFIX = 'outbounds';

export function inboundSwapKey(id: string) {
  return `${SWAP_STORAGE_PREFIX}${id}/${INBOUND_SWAP_STORAGE_PREFIX}`;
}

export const inboundSwapState = atomFamilyWithQuery<string, InboundSwap>(
  (get, param) => [QueryKeys.INBOUND_SWAPS, param],
  async (get, param) => {
    const config = get(primaryGaiaHubConfigAtom);
    const privateKey = get(privateKeyState);
    if (!config || !privateKey) throw new Error('Not logged in');
    const key = inboundSwapKey(param);
    const contents = (await getFile(key, {
      gaiaHubConfig: config,
      privateKey,
    })) as string;
    const swap = JSON.parse(contents) as InboundSwapStarted;
    return swap;
  },
  { refetchInterval: false }
);

export const useInboundSwapStorage = (id: string) => useQueryAtom(inboundSwapState(id));

// outbound swaps
export interface OutboundSwapStarted {
  txId: string;
  id: string;
  createdAt: number;
  amount: string;
}

export function outboundSwapKey(id: string) {
  return `${SWAP_STORAGE_PREFIX}${id}/${OUTBOUND_SWAP_STORAGE_PREFIX}`;
}

export const outboundSwapStorageState = atomFamilyWithQuery<string, OutboundSwapStarted>(
  (get, param) => [QueryKeys.OUTBOUND_SWAPS_STORAGE, param],
  async (get, param) => {
    const config = get(primaryGaiaHubConfigAtom);
    const privateKey = get(privateKeyState);
    if (!config || !privateKey) throw new Error('Not logged in');
    const key = outboundSwapKey(param);
    const contents = (await getFile(key, {
      gaiaHubConfig: config,
      privateKey,
    })) as string;
    const swap = JSON.parse(contents) as OutboundSwapStarted;
    return swap;
  }
);

export interface ListFilesResponse {
  entries: string[];
  nextPage: string;
}

export interface SwapListItem {
  dir: 'inbound' | 'outbound';
  id: string;
}

export const swapsListState = atomWithQuery<SwapListItem[]>(QueryKeys.SWAPS_LIST, async get => {
  const session = get(stacksSessionAtom);
  const hubConfig = get(primaryGaiaHubConfigAtom);
  if (!session || !hubConfig) return [];
  const _pageRequest = JSON.stringify({});
  const fetchOptions: RequestInit = {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      // 'Content-Length': `${_pageRequest.length}`,
      Authorization: `bearer ${hubConfig.token}`,
    },
    // body: _pageRequest,
  };
  const response = await fetchPrivate(
    `${hubConfig.server}/list-files/${hubConfig.address}`,
    fetchOptions
  );
  if (!response.ok) {
    console.error(await response.text());
    throw new Error('Error in response');
  }
  const responseData = (await response.json()) as ListFilesResponse;
  console.log('Gaia `response`:', responseData);
  console.log(`Gaia entries: (${responseData.entries.length})`, responseData.entries);
  const entries = responseData.entries
    .filter(path => path.startsWith(SWAP_STORAGE_PREFIX))
    .map(path => {
      const parts = path.split('/');
      const id = parts[1];
      const dir = path.includes(OUTBOUND_SWAP_STORAGE_PREFIX) ? 'outbound' : 'inbound';
      return {
        dir,
        id,
      } as SwapListItem;
    })
    .reverse();
  return entries;
});

export const useSwapKeys = () => useQueryAtom(swapsListState);

type FullOutboundSwap = OutboundSwapStarted & {
  finalizeTxid?: string;
  swapId?: number;
};

export const fullOutboundSwapState = atomFamilyWithQuery<string, FullOutboundSwap>(
  (get, storageId) => ['OUTBOUND_SWAP_FULL', storageId],
  (get, storageId) => {
    const swap: FullOutboundSwap = get(outboundSwapStorageState(storageId));
    const swapId = get(stxTxResultState(swap.txId)) as bigint | null;
    if (typeof swapId === 'bigint') {
      const finalizeTxid = get(finalizedOutboundSwapState(swapId.toString()));
      if (typeof finalizeTxid === 'string') {
        swap.finalizeTxid = finalizeTxid;
      }
      return {
        ...swap,
        swapId: Number(swapId),
      };
    }
    return swap;
  },
  { refetchInterval: 60000 }
);

export const fullInboundState = atomFamilyWithQuery<string, InboundSwapFull | null>(
  (get, swapTxid) => ['INBOUND_SWAP_FULL', swapTxid],
  async (get, swapTxid) => {
    const swap = await fetchFullInboundSwap(swapTxid);
    return swap;
  }
);

export const allSwapsState = atom<(InboundSwap | FullOutboundSwap)[]>(get => {
  const keys = get(swapsListState);
  if (keys.length === 0) return [];
  const items = keys.map(({ dir, id }) => {
    if (dir === 'outbound') {
      return fullOutboundSwapState(id);
    }
    const swap = inboundSwapState(id);
    return swap;
  });
  return get(waitForAll(items));
});
