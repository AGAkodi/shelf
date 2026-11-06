# Nimiq integration status — Phase 5

Email OTP plus separately verified wallet was explicitly approved by the user on 3 November 2026. Canonical identity remains auth.users.id. Supabase issues normal email sessions; built-in Web3 stays disabled. Wallet permission never authenticates a user. No synthetic email/session bridge is used.

Implemented: injected EVM/EIP-6963 discovery (com.nimiq.pay), explicit eth_requestAccounts, eth_accounts/eth_chainId validation, explicit wallet_switchEthereumChain to 0x89, eth_signTypedData_v4 ownership proof, rejection/error recovery, duplicate-prompt suppression, provider replacement/disconnect handling, account/chain event handling and focus/periodic fallback checks. SDK 0.2.4 remains installed; EVM uses window.ethereum, and NIM is not implemented.

The wallet-auth Edge Function verifies the actual bearer JWT with Auth, requires an OTP authentication method and confirmed email, derives user/session from that validated token, and enforces an exact origin allowlist. Database RPCs check live Auth session ownership. Five-minute random challenges bind user, session, origin, Polygon, account, purpose and expiry; a browser secret is hashed server-side. Viem verifies the stored EIP-712 terms. Atomic consumption records the association and current-session proof; replay/concurrent redemption cannot succeed twice. No public/authenticated role can call the privileged routines or modify private wallet tables.

Device evidence: on 3 November the user confirmed a real address appeared in Nimiq Pay with chain 1 (Ethereum). The initial skill connection checkpoint passed. Actual Polygon switching, OTP sign-in and typed signature proof still require device confirmation. Browser tests use explicitly test-only providers and do not replace device evidence. Wallet version/OS were not supplied.

Official sources inspected 3–4 November 2026:
- https://nimiq.dev/mini-apps/api-reference/ethereum-provider
- https://nimiq.dev/mini-apps/development/load-local-mini-app
- https://github.com/nimiq/nimiq-pay-app/blob/main/web3-provider/src/provider.ts
- https://github.com/nimiq/nimiq-pay-app/blob/main/web3-provider/src/allowedChains.ts
- https://supabase.com/docs/guides/auth/auth-email-passwordless
- https://github.com/supabase/auth/blob/master/internal/api/web3.go
- https://github.com/wevm/viem/blob/main/src/utils/signature/verifyTypedData.ts

Viem 2.57.14 is pinned; the newer November 3 release initially failed Deno's minimum dependency-age policy. No age-policy bypass was used. Verification supports EOA signatures, as used by Nimiq Pay; no contract-wallet claim.

Phase 6 remains unauthorized: no eth_sendTransaction, USDT transfer, merchant address or independent chain verification has been added. USDT payments must later require a matching verified sender, independent receipt/finality checks and unique transaction claim before atomic loan activation. POL gas and Nimiq testnet/EVM-mainnet distinctions remain applicable.

## Phase 6 implementation

User supplied recipient 0x46a32BBB4cf751dfeEa222E1ceD2813f229D1FD5 and approved finalized-block verification. The dedicated wallet layer encodes USDT transfer with viem and sends through the injected provider. Backend verification checks independent Polygon RPC transaction, receipt, matching Transfer log, canonical finalized block and quote binding. No provider hash alone authorizes reading. Background reconciliation processes bounded submitted candidates without sending transactions. Public Polygon RPC read-only checks passed for chain, finalized block and token bytecode. Controlled actual-device transfer remains pending; no automatic mainnet send was performed.
