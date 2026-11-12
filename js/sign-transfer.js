import { writeFile } from 'node:fs/promises';
import { Keyring } from '@polkadot/keyring';
import { cryptoWaitReady } from '@polkadot/util-crypto';
import { connect } from './helpers/connect.js';

const bobAddress = '5FHneW46xGXgs5mUiveU4sbTyGBzmstUspZC92UhjJM694ty';
const amountRao = '1000000'; // 0.001 TAO
const file = process.argv[2] ?? 'signed-transaction.txt';
await cryptoWaitReady();
// Alice has a well-known key. Use only for demos.
const alice = new Keyring({ type: 'sr25519', ss58Format: 42 }).addFromUri('//Alice');
const api = await connect();
try {
  const tx = api.tx.balances.transferKeepAlive(bobAddress, amountRao);
  const nonce = await api.rpc.system.accountNextIndex(alice.address);
  // Polkadot.js adds current runtime metadata and a mortal era.
  await tx.signAsync(alice, { nonce, era: 64 });
  await writeFile(file, tx.toHex() + '\n', { mode: 0o600, flag: 'wx' });
  console.log(JSON.stringify({ sender: alice.address, hash: tx.hash.toHex(), file }, null, 2));
  // Signing does not broadcast. Submit before the mortal era expires.
} finally {
  alice.lock();
  await api.disconnect();
}
