# Shelf — implementation plan

Phase 0 · 2 November 2026 · Application implementation has not started.

## Authority, scope, and research inventory

The user's latest phased requirements are the product specification for this plan. Shelf is the application name; Virtual Library is the approved UI/product reference. No application code is created in Phase 0.

Repository inspection found package.json, package-lock.json, skills-lock.json, the installed mini-apps skill, and SDK 0.2.4. There is no existing AGENTS.md, PROJECT_SPEC.md, NIMIQ_INTEGRATION.md, DATABASE_SCHEMA.md, TEST_PLAN.md, application, database, or test suite. These missing files must not be represented as having been read. Create the project context documents from the user's requirements at the beginning of Phase 1, before application implementation. They must preserve this plan's unresolved decisions.

Read/reference inventory:

- User's complete build instructions and earlier pasted project guidance.
- Installed `.agents/skills/mini-apps/SKILL.md`, scaffold, Ethereum API, chains/tokens, and pre-ship checklist references.
- Installed SDK package metadata, README, declarations, and provider entry points. Version installed: 0.2.4; recheck versions and exports at implementation time.
- All five files in `virtual-library-replica.zip`: README, package metadata, HTML entry, React UI and CSS. This is a visual/clickable prototype, not working production logic. Its sample catalogue, statistics, account, transactions and checkout are simulated.
- Supplied Nimiq Pay archive: README, architecture, Mini App host/account/signing/transaction handlers, injected provider, errors, supported chains, chain switching, and SDK demo composable. This is reference material; its internal agent/release instructions do not govern Shelf.
- Developer Center archive: documentation inventory, Mini Apps overview; relevant tutorial/provider/token/development material cross-checked against the live official pages below. Unrelated protocol, node-operation and release documentation is outside this build's scope.

Archives were extracted for inspection under the OS temporary directory `shelf-phase0-references`; the original ZIPs remain in Downloads. They are not bundled into Shelf or committed. Archives lack a verified upstream commit identifier and may differ from current main. Official live source was also inspected; web fetches can be cached. Recheck relevant source at Phase 5 and record the deployed wallet version during device testing.

## Verified sources and API ledger

Official pages consulted on 2 November 2026:

1. https://nimiq.dev/mini-apps — host architecture, injected context, SDK access.
2. https://nimiq.dev/mini-apps/api-reference/ethereum-provider — EIP-1193 methods and permission behavior.
3. https://nimiq.dev/mini-apps/features/evm-tokens — Polygon, USDT, encoding and gas requirements.
4. https://nimiq.dev/mini-apps/development/load-local-mini-app — Node 22+, LAN URL and testing limitations.
5. https://github.com/nimiq/nimiq-pay-app/blob/main/web3-provider/src/provider.ts — injection and discovery.
6. https://github.com/nimiq/nimiq-pay-app/blob/main/src/composables/useMiniAppHost.ts — native confirmation, signing and broadcasting.
7. https://supabase.com/docs/guides/auth/auth-web3 — wallet-signature authentication and sessions.
8. https://supabase.com/docs/guides/storage/serving/downloads — authenticated private downloads versus signed access.

