import 'cross-fetch/polyfill';
import type { ContractCallTransaction } from '@stacks/stacks-blockchain-api-types';
import { fetchTransaction } from 'micro-stacks/api';
import type { UIntCV } from 'micro-stacks/clarity';
import { hexToCV } from 'micro-stacks/clarity';
// import { network } from '../common/constants';
import { StacksTestnet } from 'micro-stacks/network';
import type { TypedAbiArg, TypedAbiFunction } from '@clarigen/core';
import { cvToValue } from '@clarigen/core';
import type { BridgeContract } from '../common/contracts';
import { getOutboundAddress } from '../common/utils';
import { OPERATOR_KEY, setupScript } from './helpers';
import { bytesToHex } from 'micro-stacks/common';
import { webProvider } from '../common/constants';

const network = new StacksTestnet();

const [txid] = process.argv.slice(2);

type EscrowFn = BridgeContract['functions']['initiateOutboundSwap'];
type GetArgs<F> = F extends TypedAbiFunction<infer Args, unknown> ? Args : never;
type EscrowArgs = GetArgs<EscrowFn>;
type NativeArg<A> = A extends TypedAbiArg<infer T, string> ? T : never;
type ArgTypes<A extends TypedAbiArg<unknown, string>[]> = {
  [K in keyof A]: NativeArg<A[K]>;
};
type InitArgs = ArgTypes<EscrowArgs>;

async function run() {
  const tx = (await fetchTransaction({
    txid,
    url: network.getCoreApiUrl(),
  })) as ContractCallTransaction;

  const { magic, contracts } = setupScript(OPERATOR_KEY);
  const clarityBtc = contracts.clarityBitcoin;

  const swapId = cvToValue<number>(hexToCV<UIntCV>(tx.tx_result.hex));

  const nativeArgs: InitArgs = tx.contract_call.function_args!.map(arg => {
    const cv = hexToCV(arg.hex);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return cvToValue(cv);
  }) as InitArgs;

  const [amount, output, operator] = nativeArgs;

  // console.log('version', bytesToHex(version));
  console.log('output', bytesToHex(output));

  const address = getOutboundAddress(output);

  // const contractScriptHash = await provider.ro(bridge.generateP2pkhOutput(hash));
  // console.log(bAddress.fromOutputScript(Buffer.from(contractScriptHash), btcNetwork));

  console.log('address', address);

  console.log('swapId', swapId);

  const finalizeTxid = await webProvider.ro(magic.getCompletedOutboundSwapTxid(swapId));

  if (finalizeTxid) {
    const txid = bytesToHex(finalizeTxid);
    console.log('BTC tx:', txid);
  } else {
    console.log('No finalized tx yet.');
  }
}

run()
  .catch(console.error)
  .finally(() => {
    process.exit();
  });
