import { connect } from './helpers/connect.js';

const api = await connect();
try {
  const height = process.argv[2];
  const hash = height === undefined
    ? await api.rpc.chain.getFinalizedHead()
    : await api.rpc.chain.getBlockHash(height);
  const { block } = await api.rpc.chain.getBlock(hash);
  const at = await api.at(hash);
  const timestampMs = (await at.query.timestamp.now()).toString();
  console.log(JSON.stringify({
    hash: hash.toHex(),
    parentHash: block.header.parentHash.toHex(),
    height: block.header.number.toString(),
    timestampMs,
    timestamp: new Date(Number(timestampMs)).toISOString(),
    transactionHashes: block.extrinsics.map((ex) => ex.hash.toHex()),
  }, null, 2));
} finally {
  await api.disconnect();
}