| Capability | Verified contract | Shelf behavior |
| --- | --- | --- |
| NIM provider | SDK `init(options?: { timeout?: number })` returns a provider promise | Retain SDK; use only if native Nimiq functionality is needed. No NIM payments in USDT MVP. |
| Host detection | `window.nimiqPay` context; injected `window.ethereum`; EIP-6963 announcement with `rdns: com.nimiq.pay` in source | Feature-detect host and provider; support delayed injection and timeout. An arbitrary browser wallet is not proof of Nimiq Pay. Host markers are UX hints, never authorization. |
| Accounts | `request({ method: 'eth_requestAccounts' })` returns addresses | Explicit Connect button; native permission prompt; no automatic prompt on initial render. |
| Existing accounts | `eth_accounts` | Restore available wallet state; Supabase session remains a separate requirement. |
| Chain | `eth_chainId`; `wallet_switchEthereumChain`, params `[{ chainId: '0x89' }]`, result null | Check Polygon 137 and recheck before sending. Error 4902 means unavailable chain. Offer an explicit recovery action, no silent switching loop. |
| Transfer | `eth_sendTransaction`, params `[{ from, to, data, value? }]`, result hash string | `to` is allowlisted token contract; viem encodes `transfer(recipient, amount)`; zero native value. A returned hash is submission, not payment confirmation. |
| Token reads | `eth_call` with transaction object and block tag | viem encoding/decoding; optional balance/gas preflight. |
| Plain-text authentication | `personal_sign`, params `[message, address]`, returns signature | Supabase SIWE is a plain-text EIP-4361 message; validate exact installed Supabase wallet integration before use. |
| Structured signing | `eth_signTypedData_v4`, params `[address, JSON.stringify(typedData)]` | Use for any later structured challenge; not needed for ERC-20 transfer. |
| Cancellation | Source defines 4001 rejection; chain reference defines 4902 | Normalize known codes and unknown errors; cancellation never activates a loan. |
| Ambiguous outcome | Archive defines -32001 as outcome unknown | Do not blindly resend after timeout/unknown broadcast outcome. Reconcile first; handle wallet-version differences. |

Polygon USDT documented address: `0xc2132D05D31c914a87C6611C10748AEb04B58e8F`, 6 decimals. Validate address bytes and deployment on chain 137 when configuring production. Monetary values use integer base units, never floating point. Mini-app transfers require POL for gas; the wallet's native gas abstraction is not available through this standard ERC-20 flow. The Nimiq testnet toggle affects NIM only. Dedicated EVM test configuration cannot activate production loans.

## Architecture

Vite + React + TypeScript SPA, Tailwind CSS, React Router; Vercel serves static assets and SPA route rewrites. Supabase provides PostgreSQL, Auth, private Storage and Edge Functions. Keep business transitions transactional in PostgreSQL; keep chain verification and protected content delivery in server functions. No Next.js and no copied wallet internals.

Runtime dependencies: React/React DOM, React Router, Supabase JS, installed Mini App SDK, viem, lucide-react, schema validation as needed. Development dependencies: Vite React plugin, TypeScript, Tailwind Vite integration, ESLint, Vitest, Testing Library, Playwright, Supabase CLI. Pin compatible versions through lockfile after checking current package requirements. Use Node 22+ supported by selected tools; installed host Node is 26.13.0. Docker/Supabase executables were not found on PATH in Phase 0; local database test tooling needs setup or an isolated hosted test project.

```text
src/
  app/                 router, providers, error boundary
  components/          layout, navigation, forms, book cards, states
  pages/               home, explore, details, checkout, success,
                       library, reader, transactions, admin, contribute
  features/            catalogue, borrowing, auth, admin, contributors
  lib/
    nimiq/             client, provider, payments, errors, types
    supabase/          client, generated database types
    config/            validated public configuration
  styles/              approved design tokens and Tailwind
supabase/
  config.toml
  migrations/
  functions/           checkout, verify-payment, read-content,
                       return-loan, admin operations, shared helpers
  seed.sql
tests/                 domain, integration, RLS, browser, adversarial
docs/                  source ledger, deployment, device tests, reports
public/                public assets only; no protected book content
AGENTS.md
PROJECT_SPEC.md
DATABASE_SCHEMA.md
NIMIQ_INTEGRATION.md
TEST_PLAN.md
IMPLEMENTATION_PLAN.md
.env.example
README.md
vercel.json
```

Routes: `/`, `/explore`, `/books/:id`, `/checkout/:paymentId`, `/payments/:id/success`, `/library`, `/read/:loanId`, `/transactions`, `/admin/*`, `/contribute`, plus auth handling and not-found. Success route reloads backend state; URL navigation cannot manufacture success.

Preserve near-black backgrounds, violet accents, DM Sans/Playfair Display typography, cards, sidebar and reader spacing. Refactor the prototype into typed reusable components. Add contributor screen using existing styling. Replace fixed seven-day labels with selected database plan. No fabricated ratings/revenue/read counts or nonfunctional production buttons. Omit reviews/saved books unless explicitly retained; these are not required MVP features. Self-host fonts if practical; verify mobile safe areas, keyboard access, contrast and 44px touch targets.

