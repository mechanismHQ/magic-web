import { privateKeyToStxAddress, StacksNetworkVersion } from 'micro-stacks/crypto';
import { network } from './constants';

export function sponsorAddress(privateKey: string) {
  const addressVersion = network.isMainnet()
    ? StacksNetworkVersion.mainnetP2PKH
    : StacksNetworkVersion.testnetP2PKH;
  const principal = privateKeyToStxAddress(privateKey.slice(0, 64), addressVersion, true);
  return principal;
}
