import { writeFile } from 'node:fs/promises';
import { connect } from './helpers/connect.js';

const [sender, recipient, amountRao, file = 'offline-payload.json'] = process.argv.slice(2);
if (!sender || !recipient || !/^[1-9][0-9]*$/.test(amountRao ?? '')) {
  throw new Error('Usage: node 07-prepare-offline.js <sender> <recipient> <amount-rao> [payload-file]');
}
const api = await connect();
try {
  const tx = api.tx.balances.transferKeepAlive(recipient, amountRao);
  const nonce = await api.rpc.system.accountNextIndex(sender);
  let payload;
  const captured = new Error('Payload captured.');
  // Let the SDK build the full payload, but stop before signing.
  try {
    await tx.signAsync(sender, {
      nonce, era: 256,
      signer: {
        async signPayload(value) {
          payload = value;
          throw captured;
        },
      },
    });
  } catch (error) {
    if (error !== captured) throw error;
  }
  if (!payload) throw new Error('No signing payload.');
  if (!api.runtimeVersion.specVersion.eq(payload.specVersion)) {
    throw new Error('Runtime changed during preparation. Prepare again.');
  }
  await writeFile(file, JSON.stringify({
    metadata: api.runtimeMetadata.toHex(), payload,
  }, null, 2) + '\n', { mode: 0o600, flag: 'wx' });
  console.log(JSON.stringify({
    file, sender, recipient, amountRao,
    genesisHash: payload.genesisHash, nonce: BigInt(payload.nonce).toString(),
    referenceBlockHash: payload.blockHash,
    referenceHeight: BigInt(payload.blockNumber).toString(),
    eraBlocks: 256,
  }, null, 2));
} finally {
  await api.disconnect();
}