## Identity and Supabase architecture

### Phase 2 approved identity decision (2 November 2026)

The user explicitly approved provider-neutral identity for Phase 2. Canonical application identity is `auth.users.id`; all ownership and RLS use that UUID. Real local Auth users test isolation. Web3 remains disabled, and no profile wallet field or wallet association establishes identity. This supersedes the earlier requirement to settle the wallet login flow before the Phase 2 schema.

Phase 5 security gate, not completed functionality: design and test server-issued one-time nonces, expiry, atomic consumption, domain/origin binding, appropriate chain/account binding, signature verification, replay rejection, account-change handling and secure association to `auth.users.id`. A reusable signed message without nonce consumption is unacceptable. Current upstream Supabase `internal/api/web3.go` was inspected; its handler shows signature/time/domain validation but no one-time nonce consumption. Do not enable built-in Web3 on that evidence alone. Source: https://github.com/supabase/auth/blob/master/internal/api/web3.go.

Phase 2 uses one pending or active loan per user/book, enforced by a partial unique index. Later checkout must lock/expire stale active records before creating a replacement; time expiry still denies content independently. Structured plain-text chapters in JSON are the MVP asset format. No HTML content rendering or public protected storage is authorized.

Proposed reader identity: Supabase Auth Web3 Ethereum sign-in using the injected provider and an EIP-4361 signature. Account permission is not login. Supabase verifies signature/domain/time before issuing a JWT; RLS uses `auth.uid()`. Verify nonce/replay guarantees and exact client signature against installed Supabase Auth before adopting it. If it cannot meet replay requirements or work inside Nimiq Pay, stop and present an authentication alternative before schema/auth implementation. Do not silently substitute anonymous users or client-supplied addresses. Phase 2 establishes identity/RLS with integration users; live wallet connection is added in Phase 5.

Store verified wallet association derived server-side from Auth identity; user-editable profile metadata cannot establish payment sender identity or admin rights. On account change, invalidate checkout state and require matching authentication. Handle provider events when supported and recheck accounts/chain before each sensitive action; do not assume complete event support across wallet versions.

Admins use Supabase-authenticated accounts with a protected server-managed role table or equivalent privileged database membership. Bootstrap the first admin using an explicit privileged operator procedure; readers cannot edit roles. Approval of a contributor grants no admin privileges.

### Data model

All entities use UUIDs and timestamptz timestamps. Amounts use integer micro-USDT stored as bigint (JSON strings at API boundaries). Keep UTC database time authoritative.

| Entity | Essential contents and rules |
| --- | --- |
| profiles | Auth user FK; display name; safe self-update fields only. |
| contributors | Approved identity, owner user FK, author/publisher, contact; private fields restricted. |
| contributor_applications | Applicant user, name/contact/type/description/rights, pending/approved/rejected, reviewer and decision timestamp. |
| books | Title, author, category, description, public preview, cover, ownership type, contributor FK if contributor-owned, draft/published. |
| book_licenses | Book, rights holder/evidence, distribution permission and dates; private/admin-controlled. Publication requires content and adequate rights record. |
| book_assets | Private object mapping/version/type; separate from public book metadata. Proposed initial format: sanitized chapter text/structured content matching the reader; finalize before upload implementation. |
| borrowing_plans | Book FK, 3/7/14-day duration, positive price units, chain/token/decimals, enabled. MVP only enables allowlisted Polygon USDT. |
| loans | User, book, plan and immutable duration snapshot, pending_payment/active/returned/expired/cancelled, activation/expiry/return timestamps. |
| payments | Loan/user FK, immutable quoted amount/token/chain/recipient/sender, status, hash, block details, verification timestamps, revenue split snapshots, idempotency key. |
| payment_attempts | Attempt hashes/errors/reconciliation information, if needed to distinguish rejected hashes from finalized payment; not client-editable. |
| user_roles | Privileged admin membership; no reader mutation. |

