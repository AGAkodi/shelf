# Shelf

Phase 3 catalogue UI and database foundation for the Virtual Library Nimiq Pay Mini App. Built with Vite, React, TypeScript, Tailwind CSS, React Router and the Supabase JS client. The approved prototype supplies the dark/violet visual direction and typography; the complete UI belongs to Phase 3.

**Current behavior:** homepage, Explore, book details, public preview and borrowing-plan review read published Supabase catalogue data. Search and category selections survive refresh. Account, reader, admin and contributor screens have explicit availability states. No login, borrowing, wallet, payment, protected reading or admin mutations are implemented.

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

Unknown routes render a not-found screen. Book IDs select published records; loan IDs never authorize or fetch protected content in Phase 3. Route modules load lazily with a loading fallback; route-level and root error boundaries offer recovery without exposing error internals. Navigation includes mobile disclosure, keyboard focus, skip link and route titles.

## Structure and next phases

- `src/app`: router, service context and error boundaries.
- `src/components`: reusable layout and loading/error/placeholder states.
- `src/pages`: individual lazy route modules.
- `src/lib/config`: public environment validation.
- `src/lib/supabase`: client factory with no fake credentials.
- `src/styles`: shared design tokens, Tailwind and responsive shell.
- `tests`: unit and browser foundation checks.
- `docs/reports`: phase completion evidence.

Read AGENTS.md, PROJECT_SPEC.md and IMPLEMENTATION_PLAN.md before changes. DATABASE_SCHEMA.md, NIMIQ_INTEGRATION.md and TEST_PLAN.md describe implemented database boundaries and deferred integration work. Phase 2 is authorized and uses the local Supabase runtime. Wallet auth compatibility, content format/rights, receiving wallet and payment finality remain future gates.

## Hosting foundation

`npm run build` creates the Vercel-compatible SPA output. Vercel settings: install `npm ci`, build `npm run build`, output `dist`. `vercel.json` rewrites non-asset paths to index.html for direct route visits. Nothing has been deployed. Do not expose this foundation as a functional paid library; deployment/security/backend setup will be completed in later phases.

Invalid supplied configuration blocks a production build; omitted Supabase settings still allow building the foundation. The Supabase SDK loads only when configuration is valid. A pinned minimatch 11.0.1 override addresses GHSA-g3hv-75wg-m249 in development lint tooling; keep lint/tests green when upgrading it. Fonts are self-hosted with Latin subsets for the current English shell.

## Local database (Phase 2)

The database foundation is now implemented; catalogue routes now read published database data; later-phase operations remain unavailable. See DATABASE_SCHEMA.md for setup, RLS/storage boundaries, original demo seed, generated types and operator admin bootstrap. Run npm run db:start, npm run db:reset, npm run test:db and npm run db:types with Docker Desktop running. Phase 3 is approved; Phase 4 requires separate approval. Wallet authentication is deferred under the explicit Phase 5 security gate.

## Browse the local catalogue

With Docker and the seeded Supabase stack running, use npm run dev:local. It reads only the local public API URL and anon key into Vite's process environment; no service key enters the browser. Open http://127.0.0.1:5173. Use npm run test:catalogue for real-database desktop/mobile UI tests; npm run test:e2e continues to cover missing-configuration routes. No extra runtime dependencies were added. CSS covers display each real book's metadata when no public cover image exists; they are not fabricated catalogue entries.
