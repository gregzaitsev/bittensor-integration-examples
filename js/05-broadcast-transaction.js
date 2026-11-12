import { readFile } from 'node:fs/promises';
import { connect } from './helpers/connect.js';
import { submitAndWait } from './helpers/submit.js';

const file = process.argv[2];
if (!file) throw new Error('Usage: node 05-broadcast-transaction.js <signed-transaction-file>');
const signedHex = (await readFile(file, 'utf8')).trim();
const api = await connect();
try {
  // A submitted hash alone does not mean success.
  console.log(JSON.stringify(await submitAndWait(api, signedHex), null, 2));
} finally {
  await api.disconnect();
}
