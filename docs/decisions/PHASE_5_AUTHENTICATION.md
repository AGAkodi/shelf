# Phase 5 authentication decision — approved

On 3 November 2026 the user selected **email OTP plus verified wallet**. This supersedes the proposed wallet-only session bridge. No synthetic email, custom JWT issuance, anonymous account substitution or built-in Web3 sign-in is used.

Supabase email OTP establishes the canonical auth.users.id and a normal refreshable session. Shelf separately verifies ownership of a Polygon EOA through Nimiq Pay eth_signTypedData_v4. The wallet signature never creates an Auth user/session, authorizes spending or activates a loan.

The server issues a random nonce and browser secret after validating the email session. Its private challenge binds user UUID, session UUID, exact allowed origin, account, Polygon chain 137, purpose, issuance and five-minute expiry. The browser reconstructs the fixed typed-data format; the server reconstructs it independently from stored terms. Verification checks the EOA signature and consumes the nonce atomically with the verified association and current-session proof. Replay and concurrent redemption cannot succeed twice.

A wallet maps to one canonical user and each user has one verified wallet in this MVP. A different wallet cannot silently replace it. Automatic linking/merging, multi-wallet management and wallet recovery remain outside this phase. Associations and challenges are private; anonymous/authenticated database roles cannot create, consume or edit them. Service-only RPCs validate live session ownership, and the HTTP handler derives identity from a validated JWT, never client fields or editable metadata.

The current-session proof is cleared on wallet/account/network change, with immediate UI invalidation and server invalidation of pending challenges. Fresh sessions require fresh wallet verification. A durable association does not itself prove that the currently connected wallet matches. Later production checkout must independently require matching server-verified ownership and derive the expected sender there.

Defenses: exact origin allowlist; HTTPS for hosted origins; explicit local-only HTTP exception; 4 KiB request bound; ten issued challenges per user per ten minutes; at most five verification attempts per challenge; constant-size random nonce/secret; no-store responses; no signature/token logging. Per-user issuance removes records older than one day. The private challenge tables have RLS and no reader policies. Production operations should also schedule retention cleanup for inactive users.

Email configuration: confirmation enabled, six-digit ten-minute OTP, confirmation/magic-link templates using the Token variable, and production SMTP. The local stack captures email in Mailpit rather than delivering it externally. Browser and integration tests use real local Auth/email delivery, not a fake code. Wallet verification requires an OTP-authenticated, email-confirmed session; password-only sessions cannot substitute for the chosen flow.

Verification intentionally supports EOA signatures used by Nimiq Pay, not arbitrary smart-contract wallets. No RPC or test transaction is needed to prove ownership. Polygon switching and signing still require native device evidence before Phase 5 is declared complete.

Sources: official Supabase passwordless-email documentation, Nimiq Ethereum provider API, installed SDK/skill and viem verifyTypedData implementation. See NIMIQ_INTEGRATION.md for source URLs and device evidence.
