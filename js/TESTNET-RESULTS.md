# Testnet validation

Run on 2026-11-12 against `wss://test.finney.opentensor.ai:443`, using Node.js
22.23.4, `@polkadot/api` 17.0.2 and keyring/util-crypto 14.0.3.
Only test TAO was used. Mainnet was not tested.

## Read calls and signing

- Latest height: best `8430079`, finalized `8430077`.
- Block `8430077`: parent hash, timestamp and five extrinsic hashes returned.
- Starting free balance: `10000000000` rao.
- Estimated fee for a plain transfer: `101874` rao.
- Generated a new mnemonic, validated it, and derived the same address again.
- Signed a mortal transfer locally and submitted its saved SCALE encoding.

## Finalized transfer

- Hash: `0x075a07f41ef7e3e074034991f48958ca2b3c2b8be2b2db98a6c581156dc964f6`
- Block: `8430083`, extrinsic index: `7`.
- Block hash: `0xc77b852c69f3ef8ce347f306b8b0fa3bdd53eba845a58121d3b5ef926509e32d`
- Sender: `5HEdwradEWkQRQveUzR1N4yX2W69XomZAy2x2ctVffBgp16P`
- Recipient: `5FHneW46xGXgs5mUiveU4sbTyGBzmstUspZC92UhjJM694ty`
- Transfer event index: `83`; amount: `1000000` rao (0.001 TAO).
- Actual fee event: `101874` rao, equal to the estimate in this run.
- Historical free balance after transfer: `9998898126` rao.
- Verified: starting balance minus transfer minus fee equals the historical balance.
- Both lookup modes found the same transaction: known height and hash-only
  search in recent finalized blocks.

Replay while the endpoint retains this state (otherwise use a testnet archive):

```sh
node 02-block-info.js 8430083
node 03-transaction-info.js 0x075a07f41ef7e3e074034991f48958ca2b3c2b8be2b2db98a6c581156dc964f6 8430083
node 04-address-balance.js 5HEdwradEWkQRQveUzR1N4yX2W69XomZAy2x2ctVffBgp16P 8430083
```

## Batch and execution failure

- Finalized `utility.batchAll` in block `8430090`, extrinsic index `5`:
  `0xb3158a3e23a5903fcb10c64730c04b462e97504202489616c28bacadc2e79daf`.
- Example 03 returned two transfers of `1000000` and `2000000` rao,
  with distinct event indices `75` and `77` and distinct deposit IDs.
- The batch fee was `176058` rao, reported once for the outer extrinsic.
- An overspending transfer finalized with `FundsUnavailable`:
  `0x2b4ba8a81537ccdcb9b85dfd3aaf023b5dfc19d8da1910316b2019a591c7279a`.
  The submission helper rejected it as `Finalized but failed`.
  Example 03 confirmed block `8430093`, `success: false`, no transfers and
  an actual fee of `101876` rao.

## Runtime notices

Polkadot.js logged unknown custom signed extensions and undecorated custom RPC
methods on this runtime. The native transfer was accepted and finalized with
the pinned versions. This run does not validate other custom calls or future
runtime changes. Historical indexed discovery, HSM signing and alpha/EVM
transfers were not tested.
