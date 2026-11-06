# Phase 6 payment implementation decision

Status: Phase 6 authorized; recipient supplied and finalized-block policy approved. Phase 5 passed automated validation and user-confirmed Nimiq Pay Android sign-in/Polygon/wallet verification; commit 4fec5dc. Exact Play Store wallet version was not supplied.

## Payment design

Keep canonical auth.users identity and require a current verified Polygon wallet session to create a quote. The backend snapshots the enabled database plan, verified sender, configured merchant recipient, USDT contract, integer amount, duration, ownership split, latest chain block and quote time. Serialize checkout creation and use idempotency keys. Do not take recipient, price or sender from editable client fields.

The dedicated wallet layer encodes ERC-20 transfer with viem, verifies account and chain immediately before the prompt, and uses eth_sendTransaction with zero native value. Save payment ID before prompting and the returned candidate hash before any verification request. No client event unlocks a book.

A backend-owned Polygon RPC independently checks chain 137, transaction hash, sender, token target, exact transfer calldata and zero native value; successful receipt; matching Transfer log contract/sender/recipient/amount; post-quote block and timestamp; and canonical block hash. The configured USDT address must also pass address validation and deployed bytecode/decimals checks. No public or authenticated database RPC may finalize payments.

## Approved finality policy

Use eth_getBlockByNumber with finalized. Require receipt block <= finalized height and canonical block hash equal to the receipt block hash. Recheck canonical evidence before atomic finalization. Missing finalized support, unavailable RPC or inconsistent chain evidence leaves the payment unresolved and access denied. No fallback confirmation count is silently substituted. Test finality lag, canonical mismatch, missing blocks and RPC failures.

## Failure and replay policy

Unknown wallet outcomes never cause automatic retransmission. Keep an unresolved checkout for reconciliation; allow a candidate hash to be supplied without trusting any associated client details. Explicit wallet rejection may permit a fresh user-requested attempt only when no earlier transaction is unresolved. A submitted hash is reconciled after refresh; multiple tabs cannot independently claim permission to prompt for the same payment.

Only independently verified eligible evidence may globally claim (chain, hash). Arbitrary invalid hashes must not reserve another user's legitimate transfer. Finalize payment confirmation and loan activation in one locked SQL transaction. Repeating the same payment/hash returns its original result without resetting expiry or accounting. Reusing the hash for another payment fails.

Wrong/late/unmatched or extra transfers do not unlock content and require operator reconciliation; no automatic refund or invented refund control. A frontend timeout is not proof of failure. Remove the development completion route from the production handler and disable simulation before Phase 6 acceptance.

## Pending configuration and evidence

- User supplied Polygon recipient: 0x46a32BBB4cf751dfeEa222E1ceD2813f229D1FD5. It is server configuration, not a frontend authority.
- User approved finalized-block verification.
- Working server-side Polygon RPC with chain/finality/token checks; credentials stay in ignored server environment configuration.
- After implementation, user-approved controlled Polygon USDT payment, receipt verification and exactly-one-loan evidence. No real transaction is sent automatically during development.

## Official source ledger

Rechecked 4 November 2026:
- https://nimiq.dev/mini-apps/api-reference/ethereum-provider — eth_sendTransaction request/return contract and explicit native confirmation.
- https://nimiq.dev/mini-apps/features/evm-tokens — direct token transfer, six-decimal amounts and gas requirements.
- https://github.com/nimiq/nimiq-pay-app/blob/main/src/composables/useMiniAppHost.ts — native confirmation, account binding and unknown outcome errors. Upstream main may differ from installed Play Store build.
- https://docs.polygon.technology/pos/concepts/finality/finality — finalized block query and milestone finality.

Implementation is in progress; completion requires automated checks and controlled actual-device payment evidence.