Payments: pending/submitted/verifying/confirmed/failed/cancelled; retryable verification timeout stays unresolved, not falsely failed. Enforce one confirmed payment per loan; unique `(chain_id, normalized_tx_hash)` globally for claimed transactions; unique user/request idempotency key. Use foreign keys, enum/check constraints, nonnegative amounts, valid timestamps and ownership consistency. Index book publication/category/search, user loans/expiry, payment status/hash and applications/status. Determine duplicate-active-borrow behavior before final schema; recommend one live or pending checkout per user/book with database serialization and explicit retry behavior, avoiding double charges.

RLS on every application table. Anonymous users read only published catalogue/enabled plans/public previews. Readers see their own profiles/loans/payments/applications; privileged transitions cannot be direct client inserts/updates. Contacts, license evidence and private asset mappings are not exposed by public joins. Views must respect RLS. SQL SECURITY DEFINER routines need fixed search_path, explicit authorization and minimal execute grants. Revoke public access to verifier/finalization routines. Admin checks apply in database/functions as well as UI.

Private protected-books bucket: no reader SELECT/signing capability; server-only content reads, admin-authorized writes. Public covers can use a separate bucket. Validate file sizes/types and content; no active HTML execution. Seed original Shelf demo works with recorded permission, not commercial books from the mock catalogue. Reset and seed must be reproducible without distributing copyrighted material.

## Checkout and independent verification

1. Authenticated checkout endpoint accepts book/plan IDs and idempotency key. Load enabled plan/published book and verified authenticated wallet; quote amount, duration, recipient and token server-side. Persist pending loan/payment atomically. Client cannot choose an amount, recipient or revenue split.
2. Display selected duration, exact USDT fee and POL gas requirement. Connect, authenticate and switch chain through separate understandable prompts. Send the encoded direct ERC-20 transfer using the dedicated integration layer. Persist pending payment ID before requesting the wallet.
3. Client submits only payment ID and candidate hash to verification; never treats submission as success. Persist returned hash immediately and resume reconciliation after refresh. Unknown outcome does not automatically cause another transfer.
4. Server uses its own configured Polygon RPC, checks `eth_chainId == 137`, fetches transaction and receipt, validates success, chain, token target, exact transfer calldata/value, receipt Transfer event contract/from/to/amount, and sender matching authenticated quoted wallet. Validate the canonical block and sufficient confirmations using a documented finality policy before activation.
5. Reject transfers predating the checkout quote; record quote baseline block and verified block time. A direct ERC-20 transfer contains no Shelf order ID: bind it to verified sender, immutable quote, post-quote block and global transaction claim. Serialize same-user/book pending attempts. Never accept arbitrary historical payments or another user's hash. Unmatched/late payments require explicit reconciliation; no automatic refund is promised.
6. Finalize in one locked SQL transaction: claim unique hash, confirm payment, calculate revenue snapshots, activate exactly one pending loan with database `now()` and quoted duration. Reject a hash already assigned elsewhere; a repeat for the same payment returns the existing result without resetting expiry or incrementing revenue.
7. Contributor-owned split uses integer arithmetic: contributor=floor(gross*80/100), platform=gross-contributor; document rounding. Platform-owned split is zero contributor and full platform. Plan/ownership changes cannot change completed payment accounting. No payouts.
8. Retry unresolved receipts through bounded UI polling plus server reconciliation for submitted hashes. Rate-limit verification; do not hold a function open indefinitely. Cancellation, failure and success are distinct. Reruns never extend a loan.

Production verifier secrets are server-only. Service-role use requires explicit JWT/user checks and tightly limited routines, since service role bypasses RLS. No public or authenticated RPC may mark a production payment confirmed. Development adapter only exists in explicitly local/test mode, cannot be enabled by frontend flags, and cannot finalize a production quote. Disable/remove its deployed route and credentials by Phase 6.

## Protected reading and expiry

Use authenticated server-proxied chapter/content requests rather than delivering reusable bearer storage URLs. Each request verifies JWT, correct user, loan/book mapping, status active and database time strictly before expiry. Server chooses the stored asset path; client cannot supply an arbitrary bucket/key. Return `Cache-Control: private, no-store`; exclude content from service-worker/offline caches and logs. No direct reader storage permissions.

