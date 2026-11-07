# Shelf

Phase 6 Polygon USDT checkout and Nimiq Pay integration for the Virtual Library Nimiq Pay Mini App. Built with Vite, React, TypeScript, Tailwind CSS, React Router and the Supabase JS client. The approved prototype supplies the dark/violet visual direction and typography; the catalogue UI was implemented in Phase 3.

**Current behavior:** homepage, Explore, book details, public preview and borrowing-plan review read published Supabase catalogue data. Search and category selections survive refresh. Account, reader, admin and contributor screens have explicit availability states. Email OTP, verified wallet sessions, real payment request/independent verification, loans, protected reading, return and expiry are implemented. Phase 6 real-payment device acceptance passed on Android. The admin dashboard (Phase 8), contributor applications (Phase 9) and the security audit (Phase 10) are complete on the local stack. Nothing is deployed yet. Development payment completion is disabled in the production entry point.

**Local ports:** the local Supabase stack uses ports 55320–55329 (API 55321, database 55322, Studio 55323, Mailpit 55324). The CLI defaults 54320–54329 fall inside a Windows Hyper-V/WinNAT reserved range on the development machine, so Docker could not publish them.

## Develop

Use a supported Node.js version >=22.12 (Node 24 LTS recommended) and npm. From the repository root:

```sh
npm ci
npm run dev
```

Open http://localhost:5173. Vite also listens on your LAN on port 5173 for later device testing. On Windows if npm is not on PATH, add `C:\Program Files\nodejs` to PATH or use npm.cmd there. Restrict development access to trusted networks.

No environment file is required to inspect the shell. To configure the Supabase client later, copy `.env.example` to `.env.local`, then restart Vite:

| Variable | Meaning |
| --- | --- |
| VITE_SUPABASE_URL | Supabase project origin, normally HTTPS. Local/private LAN HTTP is accepted only in development. |
| VITE_SUPABASE_PUBLISHABLE_KEY | Public `sb_publishable_...` key or legacy anon JWT. Never a secret/service-role key. |
| VITE_APP_URL | Optional canonical application origin. Leave blank to use the current browser origin in future features. |

All `VITE_` values are browser-public. Never put server credentials, private keys or RPC secrets in them. Missing/invalid settings show a nonfatal configuration notice and create no Supabase client. Configured means structurally valid configuration, not a verified live connection. The catalogue queries public books and enabled borrowing plans. There are no wallet requests. Origin-only URLs must not contain credentials, query strings, fragments or paths.

## Commands

```sh
npm run dev        # LAN-accessible Vite development server, port 5173
npm run lint       # ESLint, zero warnings allowed
npm run typecheck  # TypeScript app/config/test checks
npm test           # Configuration and boundary unit tests
npm run test:e2e   # Actual Chrome desktop/mobile route/navigation smoke tests
npm run build      # TypeScript checks and production bundle in dist/
npm run preview    # Local production preview, port 4173
```

Browser tests use an installed Google Chrome by default, including mobile viewport emulation. If Chrome is unavailable, install it or adjust the Playwright project channel and install the corresponding browser. Mobile emulation is not Nimiq Pay device verification. Test artifacts, dependencies and build outputs are ignored by Git.

## Routes

| URL | Screen |
| --- | --- |
| / | Homepage |
| /explore | Explore |
| /books/:bookId | Book Details |
| /checkout/:bookId | Payment / Checkout |
| /library | My Library |
| /read/:loanId | Reading Interface |
| /transactions | Transactions |
| /admin | Admin Dashboard |
| /contribute | Contributor Application |

Unknown routes render a not-found screen. Book IDs select published records; loan IDs require authenticated ownership, matching book, active status and unexpired access for every protected request. Route modules load lazily with a loading fallback; route-level and root error boundaries offer recovery without exposing error internals. Navigation includes mobile disclosure, keyboard focus, skip link and route titles.

## Structure and next phases

- `src/app`: router, service context and error boundaries.
- `src/components`: reusable layout and loading/error/placeholder states.
- `src/pages`: individual lazy route modules.
- `src/lib/config`: public environment validation.
- `src/lib/supabase`: client factory with no fake credentials.
- `src/styles`: shared design tokens, Tailwind and responsive shell.
- `tests`: unit and browser foundation checks.
- `docs/reports`: phase completion evidence.

