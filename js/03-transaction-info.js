import { connect } from './helpers/connect.js';

// RPC cannot find a block by transaction hash. Heights only limit the search.
// One height checks one block; two heights search a range.
// Use Taostats to find an unknown block height by hash.
const [txHash, fromHeight, toHeight = fromHeight] = process.argv.slice(2);
const api = await connect();
try {
  const finalizedHash = await api.rpc.chain.getFinalizedHead();
  const finalizedHeight = (await api.rpc.chain.getHeader(finalizedHash)).number.toNumber();
  // With no heights, search the last 100 finalized blocks (a demo limit).
  const start = fromHeight === undefined ? Math.max(0, finalizedHeight - 99) : Number(fromHeight);
  const end = toHeight === undefined ? finalizedHeight : Number(toHeight);
  // This example checks finalized transactions only.
  if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < 0 || end < start || end > finalizedHeight) {
    throw new Error('Use a valid range of finalized block heights.');
  }

  let found = false;
  for (let height = end; height >= start; height--) {
    const hash = await api.rpc.chain.getBlockHash(height);
    const { block } = await api.rpc.chain.getBlock(hash);
    const index = block.extrinsics.findIndex((ex) => ex.hash.toHex().toLowerCase() === txHash.toLowerCase());
    if (index < 0) continue;
    found = true;
    const tx = block.extrinsics[index];
    const at = await api.at(hash);
    const records = await at.query.system.events();
    const events = records.map(({ phase, event }, eventIndex) => ({ phase, event, eventIndex }))
      .filter(({ phase }) => phase.isApplyExtrinsic && phase.asApplyExtrinsic.eq(index));
    const success = events.some(({ event }) => api.events.system.ExtrinsicSuccess.is(event));
    const failure = events.find(({ event }) => api.events.system.ExtrinsicFailed.is(event));
    const fee = events.find(({ event }) =>
      event.section === 'transactionPayment' && event.method === 'TransactionFeePaid');
    const timestampMs = (await at.query.timestamp.now()).toString();
    // Events also show transfers inside batch and proxy calls.
    const transfers = events.filter(({ event }) => api.events.balances.Transfer.is(event))
      .map(({ event, eventIndex }) => ({
        depositId: `${api.genesisHash.toHex()}:${hash.toHex()}:${index}:${eventIndex}`,
        eventIndex,
        from: event.data[0].toString(),
        to: event.data[1].toString(),
        amountRao: event.data[2].toString(),
        token: 'TAO',
      }));
    console.log(JSON.stringify({
      hash: tx.hash.toHex(), blockHash: hash.toHex(), height, extrinsicIndex: index,
      finalized: true, success: success && !failure,
      error: failure ? failure.event.data[0].toHuman() : null,
      signer: tx.isSigned ? tx.signer.toString() : null,
      type: `${tx.method.section}.${tx.method.method}`,
      // The fee belongs to the extrinsic, not to each transfer.
      feeRao: fee ? fee.event.data[1].toString() : null,
      timestampMs, timestamp: new Date(Number(timestampMs)).toISOString(),
      transfers,
    }, null, 2));
    break;
  }
  // A miss only means the hash was not in this range.
  if (!found) throw new Error(`Not found in finalized blocks ${start}..${end}. Use the indexed block height or another range.`);
} finally {
  await api.disconnect();
}