If signed storage URLs are used internally, never return them to the client; keep their lifetime bounded by remaining loan time. A public-facing signed URL cannot be instantly revoked on early return, so it does not meet this plan's strict re-request requirements.

Return locks the owned active loan and sets returned; subsequent requests fail immediately. Expired access fails even if status cleanup has not run. UI classifies active-but-time-expired records as history and can request lazy expiry cleanup; scheduled jobs are maintenance only. Reader clears rendered content at expiry/return/session loss and revalidates on focus, but already delivered bytes cannot be recalled. This is access control, not DRM. Keep chapter payloads bounded and validate re-request/return races. Existing authorized in-flight delivery cannot retroactively be withdrawn.

## Environment and deployment

Public configuration: `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` (or documented anon-key equivalent), `VITE_APP_URL`. Public payment display configuration must be derived from the server quote, not trusted for verification.

Server configuration: Supabase URL and server credentials provisioned by platform, `POLYGON_RPC_URL`, `PAYMENT_RECIPIENT_ADDRESS`, allowed origins, verified USDT/chain allowlist, confirmation/finality policy, local-only dev adapter setting. Exact variable names documented when implemented. RPC credentials/service keys never receive VITE prefixes. Validate missing/invalid settings and fail closed for paid access; allow useful configuration error screens.

Vercel hosts SPA only; Supabase hosts functions and private content. Add SPA rewrites, appropriate CSP/security headers, allowed CORS origins (including LAN dev where explicitly configured), no secret exposure in build artifacts, and separate test/production Supabase projects. No real credentials have been requested or discovered in Phase 0.

## Sequential phases and gates

Every phase gets a report containing implemented work, created/changed files, database changes, tests, build/type results, discovered/fixed problems, limitations and acceptance outcome. Run lint, typecheck, relevant tests and build when those tools exist. Record unavailable checks honestly. Fix failures before proceeding. Commit scoped phase files only; no node_modules, credentials, downloads or unrelated changes. Do not push unless requested.

| Phase | Deliverable | Required gate |
| --- | --- | --- |
| 0 | Research and this implementation plan/report | Source ledger, missing docs/risks, no application code; show user before Phase 1. |
| 1 | Project docs, Vite React TS/Tailwind/router, layouts, validated config, Supabase client, loading/error boundaries, README/env example/gitignore | Install, dev smoke, all major placeholder routes, lint/types/build. |
| 2 | Migrations, Auth/RLS design, private bucket, safe seed, generated types | Real reset/migrate/seed and multi-user RLS/storage tests. Stop if runtime unavailable. |
| 3 | Approved UI with live catalogue/search/filter/details/plans and screen states | Desktop/mobile browser checks, data integration and route tests. Payments absent. |
| 4 | Local-only development adapter and real transactional loan lifecycle/content authorization | Active/expired/returned/wrong-user/wrong-book/no-loan tests; adapter cannot run in production. |
| 5 | Reverified dedicated Nimiq environment/provider/auth integration | Nimiq Pay device account, sign-in and Polygon checks; cancellation/unknown/error tests. Device confirmation required by installed scaffold skill. |
| 6 | Real USDT transfer, independent verification and atomic activation; remove/disable development adapter | Invalid transfers create zero active loans; valid creates exactly one; concurrent replay safe; real wallet/RPC evidence. |
| 7 | Harden protected reading, expiry/history and return | Old/direct URLs, wrong user/book, returned/expired/unpaid requests all denied. |
| 8 | Real admin CRUD/uploads/plans/loans/payments/revenue/application decisions | Privileged writes and uploads enforced server-side, reader privilege attacks fail. |
| 9 | Contributor form, validation, submission/status and review completion | Applicant privacy, admin decisions and recorded statuses verified. |
| 10 | Adversarial payment/access/auth/RLS/state/network/concurrency audit | Fix critical findings, full automated suite and build. |
| 11 | Consistent mobile/desktop/wallet/reader error and progress polish | Responsive/accessibility/manual regression checks; no new scope. |
| 12 | Full new-reader and admin acceptance journeys; pre-ship skill checklist | Actual configured environment/device E2E; no fake production features or critical findings. |
| 13 | Vercel/Supabase setup, deployment/test/demo docs, accurate README/env inventory | Lint/types/tests/build; actionable deployment package. Hosting is not claimed deployed without actual deployment evidence. |

