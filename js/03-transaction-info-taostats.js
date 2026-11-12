const txHash = process.argv[2];
const apiKey = process.env.TAOSTATS_API_KEY;
if (!apiKey) throw new Error('Set TAOSTATS_API_KEY.');
if (process.env.NETWORK && process.env.NETWORK !== 'mainnet' && process.env.NETWORK !== 'archive') {
  throw new Error('This Taostats example uses Finney mainnet. Use NETWORK=mainnet or unset NETWORK.');
}

async function getAll(path, params) {
  const rows = [];
  let page = 1;
  while (page !== null) {
    const url = new URL(`https://api.taostats.io/v1/${path}`);
    url.search = new URLSearchParams({ ...params, network: 'finney', limit: '200', page: String(page) });
    const response = await fetch(url, {
      // Send the key directly, without a Bearer prefix.
      headers: { Authorization: apiKey, Accept: 'application/json' },
      signal: AbortSignal.timeout(30_000),
      redirect: 'error',
    });
    if (!response.ok) {
      throw new Error(`Taostats ${path}: HTTP ${response.status}. Check the API key, plan and rate limit.`);
    }
    const body = await response.json();
    const next = body.pagination?.next_page;
    if (!Array.isArray(body.data) || (next !== null && (!Number.isSafeInteger(next) || next <= page))) {
      throw new Error(`Unexpected Taostats ${path} response.`);
    }
    rows.push(...body.data);
    page = next;
  }
  return rows;
}

const extrinsics = await getAll('extrinsics', { hash: txHash });
if (extrinsics.length === 0) {
  throw new Error('Transaction not indexed on Finney. Check the hash or try again later.');
}
const transfers = await getAll('transfers', { transaction_hash: txHash });

// Indexed data is not proof of finality. Verify deposits with trusted RPC.
console.log(JSON.stringify({
  source: 'Taostats', network: 'finney', verifiedOnChain: false,
  transactions: extrinsics.map((tx) => ({
    hash: tx.hash, height: tx.block_number, extrinsicIndex: tx.index,
    signer: tx.signer_address, type: `${tx.pallet}.${tx.name}`,
    success: tx.success, error: tx.error, timestamp: tx.timestamp,
    // Count the outer fee once, even when there are several transfers.
    feeRao: tx.fee, feePayer: tx.fee_payer,
    transfers: transfers.filter((transfer) => transfer.extrinsic_id === tx.id)
      .map((transfer) => ({
        indexedTransferId: transfer.id,
        from: transfer.from, to: transfer.to,
        amountRao: transfer.amount, token: 'TAO',
      })),
  })),
}, null, 2));
