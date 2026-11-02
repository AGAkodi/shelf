# Nimiq integration status

No wallet/provider integration in Phase 1. SDK 0.2.4 is retained from initial setup and not invoked. Phase 5 must reread installed mini-apps skill and current official documentation/source before implementation. Phase 6 adds real verified USDT payments.

Sources: https://nimiq.dev/mini-apps, https://nimiq.dev/mini-apps/api-reference/ethereum-provider, https://nimiq.dev/mini-apps/features/evm-tokens, https://nimiq.dev/mini-apps/development/load-local-mini-app and https://github.com/nimiq/nimiq-pay-app.

USDT uses injected window.ethereum, Polygon 137 (0x89), six decimals and viem ABI encoding. Native NIM uses SDK init() later. Mini-app ERC-20 payments need POL for gas; Nimiq testnet toggle does not change EVM chains. Verify exact token address at implementation/configuration time.

Connection/account access is not authentication. Backend verification must independently check chain, transaction/receipt success, expected token contract, transfer sender/recipient/amount, finality, quote binding and global uniqueness. Activate a loan exactly once in a locked database transaction. Timeout is not permission to resend; reconcile ambiguous outcomes. No frontend success function can grant access.

See the plan API ledger and unresolved authentication, finality, recipient and device-test gates. No keys or merchant addresses are supplied in this document.
