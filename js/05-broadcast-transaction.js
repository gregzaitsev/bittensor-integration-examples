import { readFile } from 'node:fs/promises';
import { connect } from './helpers/connect.js';
import { submitAndWait } from './helpers/submit.js';

// Both signing examples write this file by default.
const file = process.argv[2] ?? 'signed-transaction.txt';
const signedHex = (await readFile(file, 'utf8')).trim();
const api = await connect();
try {
  // A submitted hash alone does not mean success.
  console.log(JSON.stringify(await submitAndWait(api, signedHex), null, 2));
} finally {
  await api.disconnect();
}
