# Shelf

Phase 1 application foundation for the Virtual Library Nimiq Pay Mini App. Built with Vite, React, TypeScript, Tailwind CSS, React Router and the Supabase JS client. The approved prototype supplies the dark/violet visual direction and typography; the complete UI belongs to Phase 3.

**Current behavior:** all requested routes render honest placeholders. There is no catalogue, login, database schema, borrowing adapter, protected reader, payment or wallet integration. Admin is a placeholder with no data/actions, not an authorization implementation. The previously installed Mini App SDK is retained but unused.

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

All `VITE_` values are browser-public. Never put server credentials, private keys or RPC secrets in them. Missing/invalid settings show a nonfatal configuration notice and create no Supabase client. Configured means structurally valid configuration, not a verified live connection. The foundation performs no database queries or wallet requests. Origin-only URLs must not contain credentials, query strings, fragments or paths.

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

Unknown routes render a not-found screen. Dynamic IDs are route parameters only; they do not fetch or authorize data in this phase. Route modules load lazily with a loading fallback; route-level and root error boundaries offer recovery without exposing error internals. Navigation includes mobile disclosure, keyboard focus, skip link and route titles.

## Structure and next phases

- `src/app`: router, service context and error boundaries.
- `src/components`: reusable layout and loading/error/placeholder states.
- `src/pages`: individual lazy route modules.
- `src/lib/config`: public environment validation.
- `src/lib/supabase`: client factory with no fake credentials.
- `src/styles`: shared design tokens, Tailwind and responsive shell.
- `tests`: unit and browser foundation checks.
- `docs/reports`: phase completion evidence.

Read AGENTS.md, PROJECT_SPEC.md and IMPLEMENTATION_PLAN.md before changes. DATABASE_SCHEMA.md, NIMIQ_INTEGRATION.md and TEST_PLAN.md capture future boundaries; they do not claim implementation. Phase 2 requires separate approval and a working Supabase runtime. Wallet auth compatibility, content format/rights, receiving wallet and payment finality remain future gates.

## Hosting foundation

`npm run build` creates the Vercel-compatible SPA output. Vercel settings: install `npm ci`, build `npm run build`, output `dist`. `vercel.json` rewrites non-asset paths to index.html for direct route visits. Nothing has been deployed. Do not expose this foundation as a functional paid library; deployment/security/backend setup will be completed in later phases.

Invalid supplied configuration blocks a production build; omitted Supabase settings still allow building the foundation. The Supabase SDK loads only when configuration is valid. A pinned minimatch 11.0.1 override addresses GHSA-g3hv-75wg-m249 in development lint tooling; keep lint/tests green when upgrading it. Fonts are self-hosted with Latin subsets for the current English shell.