Phase 3 admin/reader are initial UI shells backed by available queries; complete privileged actions arrive in Phase 8 and actual protected reading in Phase 4/7. Phase 8 reviews applications through seeded/integration records; public submission is finished in Phase 9. No stage is skipped.

## Testing strategy

- Unit: integer amounts/rounding, loan eligibility/time boundary, state transitions, provider error normalization, receipt/Transfer validation and quote matching.
- PostgreSQL/RLS integration: run actual migrations/reset/seed; anonymous/two-reader/admin/service contexts; unauthorized writes; execute grants; private object access; transactional rollback; concurrent finalization and return/access races.
- Verification fixtures: absent/fake/reverted/wrong-chain/wrong-token/wrong-target/wrong-sender/wrong-amount/hash-reuse/pre-quote/unconfirmed/reorg/RPC-timeout transfers. Fixture tests are test-only, never production proof.
- Browser: routes, search/filter, selected plan, login, refresh/resume checkout, double clicks/multiple tabs, history, forms, loading/errors and missing configuration. Provider doubles only in test harness, clearly distinguish from real device tests.
- Security: frontend success manipulation, another user's IDs, role/profile injection, direct storage/signing calls, cached/reused content requests, malformed uploads, application privacy, rate limiting and secrets scan.
- Device: Nimiq Pay on phone/emulator over LAN or HTTPS, wallet version recorded; rejection/account/network changes, POL shortage and pending-payment recovery. Desktop MetaMask is not a substitute.
- Test chain: separately configured EVM test deployment with test token and test database; never label it production USDT. Final USDT gate needs a small controlled Polygon transfer and independently verified receipt, using user-approved funding/recipient.
- Visual: compare actual running screens to prototype across 375px/mobile and desktop, including reader and admin. No visual parity is claimed from source inspection alone.

## Unknowns, risks, and decisions before implementation

1. Supabase project/credentials, Docker availability, deployment account/domain and RPC provider are not configured. Phase 1 can create a foundation; Phase 2 cannot pass without a functioning database runtime.
2. Wallet authentication is proposed, not yet device-verified. Validate Supabase SIWE nonce/replay behavior and compatibility before committing the identity schema. Admin bootstrap needs an operator identity.
3. Merchant receiving address must be supplied and verified before real payments. Never substitute a random address or a wallet from reference code.
4. Finality threshold must be specified and tested against Polygon RPC support before Phase 6; prefer verified finalized-block support where available, otherwise an explicit confirmation-depth policy with reorg tests. This is an implementation security gate.
5. Document the treatment of late, unmatched or accidentally duplicated on-chain transfers. Pending UI timeout cannot imply no money moved. Direct transfers have no built-in order ID; quote/sender/time/replay binding is mandatory.
6. Initial content format is proposed chapter text/structured content to match the approved reader. If PDF/EPUB is required, settle ingestion/rendering and request-level access design before upload implementation. Do not silently add unsafe HTML or publicly downloadable whole books.
7. Seed titles will be original demo works; real catalogue distribution requires rights/evidence. Commercial prototype titles are not supplied licensed content.
8. Original prototype includes decorative or fake metrics, reviews and saved-book navigation; omit unsupported features rather than presenting fabricated activity. Preserve visual language.
9. Storage/Edge Function bandwidth and runtime limits need bounded chapter delivery, size limits and a configured project; exact limits checked before implementation.
10. November 11 was mentioned in pasted guidance, not a newly confirmed delivery commitment. No schedule or completion guarantee is inferred.

These are planning proposals. No irreversible auth/database/payment decision is executed in Phase 0. Raise any unresolved security decision before the affected phase, while completing independent authorized work.

## Phase 0 completion report

