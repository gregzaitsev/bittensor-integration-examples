# Native TAO integration examples

Small Node.js examples for the API table in the [integration document](https://docs.google.com/document/d/1jHw-TFg9LCkDhjer8yC2Ee5jvFCv07slMtfMGEt8VTU/edit).
Each numbered file runs on its own. Only connection and submission code is shared.
These examples cover native TAO, not subnet alpha or EVM transfers.

## Install and connect

Use Node.js 22 or newer:

```sh
cd js
npm ci
node 01-latest-block.js
```

Testnet is the default. Set `NETWORK=mainnet` for Finney or `NETWORK=archive`
for the mainnet archive endpoint. `RPC_URL` overrides the endpoint.

| Network | WebSocket endpoint |
| --- | --- |
| Mainnet | `wss://entrypoint-finney.opentensor.ai:443` |
| Mainnet archive | `wss://archive.chain.opentensor.ai:443` |
| Testnet | `wss://test.finney.opentensor.ai:443` |

```sh
NETWORK=mainnet node 01-latest-block.js
RPC_URL=ws://127.0.0.1:9944 node 01-latest-block.js
```

## API examples

Run these commands from `js`. Replace arguments in angle brackets.

| Requirement | Command | Result |
| --- | --- | --- |
| Get latest block height | `node 01-latest-block.js` | Best and finalized heights |
| Get block info | `node 02-block-info.js [height]` | Hash, parent, height, time, transaction hashes |
| Get transaction info | `node 03-transaction-info.js <hash> [from-height] [to-height]` | Finalized status, execution result, transfers, fee, time, type |
| Get transaction info via Taostats | `node 03-transaction-info-taostats.js <hash>` | Indexed Finney transaction details and all its transfers; API key required |
| Get address balance | `node 04-address-balance.js [height]` | Free, reserved, frozen and transferable balance before fees |
| Broadcast transaction | `node 05-broadcast-transaction.js [signed-file]` | Tracks a signed extrinsic until finalized; rejects execution failures |
| Get gas price / fee | `node 06-estimate-fee.js` | Estimated native transaction fee |
| Sign offline, then publish | `node 07-prepare-offline.js` → `node 07-sign-offline.js` → `node 05-broadcast-transaction.js ...` | Prepare online, sign without RPC, then submit the signed file |

Square brackets mark optional arguments; do not type the brackets.
Omitted block heights use the finalized head. Examples use Alice as the sender
and Bob as the recipient. Their keys are public; use them only for demos.
Amounts and fees use integer **rao** strings:
`1 TAO = 1,000,000,000 rao`. Avoid floating point for money.
The fee example defaults to `1,000,000 rao` (0.001 TAO).
Free balance is not the same as spendable balance. Keep enough for the fee and
the existential deposit when using `transferKeepAlive`.

### Finding and checking transactions

Substrate RPC does not have a transaction-hash lookup. Example 03 searches the
last 100 finalized blocks by default. Supply one known block height for a fast
lookup, or two heights for a range. A miss means only that the hash was not in
that range. Old event/state queries require an archive node.

For historical discovery on mainnet, run the standalone Taostats example:

```sh
read -rs -p 'Taostats API key: ' TAOSTATS_API_KEY; echo
export TAOSTATS_API_KEY
NETWORK=mainnet node 03-transaction-info-taostats.js <mainnet-tx-hash>
unset TAOSTATS_API_KEY
```

It requests `/v1/extrinsics?hash=<hash>` and
`/v1/transfers?transaction_hash=<hash>`, follows all pages, and keeps amounts
and fees as rao strings. A transaction can have no transfers or several.
The outer fee is reported once. `indexedTransferId` is an indexer ID, not the
on-chain event ID used by the RPC example.

This example always queries Finney mainnet. These Taostats endpoints do not
accept `network=testnet`; `RPC_URL` does not affect them. Only this example
needs `TAOSTATS_API_KEY`, sent as `Authorization: <API_KEY>` without `Bearer`.
See [extrinsics](https://taostats.io/docs/api-reference/chain/get-extrinsics)
and [transfers](https://taostats.io/docs/api-reference/transfers/get-transfers).

Indexed data can lag and is not proof of finality. Use the returned height to
check the hash and actual events with trusted mainnet RPC:

```sh
NETWORK=archive node 03-transaction-info.js <mainnet-tx-hash> <height>
```

The Taostats example was checked locally with simulated paginated responses
and HTTP errors. An authenticated live request was not tested because no API
key was available. It is not part of the testnet results.

Example 03 reports actual `balances.Transfer` events, including transfers in
batch/proxy calls. `signer` is the outer signer; each transfer has its own
`from`, `to` and `amountRao`. A successful extrinsic may contain no transfer,
or a wrapper may report a failed inner call. Use the actual transfer events.
A missing fee event produces `feeRao: null`, not zero.

Before crediting, require `finalized` and `success`, match the recipient's
AccountId32, sender and integer amount, and store each `depositId` once.
Compare decoded public keys if addresses use different SS58 prefixes.
The ID includes genesis hash, block hash, extrinsic index and block event index.
One transaction can contain several deposits; its fee must not be counted once
per transfer. Save finalized progress and backfill missed blocks in your service.

### Address creation and signing

```sh
node create-address.js
```

This creates an sr25519 account with SS58 prefix 42 and prints a new mnemonic.
Run it in a private terminal: the mnemonic output is secret.

Earlier test runs used this public test address:

```text
5HEdwradEWkQRQveUzR1N4yX2W69XomZAy2x2ctVffBgp16P
```

**Its seed is well known. Use it only for test TAO.** The seed is not stored in
this repository. The same address format can be used on both networks; network
selection comes from the RPC endpoint.

To sign a transfer of 0.001 TAO from Alice to Bob:

```sh
node sign-transfer.js
node 05-broadcast-transaction.js signed-transaction.txt
```

`sign-transfer.js` signs locally using current RPC metadata and nonce, and
writes a signed SCALE extrinsic. It does not submit. This is an online signing
example, not an air-gapped/HSM signing workflow. The key is never sent to RPC.
The file is created with owner-only permissions and cannot overwrite an existing
file. Submit promptly: the transaction has a mortal era of 64 blocks.
Coordinate nonces outside these scripts for concurrent withdrawals.

A submission timeout, dropped connection or replacement leaves the result
uncertain. Save the transaction hash before sending, then reconcile it on-chain
before signing a replacement. Submission output confirms extrinsic success;
use example 03 to confirm the expected transfer event.

### 07. Offline signing and publication

Install dependencies on both machines before disconnecting the signer.
Alice signs in step 2 using her public demo key. Both scripts refuse to
overwrite existing output files. Fund Alice on testnet before publishing.

1. On the online machine, prepare a native TAO transfer:

   ```sh
   NETWORK=testnet node 07-prepare-offline.js
   ```

   This writes `offline-payload.json` with runtime metadata and the SDK signing
   payload: call, nonce, genesis hash, mortality reference, runtime versions and
   signed extensions. It does not sign or submit anything.

2. Copy the payload to the disconnected machine and sign Alice's transfer to Bob:

   ```sh
   node 07-sign-offline.js
   ```

   The expected genesis hash defaults to testnet. The signer uses metadata
   from the trusted preparation machine to decode and check the call.

   The signer imports no API client and makes no network requests. It checks
   the genesis hash, sender key, recipient, integer amount, zero tip, mortal
   era and extension list. This small example supports v4
   `balances.transferKeepAlive` calls. It signs with sr25519 and writes the
   complete signed SCALE extrinsic to `signed-transaction.txt`.

3. Copy only the signed file back to the online machine and publish it on the
   same network:

   ```sh
   NETWORK=testnet node 05-broadcast-transaction.js signed-transaction.txt
   NETWORK=testnet node 03-transaction-info.js <returned-tx-hash> <returned-height>
   ```

   The first command waits for finalization and checks execution. The second
   checks the actual transfer event. For mainnet, prepare and publish with
   `NETWORK=mainnet` and pass the trusted mainnet genesis hash as the second
   argument to `07-sign-offline.js` (after the payload filename).

Submit within the 256-block mortal era. A runtime upgrade, another transaction
using the same nonce, or expiry may require a new payload and signature.
Never reuse the nonce for another withdrawal before reconciling the first one.
This is a file-based offline example, not an HSM integration. See the
[Polkadot.js offline-signing guidance](https://polkadot.js.org/docs/api/FAQ/#i-would-like-to-sign-transactions-offline).

## Validation

See [TESTNET-RESULTS.md](TESTNET-RESULTS.md) for the actual test run.
Mainnet endpoints are provided for integration; no mainnet transactions are sent.
Public endpoints may rate-limit requests. Use trusted redundant nodes in production.
Runtime upgrades can change metadata and signed extensions; recheck signing after upgrades.

References: [blocks and events](https://polkadot.js.org/docs/api/cookbook/blocks/),
[transaction finality](https://polkadot.js.org/docs/api/start/api.tx.subs/).
