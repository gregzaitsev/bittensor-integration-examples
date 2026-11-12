import { writeFile } from 'node:fs/promises';
import { connect } from './helpers/connect.js';

const aliceAddress = '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY';
const bobAddress = '5FHneW46xGXgs5mUiveU4sbTyGBzmstUspZC92UhjJM694ty';
const amountRao = '1000000'; // 0.001 TAO
const file = process.argv[2] ?? 'offline-payload.json';
const api = await connect();
try {
  const tx = api.tx.balances.transferKeepAlive(bobAddress, amountRao);
  const nonce = await api.rpc.system.accountNextIndex(aliceAddress);
  let payload;
  const captured = new Error('Payload captured.');
  // Let the SDK build the full payload, but stop before signing.
  try {
    await tx.signAsync(aliceAddress, {
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
    file, sender: aliceAddress, recipient: bobAddress, amountRao,
    genesisHash: payload.genesisHash, nonce: BigInt(payload.nonce).toString(),
    referenceBlockHash: payload.blockHash,
    referenceHeight: BigInt(payload.blockNumber).toString(),
    eraBlocks: 256,
  }, null, 2));
} finally {
  await api.disconnect();
}
