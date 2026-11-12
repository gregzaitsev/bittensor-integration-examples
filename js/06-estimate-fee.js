import { connect } from './helpers/connect.js';

const aliceAddress = '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY';
const bobAddress = '5FHneW46xGXgs5mUiveU4sbTyGBzmstUspZC92UhjJM694ty';
const amountRao = '1000000'; // 0.001 TAO
const api = await connect();
try {
  // Native TAO has a transaction fee, not an EVM gas price.
  const tx = api.tx.balances.transferKeepAlive(bobAddress, amountRao);
  const fee = await tx.paymentInfo(aliceAddress);
  console.log(JSON.stringify({
    token: 'TAO', estimatedFeeRao: fee.partialFee.toString(),
    // Runtime work limits returned with the fee estimate; not EVM gas units.
    weight: fee.weight.toJSON(),
  }, null, 2));
} finally {
  await api.disconnect();
}
