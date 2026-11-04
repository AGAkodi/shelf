# Shelf

Phase 5 email authentication and Nimiq Pay integration for the Virtual Library Nimiq Pay Mini App. Built with Vite, React, TypeScript, Tailwind CSS, React Router and the Supabase JS client. The approved prototype supplies the dark/violet visual direction and typography; the catalogue UI was implemented in Phase 3.

**Current behavior:** homepage, Explore, book details, public preview and borrowing-plan review read published Supabase catalogue data. Search and category selections survive refresh. Account, reader, admin and contributor screens have explicit availability states. Local-only Auth, simulated checkout, real loans, protected reading, return and expiry are implemented. Email OTP and Nimiq wallet ownership verification are implemented; real payments and admin mutations remain later phases.

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

Read AGENTS.md, PROJECT_SPEC.md and IMPLEMENTATION_PLAN.md before changes. DATABASE_SCHEMA.md, NIMIQ_INTEGRATION.md and TEST_PLAN.md describe implemented database boundaries and deferred integration work. Phase 4 uses the local Supabase runtime. Wallet auth compatibility, content format/rights, receiving wallet and payment finality remain future gates.

## Hosting foundation

`npm run build` creates the Vercel-compatible SPA output. Vercel settings: install `npm ci`, build `npm run build`, output `dist`. `vercel.json` rewrites non-asset paths to index.html for direct route visits. Nothing has been deployed. Do not expose this foundation as a functional paid library; deployment/security/backend setup will be completed in later phases.

Invalid supplied configuration blocks a production build; omitted Supabase settings still allow building the foundation. The Supabase SDK loads only when configuration is valid. A pinned minimatch 11.0.1 override addresses GHSA-g3hv-75wg-m249 in development lint tooling; keep lint/tests green when upgrading it. Fonts are self-hosted with Latin subsets for the current English shell.

## Local database (Phase 2)

The database foundation is now implemented; catalogue routes now read published database data; later-phase operations remain unavailable. See DATABASE_SCHEMA.md for setup, RLS/storage boundaries, original demo seed, generated types and operator admin bootstrap. Run npm run db:start, npm run db:reset, npm run test:db and npm run db:types with Docker Desktop running. Phase 5 is authorized. Stop before Phase 6. Device signing evidence is still required.

## Browse the local catalogue

With Docker and the seeded Supabase stack running, use npm run dev:local. It reads only the local public API URL and anon key into Vite's process environment; no service key enters the browser. Open http://127.0.0.1:5173. Use npm run test:catalogue for real-database desktop/mobile UI tests; npm run test:e2e continues to cover missing-configuration routes. Viem is pinned for server-side EIP-712 verification. CSS covers display each real book's metadata when no public cover image exists; they are not fabricated catalogue entries.

## Local borrowing (Phase 4)

Start Docker Desktop, run npm run db:start and npm run db:reset (deletes local data). In one terminal run npm run dev:adapter; in another run npm run dev:borrowing. Open http://127.0.0.1:5173 and sign in by email code (read the local code at http://127.0.0.1:54324). Select a book and plan, create checkout, simulate payment, open My Library, read and return. No wallet or funds are involved.

The Vite launcher supplies only local public URL/anon configuration. VITE_DEV_BORROWING=enabled enables development controls, which are omitted in production builds. The local Edge launcher sets SHELF_DEV_ADAPTER=enabled in ignored runtime storage; the handler also requires a local Docker URL. Production migrations exclude development SQL. Never deploy the local adapter.

The Edge runtime supplies SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY server-side only. Future hosted setup must set SHELF_ALLOWED_ORIGINS to comma-separated exact frontend origins, leave SHELF_DEV_ADAPTER unset and retain JWT verification. No hosted setup or production login is claimed complete.

With the Edge server running, validate using npm run test:db, npm run test:borrowing, npm run test:borrowing:ui, npm run test:catalogue, npm run test:e2e, npm test, npm run lint, npm run typecheck, npm run typecheck:functions and npm run build. Deno is a development-only checker for the Edge TypeScript entry point; shared handler JavaScript is covered by lint and real HTTP integration tests.

Protected chapters are proxied without public/signed file URLs and use no-store responses. Requests after return/expiry fail; downloaded text cannot be recalled. Production chain verification remains required before the paid MVP can ship.

## Email sign-in and wallet verification (Phase 5)

The user selected email OTP first, then a separately verified Polygon wallet. Built-in Web3 stays disabled. Signatures do not create sessions, transfer funds or activate loans. See docs/decisions/PHASE_5_AUTHENTICATION.md.

With Docker and the migrated local stack running, use npm run dev:wallet. It starts the Edge functions and Vite with the computer's private LAN address. Open the printed Network URL in Nimiq Pay on the same Wi-Fi. Override detection with SHELF_LAN_HOST only if needed. The launcher supplies only the public API URL/anon key to the frontend; it does not enable simulated payment controls.

1. Enter an email and request a code.
2. In the computer's browser open http://127.0.0.1:54324 (Mailpit) to read the captured code. Local Supabase does **not** deliver external email.
3. Enter the six-digit code in Shelf.
4. Connect Nimiq Pay, switch to Polygon if necessary, and select Verify wallet ownership.
5. Approve the typed ownership message. Expect Wallet ownership verified for this Shelf session.

This is a local development HTTP setup, not production authentication hosting. For hosted use: configure Supabase SMTP; enable email confirmation; set six-digit OTP length and 600-second expiry; apply the Token-based confirmation and magic-link templates from supabase/templates/otp.html; deploy wallet-auth with JWT verification enabled; set SHELF_ALLOWED_ORIGINS to exact HTTPS frontend origins. Built-in Ethereum/Solana Web3 stays disabled. Never put service credentials in VITE variables.

Wallet challenges last five minutes, bind the verified OTP user/session, origin, account, purpose and Polygon chain, and can be consumed only once. Private associations permit one wallet per user and prohibit silently replacing it. New sessions require fresh wallet proof. Account/network changes clear displayed proof and invalidate current-session proof/challenges. Recovery and multi-wallet management are not implemented. EOA signatures used by Nimiq Pay are supported; contract-wallet verification is not claimed.

New checks: npm run test:wallet (real Auth/signature/replay/isolation tests) and npm run test:wallet:ui (real email delivery/Auth/Edge with a test-only signing provider). Keep local Edge functions running. Existing database, borrowing, catalogue, route, lint, TypeScript, Deno and build checks still apply.

Initial account permission was confirmed on an actual Nimiq Pay device on 3 November 2026. Full email/Polygon/signature device confirmation and wallet version/OS are pending. No phase-completion commit or production readiness is claimed until that gate passes.
