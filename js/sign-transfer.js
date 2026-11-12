import { writeFile } from 'node:fs/promises';
import { Keyring } from '@polkadot/keyring';
import { cryptoWaitReady } from '@polkadot/util-crypto';
import { connect } from './helpers/connect.js';

const [recipient, amountRao, file = 'signed-transaction.txt'] = process.argv.slice(2);
if (!recipient || !/^[1-9][0-9]*$/.test(amountRao ?? '') || !process.env.SIGNER_URI) {
  throw new Error('Set SIGNER_URI; usage: node sign-transfer.js <recipient> <amount-rao> [output-file]');
}
await cryptoWaitReady();
const signer = new Keyring({ type: 'sr25519', ss58Format: 42 }).addFromUri(process.env.SIGNER_URI);
const api = await connect();
try {
  const tx = api.tx.balances.transferKeepAlive(recipient, amountRao);
  const nonce = await api.rpc.system.accountNextIndex(signer.address);
  // Polkadot.js adds current runtime metadata and a mortal era.
  await tx.signAsync(signer, { nonce, era: 64 });
  await writeFile(file, tx.toHex() + '\n', { mode: 0o600, flag: 'wx' });
  console.log(JSON.stringify({ sender: signer.address, hash: tx.hash.toHex(), file }, null, 2));
  // Signing does not broadcast. Submit before the mortal era expires.
} finally {
  signer.lock();
  await api.disconnect();
}
