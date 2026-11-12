import { connect } from './helpers/connect.js';

// RPC has no transaction-hash lookup. Get the block height from an indexer.
// These values identify a testnet transfer from Alice to Bob.
const txHash = '0x83f243ea31dff23dca5badf7e04d5d343aff266730699aadb4b9fbfcaa6cc34a';
const height = 8430289;
const api = await connect();
try {
  const finalizedHash = await api.rpc.chain.getFinalizedHead();
  const finalizedHeight = (await api.rpc.chain.getHeader(finalizedHash)).number.toNumber();
  if (height > finalizedHeight) throw new Error('Block is not finalized yet.');
  const hash = await api.rpc.chain.getBlockHash(height);
  const { block } = await api.rpc.chain.getBlock(hash);
  const index = block.extrinsics.findIndex((ex) => ex.hash.toHex().toLowerCase() === txHash.toLowerCase());
  if (index < 0) throw new Error('Transaction not found in this block.');
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
} finally {
  await api.disconnect();
}
