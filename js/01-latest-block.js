import { connect } from './helpers/connect.js';

const api = await connect();
try {
  const best = await api.rpc.chain.getHeader();
  const finalizedHash = await api.rpc.chain.getFinalizedHead();
  const finalized = await api.rpc.chain.getHeader(finalizedHash);
  // Use finalized blocks for deposits.
  console.log(JSON.stringify({
    bestHeight: best.number.toString(),
    finalizedHeight: finalized.number.toString(),
    finalizedHash: finalizedHash.toHex(),
  }, null, 2));
} finally {
  await api.disconnect();
}
