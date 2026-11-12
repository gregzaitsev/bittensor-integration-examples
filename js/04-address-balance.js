import { connect } from './helpers/connect.js';

const aliceAddress = '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY';
const height = 8430289; // Example testnet block height.
const api = await connect();
try {
  const hash = await api.rpc.chain.getBlockHash(height);
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
