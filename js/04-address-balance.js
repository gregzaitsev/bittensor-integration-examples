import { connect, TEST_ADDRESS } from './helpers/connect.js';

const address = process.argv[2] ?? TEST_ADDRESS;
const height = process.argv[3];
const api = await connect();
try {
  const hash = height === undefined
    ? await api.rpc.chain.getFinalizedHead()
    : await api.rpc.chain.getBlockHash(height);
  const at = await api.at(hash);
  const { data } = await at.query.system.account(address);
  // Keep rao as strings. JavaScript Number can lose precision.
  console.log(JSON.stringify({
    address, token: 'TAO', decimals: 9, blockHash: hash.toHex(),
    height: (await api.rpc.chain.getHeader(hash)).number.toString(),
    freeRao: data.free.toString(),
    reservedRao: data.reserved.toString(),
    frozenRao: data.frozen.toString(),
    // This is a balance limit, not a promise that a transfer will pass.
    transferableBeforeFeesRao: (data.free.toBigInt() > data.frozen.toBigInt()
      ? data.free.toBigInt() - data.frozen.toBigInt() : 0n).toString(),
  }, null, 2));
} finally {
  await api.disconnect();
}