Read AGENTS.md, PROJECT_SPEC.md and IMPLEMENTATION_PLAN.md before changes. DATABASE_SCHEMA.md, NIMIQ_INTEGRATION.md and TEST_PLAN.md describe implemented database boundaries and deferred integration work. Phase 4 uses the local Supabase runtime. Remaining gates are hosted deployment, licensed catalogue content and full device acceptance journeys.

## Hosting foundation

`npm run build` creates the Vercel-compatible SPA output. Vercel settings: install `npm ci`, build `npm run build`, output `dist`. `vercel.json` rewrites non-asset paths to index.html for direct route visits. Nothing has been deployed. Do not expose this foundation as a functional paid library; deployment/security/backend setup will be completed in later phases.

Invalid supplied configuration blocks a production build; omitted Supabase settings still allow building the foundation. The Supabase SDK loads only when configuration is valid. A pinned minimatch 11.0.1 override addresses GHSA-g3hv-75wg-m249 in development lint tooling; keep lint/tests green when upgrading it. Fonts are self-hosted with Latin subsets for the current English shell.

## Local database (Phase 2)

The database foundation is now implemented; catalogue routes now read published database data; later-phase operations remain unavailable. See DATABASE_SCHEMA.md for setup, RLS/storage boundaries, original demo seed, generated types and operator admin bootstrap. Run npm run db:start, npm run db:reset, npm run test:db and npm run db:types with Docker Desktop running.
## Browse the local catalogue

With Docker and the seeded Supabase stack running, use npm run dev:local. It reads only the local public API URL and anon key into Vite's process environment; no service key enters the browser. Open http://127.0.0.1:5173. Use npm run test:catalogue for real-database desktop/mobile UI tests; npm run test:e2e continues to cover missing-configuration routes. Viem is pinned for server-side EIP-712 verification. CSS covers display each real book's metadata when no public cover image exists; they are not fabricated catalogue entries.

## Email sign-in and wallet verification (Phase 5)

The user selected email OTP first, then a separately verified Polygon wallet. Built-in Web3 stays disabled. Signatures do not create sessions, transfer funds or activate loans. See docs/decisions/PHASE_5_AUTHENTICATION.md.

With Docker and the migrated local stack running, use npm run dev:wallet. It starts the Edge functions and Vite with the computer's private LAN address. Open the printed Network URL in Nimiq Pay on the same Wi-Fi. Override detection with SHELF_LAN_HOST only if needed. The launcher supplies only the public API URL/anon key to the frontend; it does not enable simulated payment controls.

1. Enter an email and request a code.
2. In the computer's browser open http://127.0.0.1:55324 (Mailpit) to read the captured code. Local Supabase does **not** deliver external email.
3. Enter the six-digit code in Shelf.
4. Connect Nimiq Pay, switch to Polygon if necessary, and select Verify wallet ownership.
5. Approve the typed ownership message. Expect Wallet ownership verified for this Shelf session.

This is a local development HTTP setup, not production authentication hosting. For hosted use: configure Supabase SMTP; enable email confirmation; set six-digit OTP length and 600-second expiry; apply the Token-based confirmation and magic-link templates from supabase/templates/otp.html; deploy wallet-auth with JWT verification enabled; set SHELF_ALLOWED_ORIGINS to exact HTTPS frontend origins. Built-in Ethereum/Solana Web3 stays disabled. Never put service credentials in VITE variables.

Wallet challenges last five minutes, bind the verified OTP user/session, origin, account, purpose and Polygon chain, and can be consumed only once. Private associations permit one wallet per user and prohibit silently replacing it. New sessions require fresh wallet proof. Account/network changes clear displayed proof and invalidate current-session proof/challenges. Recovery and multi-wallet management are not implemented. EOA signatures used by Nimiq Pay are supported; contract-wallet verification is not claimed.

