import { ApiPromise, WsProvider } from '@polkadot/api';

export const TEST_ADDRESS = '5HEdwradEWkQRQveUzR1N4yX2W69XomZAy2x2ctVffBgp16P';
// This address has a well-known seed. Use it only on testnet.

export const ENDPOINTS = {
  testnet: 'wss://test.finney.opentensor.ai:443',
  mainnet: 'wss://entrypoint-finney.opentensor.ai:443',
  archive: 'wss://archive.chain.opentensor.ai:443',
};

export async function connect() {
  const network = process.env.NETWORK ?? 'testnet';
  const endpoint = process.env.RPC_URL ?? ENDPOINTS[network];
  if (!endpoint) throw new Error('Use NETWORK=testnet, mainnet or archive, or set RPC_URL.');
  const provider = new WsProvider(endpoint, false, {}, 30_000);
  try {
    await provider.connect();
    return await ApiPromise.create({ provider, throwOnConnect: true });
  } catch (error) {
    await provider.disconnect();
    throw error;
  }
}
