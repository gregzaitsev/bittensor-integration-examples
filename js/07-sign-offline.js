import { readFile, writeFile } from 'node:fs/promises';
import { Keyring } from '@polkadot/keyring';
import { Metadata, TypeRegistry } from '@polkadot/types';
import { cryptoWaitReady, decodeAddress } from '@polkadot/util-crypto';

////////////////////////////////////////////////////////////
// Step 1: Read and check the unsigned payload.
////////////////////////////////////////////////////////////
const bobAddress = '5FHneW46xGXgs5mUiveU4sbTyGBzmstUspZC92UhjJM694ty';
const amountRao = '1000000'; // 0.001 TAO
// Default to testnet; pass a trusted genesis hash when using another network.
const [file = 'offline-payload.json',
  expectedGenesis = '0x8f9cf856bf558a14440e75569c9e58594757048d7b3a84b5d25f6bd978263105',
  output = 'signed-transaction.txt'] = process.argv.slice(2);

// This script does not use an API client or make network requests.
await cryptoWaitReady();
const { metadata, payload } = JSON.parse(await readFile(file, 'utf8'));
const registry = new TypeRegistry();
registry.setMetadata(new Metadata(registry, metadata));
// This example supports v4 only; the genesis hash selects the network.
if (payload.version !== 4 || payload.genesisHash.toLowerCase() !== expectedGenesis.toLowerCase()) {
  throw new Error('Wrong network or unsupported transaction version.');
}
// Payload encoding must use the same extension order on both sides.
if (JSON.stringify(registry.signedExtensions) !== JSON.stringify(payload.signedExtensions)) {
  throw new Error('Signed extensions do not match the metadata.');
}
const call = registry.createType('Call', payload.method);
// Sign only the expected demo transfer to Bob, with no extra tip.
if (call.section !== 'balances' || call.method !== 'transferKeepAlive' ||
    call.args[0].type !== 'Id' || !Buffer.from(call.args[0].value.toU8a()).equals(Buffer.from(decodeAddress(bobAddress))) ||
    call.args[1].toString() !== amountRao || BigInt(payload.tip) !== 0n) {
  throw new Error('Unexpected call, recipient, amount or tip.');
}
const era = registry.createType('ExtrinsicEra', payload.era);
// This demo uses expiring transactions, so reject immortal payloads.
if (!era.isMortalEra) throw new Error('Expected a mortal transaction.');

////////////////////////////////////////////////////////////
// Step 2: Check the sender key and sign offline.
////////////////////////////////////////////////////////////
// Alice has a well-known key. Use only for demos.
const alice = new Keyring({ type: 'sr25519', ss58Format: 42 }).addFromUri('//Alice');
try {
  if (!Buffer.from(alice.publicKey).equals(Buffer.from(decodeAddress(payload.address)))) {
    throw new Error('The key does not match the sender.');
  }
  // Review these values using trusted metadata and network settings.
  console.error(JSON.stringify({
    sender: alice.address, recipient: bobAddress, amountRao, genesisHash: payload.genesisHash,
    nonce: BigInt(payload.nonce).toString(), era: era.toHuman(),
  }, null, 2));
  const signingPayload = registry.createType('ExtrinsicPayload', payload, { version: payload.version });
  // The SDK handles SCALE encoding, signature type and long-payload hashing.
  const { signature } = signingPayload.sign(alice);

  ////////////////////////////////////////////////////////////
  // Step 3: Save the signed transaction for online publication.
  ////////////////////////////////////////////////////////////
  const tx = registry.createType('Extrinsic', { method: payload.method }, { version: payload.version });
  tx.addSignature(alice.address, signature, payload);
  // Save the full SCALE extrinsic, ready for example 05 to publish.
  // wx refuses to overwrite a file; 0600 limits access to its owner.
  await writeFile(output, tx.toHex() + '\n', { mode: 0o600, flag: 'wx' });
  console.log(JSON.stringify({ file: output, hash: tx.hash.toHex() }, null, 2));
} finally {
  // Lock the key even if signing or writing the file fails.
  alice.lock();
}