New checks: npm run test:wallet (real Auth/signature/replay/isolation tests) and npm run test:wallet:ui (real email delivery/Auth/Edge with a test-only signing provider). Keep local Edge functions running. Existing database, borrowing, catalogue, route, lint, TypeScript, Deno and build checks still apply.

Initial account permission was confirmed on an actual Nimiq Pay device on 3 November 2026. Email/Polygon/signature ownership verification was subsequently confirmed by the user on Android, latest Play Store release (exact version not supplied). Phase 5 commit: 4fec5dc.

## Polygon payments (Phase 6)

Real USDT transfers use Nimiq Pay's injected EVM provider. The server quotes the database plan and verified wallet, checks a separate Polygon RPC and requires a matching canonical finalized receipt before atomic activation. Transaction hashes are globally unique; repeats do not extend loans. An unknown outcome never automatically resends funds. Failed finalized transactions cancel the pending loan; network/verification errors stay unresolved. There are no automatic refunds or contributor payouts.

Apply migrations with `npx supabase migration up`. The production shelf-api always disables development completion, regardless of SHELF_DEV_ADAPTER. Phase 4 simulation tests/tools are historical, not the Phase 6 checkout. Run the current checks below instead.

Copy `supabase/payments.env.example` to ignored `supabase/.temp/payments.env` for local testing. Set server-only PAYMENT_RECIPIENT_ADDRESS to the approved receiving address; POLYGON_RPC_URL to an HTTPS Polygon endpoint supporting finalized blocks; PAYMENT_RECONCILE_SECRET to at least 32 random characters. `npm run dev:wallet` loads this file into Edge functions and schedules local reconciliation every 60 seconds. It never passes these settings to Vite. The public endpoint https://polygon-bor-rpc.publicnode.com was checked for chain 137, finalized blocks and deployed token code; hosted use should use a monitored RPC suitable for its traffic.

For hosted Supabase, configure those three Edge secrets plus SHELF_ALLOWED_ORIGINS (exact HTTPS origins), deploy payments and payments-reconcile with JWT verification enabled alongside shelf-api/wallet-auth, and schedule a POST to `/functions/v1/payments-reconcile` every minute from a trusted scheduler. Send the project anon JWT as Authorization Bearer and apikey, plus the server-only x-shelf-reconcile secret. Never embed service-role keys or reconciliation secrets in the frontend. The worker processes at most ten eligible pending candidates per invocation; it makes no wallet sends. No hosted scheduler is claimed configured by local implementation.

Current checks: `npm run lint`, `npm run typecheck`, `npm run typecheck:functions`, `npm test`, `npm run test:payments:unit`, `npm run test:payments:db`, `npm run test:db`, `npm run test:wallet`, `npm run test:wallet:ui`, `npm run test:catalogue`, `npm run test:e2e`, `npm run build`. Database/API/browser suites need the local migrated stack and Edge functions. Browser payment fixtures test UX only; they are not blockchain evidence.

Device acceptance: sign in and verify the Polygon wallet, choose an original demo book and enabled plan, inspect the quoted amount and recipient, then approve Pay USDT in Nimiq Pay. This is real mainnet USDT and requires POL for gas; only the user approves the controlled test. Confirm finalized verification, My Library access and transaction history, then return the book and confirm denied access. Record the transaction hash for independent inspection. Phase 6 is not complete until that real flow passes.

## Admin dashboard

Open /admin and sign in by email with an account that has the database admin role. A trusted operator assigns that role using the first-admin procedure in DATABASE_SCHEMA.md. Wallet verification applies to borrowing. The dashboard uses the signed-in user's database and Storage policies.

Create a draft, enter the rights holder and permission evidence, upload chapter 1, enable a borrowing plan, and publish. Each chapter upload accepts a UTF-8 JSON file up to 1 MiB. Use this shape with the desired chapter number. Uploading that number again replaces its current chapter mapping.

```json
{"format":"chapter-text-v1","chapter":1,"title":"Opening","paragraphs":["First paragraph."]}
```

Confirmed revenue uses stored production payment splits in USDT. Pending quotes appear in the payments list and contribute zero to the totals. Approving an application registers the contributor in the same database transaction. Run the browser regression with Docker and local Supabase running using `node --test tests/database/admin-ui.test.mjs`.
