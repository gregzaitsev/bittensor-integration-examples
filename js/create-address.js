import { Keyring } from '@polkadot/keyring';
import { cryptoWaitReady, mnemonicGenerate } from '@polkadot/util-crypto';

await cryptoWaitReady();
const mnemonic = mnemonicGenerate();
const keyring = new Keyring({ type: 'sr25519', ss58Format: 42 });
const account = keyring.addFromUri(mnemonic);
// This output is secret. Store it offline; do not put it in logs.
console.log(JSON.stringify({ address: account.address, mnemonic }, null, 2));