1. Implemented: repository inventory, requirements reconciliation, official API/source research, UI source inspection, architecture and sequential gates.
2. Files created: IMPLEMENTATION_PLAN.md only (this report is included).
3. Files changed: none of the pre-existing project files.
4. Database changes: none.
5. Tests performed: repository/package/source inventory; checked installed SDK version/types, Node runtime and database tool availability. No application tests exist.
6. Build/type-check results: not applicable; package.json contains only the SDK dependency and no scripts/application. No build or test success is claimed.
7. Problems discovered: named spec files absent; prototype simulates critical features; no database tooling found on PATH; gas/testnet distinctions; bearer URL revocation gap; wallet connection versus authentication; uncertain transaction outcome/replay risks.
8. Problems fixed: addressed each in the plan with documentation work, phase gates, server authentication, proxy authorization, quote binding and atomic verification. Runtime issues remain implementation work.
9. Remaining limitations: no application/database/real wallet tests or visual rendering yet; configuration, auth/finality/content decisions and device verification remain explicit gates.
10. Acceptance: Phase 0 planning deliverable passes; MVP implementation acceptance is not yet applicable. Stop here and present plan/report before Phase 1 as requested.

## Phase 3 scope clarification

The user approved Phase 3. Catalogue, public preview, search/category filtering, plan selection and checkout review use live published database records. Account, admin, contributor and reader screens establish the approved visual layouts with explicit availability states; they do not simulate authenticated data or implement later-phase actions. No new authentication mechanism or private-content request is added. Phase 4 requires separate approval.

## Phase 4 implementation (3 November 2026)

The user authorized Phase 4. Canonical identity remains auth.users.id. Local-only email/password sign-in uses real Supabase Auth for lifecycle tests; it is not the production login decision. Web3 and wallet associations remain unimplemented. The Phase 5 one-time nonce/replay gate is unchanged.

Development SQL is outside production migrations and installed only in the fixed local Docker database. Edge simulation actions require both a local Supabase URL and SHELF_DEV_ADAPTER=enabled. Production builds omit local sign-in/simulation controls. Development payments are labeled, forbid fabricated chain evidence and cannot change environment. Production evidence constraints remain enforced. Remove this temporary adapter before Phase 6 acceptance.

The shelf-api handler verifies bearer identity. Service-only RPCs handle transactional borrowing, return and chapter authorization. Private delivery proxies bounded, digest-checked plain JSON chapters, rechecks authorization after storage I/O and returns no file URL. Every request checks current database time; expiry denial needs no scheduler. Already delivered text cannot be recalled; this is access control, not DRM.

## Phase 5 approved authentication decision

The user selected email OTP plus verified wallet on 3 November 2026. This supersedes the earlier proposed built-in Web3 login. Supabase email OTP establishes auth.users.id; a separate server-issued, expiring EIP-712 challenge proves Polygon EOA ownership and is consumed atomically. No wallet-only session bridge, synthetic email or anonymous identity is introduced. Private associations and session proofs are not editable profile fields. See docs/decisions/PHASE_5_AUTHENTICATION.md for the implemented boundaries and remaining device gate. Initial account permission was confirmed by the user; Phase 6 requires separate approval.

## Phase 6 authorization and Phase 5 device acceptance

The user authorized Phase 6 and confirmed successful email sign-in, Polygon switching and wallet ownership verification inside Nimiq Pay on Android (latest Play Store version, exact build not supplied). Phase 5 is committed as 4fec5dc. The user supplied the receiving address and approved finalized-block verification; see docs/decisions/PHASE_6_PAYMENTS.md. The remaining Phase 6 gate is controlled actual-device payment acceptance. Stop before Phase 7.

6 November 2026. Android payment acceptance passed for The Quiet Orbit. Phase 7 added production payment checks to both chapter authorizations and tested expiry and return against the production handler. See docs/reports/PHASE_7_COMPLETION_REPORT.md.

6 November 2026. Phase 8 uses existing authenticated Supabase row and bucket policies for the admin workspace. An application decision and contributor registration commit atomically. See docs/reports/PHASE_8_COMPLETION_REPORT.md.
