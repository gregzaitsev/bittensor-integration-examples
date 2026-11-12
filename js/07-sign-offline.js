import { readFile, writeFile } from 'node:fs/promises';
import { Keyring } from '@polkadot/keyring';
import { Metadata, TypeRegistry } from '@polkadot/types';
import { cryptoWaitReady, decodeAddress } from '@polkadot/util-crypto';

////////////////////////////////////////////////////////////
// Step 1: Read and check the unsigned payload.
////////////////////////////////////////////////////////////
const [file, expectedGenesis, recipient, amountRao, output = 'signed-transaction.txt'] = process.argv.slice(2);
if (!file || !/^0x[0-9a-f]{64}$/i.test(expectedGenesis ?? '') || !recipient ||
    !/^[1-9][0-9]*$/.test(amountRao ?? '') || !process.env.SIGNER_URI) {
  throw new Error('Set SIGNER_URI; usage: node 07-sign-offline.js <payload-file> <expected-genesis-hash> <recipient> <amount-rao> [signed-file]');
}

// No API client or network connection is used on this machine.
await cryptoWaitReady();
const { metadata, payload } = JSON.parse(await readFile(file, 'utf8'));
const registry = new TypeRegistry();
registry.setMetadata(new Metadata(registry, metadata));
if (payload.version !== 4 || payload.genesisHash.toLowerCase() !== expectedGenesis.toLowerCase()) {
  throw new Error('Wrong network or unsupported transaction version.');
}
if (JSON.stringify(registry.signedExtensions) !== JSON.stringify(payload.signedExtensions)) {
  throw new Error('Signed extensions do not match the metadata.');
}
const call = registry.createType('Call', payload.method);
if (call.section !== 'balances' || call.method !== 'transferKeepAlive' ||
    call.args[0].type !== 'Id' || !Buffer.from(call.args[0].value.toU8a()).equals(Buffer.from(decodeAddress(recipient))) ||
    call.args[1].toString() !== amountRao || BigInt(payload.tip) !== 0n) {
  throw new Error('Unexpected call, recipient, amount or tip.');
}
const era = registry.createType('ExtrinsicEra', payload.era);
if (!era.isMortalEra) throw new Error('Expected a mortal transaction.');

////////////////////////////////////////////////////////////
// Step 2: Check the sender key and sign offline.
////////////////////////////////////////////////////////////
const signer = new Keyring({ type: 'sr25519', ss58Format: 42 }).addFromUri(process.env.SIGNER_URI);
try {
  if (!Buffer.from(signer.publicKey).equals(Buffer.from(decodeAddress(payload.address)))) {
    throw new Error('The key does not match the sender.');
  }
  // Review these values using trusted metadata and network settings.
  console.error(JSON.stringify({
    sender: signer.address, recipient, amountRao, genesisHash: payload.genesisHash,
    nonce: BigInt(payload.nonce).toString(), era: era.toHuman(),
  }, null, 2));
  const signingPayload = registry.createType('ExtrinsicPayload', payload, { version: payload.version });
  // The SDK handles SCALE encoding, signature type and long-payload hashing.
  const { signature } = signingPayload.sign(signer);

  ////////////////////////////////////////////////////////////
  // Step 3: Save the signed transaction for online publication.
  ////////////////////////////////////////////////////////////
  const tx = registry.createType('Extrinsic', { method: payload.method }, { version: payload.version });
  tx.addSignature(signer.address, signature, payload);
  await writeFile(output, tx.toHex() + '\n', { mode: 0o600, flag: 'wx' });
  console.log(JSON.stringify({ file: output, hash: tx.hash.toHex() }, null, 2));
} finally {
  signer.lock();
}
