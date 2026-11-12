import { connect } from './helpers/connect.js';

const aliceAddress = '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY';
const height = process.argv[2];
const api = await connect();
try {
  // With no height, read Alice's balance at the latest finalized block.
  const hash = height === undefined
    ? await api.rpc.chain.getFinalizedHead()
    : await api.rpc.chain.getBlockHash(height);
  const at = await api.at(hash);
  const { data } = await at.query.system.account(aliceAddress);
  // Keep rao as strings. JavaScript Number can lose precision.
  console.log(JSON.stringify({
    address: aliceAddress, token: 'TAO', decimals: 9, blockHash: hash.toHex(),
    height: (await api.rpc.chain.getHeader(hash)).number.toString(),
    freeRao: data.free.toString(),
    reservedRao: data.reserved.toString(),
    frozenRao: data.frozen.toString(),
    // Free minus frozen, floored at zero; fees and keep-alive limits still apply.
    transferableBeforeFeesRao: (data.free.toBigInt() > data.frozen.toBigInt()
      ? data.free.toBigInt() - data.frozen.toBigInt() : 0n).toString(),
  }, null, 2));
} finally {
  await api.disconnect();
}
