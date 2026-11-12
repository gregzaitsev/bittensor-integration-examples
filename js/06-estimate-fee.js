import { connect, TEST_ADDRESS } from './helpers/connect.js';

const sender = process.argv[2] ?? TEST_ADDRESS;
const recipient = process.argv[3] ?? TEST_ADDRESS;
const amountRao = process.argv[4] ?? '1000000';
const api = await connect();
try {
  // Native TAO has a transaction fee, not an EVM gas price.
  const tx = api.tx.balances.transferKeepAlive(recipient, amountRao);
  const fee = await tx.paymentInfo(sender);
  console.log(JSON.stringify({
    token: 'TAO', estimatedFeeRao: fee.partialFee.toString(),
    weight: fee.weight.toJSON(),
  }, null, 2));
} finally {
  await api.disconnect();
}
