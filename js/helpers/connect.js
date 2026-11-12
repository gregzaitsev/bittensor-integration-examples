import { ApiPromise, WsProvider } from '@polkadot/api';

export const ENDPOINTS = {
  testnet: 'wss://test.finney.opentensor.ai:443',
  mainnet: 'wss://entrypoint-finney.opentensor.ai:443',
  archive: 'wss://archive.chain.opentensor.ai:443',
};

export async function connect() {
  // Default to testnet; RPC_URL allows a private node or another endpoint.
  const network = process.env.NETWORK ?? 'testnet';
  const endpoint = process.env.RPC_URL ?? ENDPOINTS[network];
  if (!endpoint) throw new Error('Use NETWORK=testnet, mainnet or archive, or set RPC_URL.');
  // Connect explicitly; 30s is the demo RPC timeout.
  const provider = new WsProvider(endpoint, false, {}, 30_000);
  try {
    await provider.connect();
    return await ApiPromise.create({ provider, throwOnConnect: true });
  } catch (error) {
    await provider.disconnect();
    throw error;
  }
}
