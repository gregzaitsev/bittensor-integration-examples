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
| Get address balance | `node 04-address-balance.js [address] [height]` | Free, reserved, frozen and transferable balance before fees |
| Broadcast transaction | `node 05-broadcast-transaction.js <signed-file>` | Tracks a signed extrinsic until finalized; rejects execution failures |
| Get gas price / fee | `node 06-estimate-fee.js [sender] [recipient] [amount-rao]` | Estimated native transaction fee |

Square brackets mark optional arguments; do not type the brackets.
Omitted block heights use the finalized head. Balance and fee examples default
to the public test address below. Amounts and fees use integer **rao** strings:
`1 TAO = 1,000,000,000 rao`. Avoid floating point for money.
The fee example defaults to `1,000,000 rao` (0.001 TAO).
Free balance is not the same as spendable balance. Keep enough for the fee and
the existential deposit when using `transferKeepAlive`.

### Finding and checking transactions

Substrate RPC does not have a transaction-hash lookup. Example 03 searches the
last 100 finalized blocks by default. Supply one known block height for a fast
lookup, or two heights for a range. A miss means only that the hash was not in
that range. Old event/state queries require an archive node.

For historical discovery on mainnet, use the Taostats index described in the
source document: `GET https://api.taostats.io/v1/extrinsics?hash=<hash>` with
`Authorization: <API_KEY>`. Use its block number with example 03. Index results
are hints; confirm deposits against trusted RPC. No Taostats key is needed for
these examples. Arbitrary indexed history is not part of the testnet tests.

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

The test address is:

```text
5HEdwradEWkQRQveUzR1N4yX2W69XomZAy2x2ctVffBgp16P
```

**Its seed is well known. Use it only for test TAO.** The seed is not stored in
this repository. The same address format can be used on both networks; network
selection comes from the RPC endpoint.

To prepare a transfer, load your own mnemonic or derivation URI through an
environment variable. For example, in Bash:

```sh
read -rs -p 'Signer URI: ' SIGNER_URI; echo
export SIGNER_URI
node sign-transfer.js <recipient> 1000000
unset SIGNER_URI
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

## Validation

See [TESTNET-RESULTS.md](TESTNET-RESULTS.md) for the actual test run.
Mainnet endpoints are provided for integration; no mainnet transactions are sent.
Public endpoints may rate-limit requests. Use trusted redundant nodes in production.
Runtime upgrades can change metadata and signed extensions; recheck signing after upgrades.

References: [blocks and events](https://polkadot.js.org/docs/api/cookbook/blocks/),
[transaction finality](https://polkadot.js.org/docs/api/start/api.tx.subs/).
