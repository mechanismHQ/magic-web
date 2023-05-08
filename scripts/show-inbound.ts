import { bytesToHex, hexToBytes } from 'micro-stacks/common';
import { bridgeContract } from '../common/contracts';
import { pubKeyToBtcAddress } from '../common/utils';
import { webProvider } from '../common/constants';

const [btcTxid] = process.argv.slice(2);
async function run() {
  const bridge = bridgeContract();
  const swap = await webProvider.roOk(bridge.getFullInbound(hexToBytes(btcTxid)));
  console.log(swap);
  const supplier = (await webProvider.ro(bridge.getSupplier(swap.supplier)))!;
  console.log('Supplier public key:', bytesToHex(supplier.publicKey));
  const supplierBtc = pubKeyToBtcAddress(supplier.publicKey);
  console.log('Supplier Address:', supplierBtc);
}

run()
  .catch(console.error)
  .finally(() => {
    process.exit();
  });
