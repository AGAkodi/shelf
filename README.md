# Shelf

Shelf is a digital book lending marketplace that runs as a **Nimiq Pay Mini App**. Readers browse a catalogue and borrow a book for 3, 7 or 14 days, paying in **USDT on Polygon** through Nimiq Pay. They then read it inside Shelf until the loan expires or they return it. The visual direction is "a library reading room at night":
- near-black neutrals with a faint green tint;
- one brass accent;
- green for active loans;
- book covers rendered as objects;
- a date-due stamp on every loan.

The logo is the green book-stack mark with a brass bookmark (see docs/brand). Type is DM Sans, Playfair Display and Newsreader (for reading). UI craft follows the [unslop](https://github.com/heydamir/unslop) skill by Damir Sokolovsky (CC BY 4.0).

Built with Vite, React 19, TypeScript, Tailwind CSS 4 and React Router. The backend is Supabase (PostgreSQL, Auth, private Storage and Edge Functions). The SPA is hosted on Vercel.

> **Status:** the MVP is implemented and accepted on the local stack. A real Android Nimiq Pay payment was verified independently. Nothing is deployed yet; see [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md). Phase reports are in [docs/reports](docs/reports).

## What it does

**Readers**
- Browse, search and filter by category, with search state kept in the URL. Open a book's details and its public preview.
- Sign in with an **email code**, then prove ownership of a Nimiq Pay Polygon wallet with a one-time EIP-712 signature. Wallet connection alone is never treated as sign-in.
- Borrow on a database-backed plan. The server quotes the exact amount, recipient and wallet. Before prompting, Shelf checks the USDT and POL balances. The reader then approves one USDT transfer in Nimiq Pay.
- Access starts only after the **server independently verifies** the transfer on Polygon: exact token, amount, sender and recipient, after the quote, in a **finalized, canonical** block. Each transaction hash can activate at most one loan.
- Save **favorites** and add **bookmarks** while reading. Bookmarks store a chapter and paragraph position only, never text.
- Read in Shelf, one chapter per server request. Every request rechecks the reader, loan, book, active status, expiry against database time, and a confirmed payment.
- Return a book early, or let it expire, with no refund. See My Library and the transaction history.

**Administrators**
- Create and edit books, set contributor or platform ownership, record distribution rights, and upload covers and private chapters as **DOCX, PDF or chapter-text-v1 JSON**. DOCX and PDF are converted to plain text in the browser.
- Configure per-book plans, publish and unpublish, view loans and payments, track revenue, and approve or reject contributor applications.

**Contributors** apply at /contribute. Approval registers them as contributors. Revenue on contributor-owned books is recorded as **80% contributor / 20% platform**, using integer micro-USDT and `floor(gross × 4 / 5)`. Platform-owned books record 100% to the platform. There are no automatic payouts, and book management stays admin-only in the MVP.

## Architecture

```text
Nimiq Pay WebView ──► Vercel (static SPA, CSP headers)
        │ window.ethereum (native-injected EIP-1193 provider)
        ▼
Supabase ─ Auth (email OTP) ─ PostgreSQL + RLS ─ Storage (covers: public, protected-books: private)
        └─ Edge Functions
             shelf-api           library, return, protected chapter delivery
             wallet-auth         one-time EIP-712 wallet ownership challenges
             payments            quotes, prompt locking, independent Polygon verification
             payments-reconcile  scheduled re-check of submitted transactions
Polygon RPC (server-side, independent of the wallet)
```

- **Payments and loans are separate records.** Activation is one locked SQL transaction, so a repeat never extends a loan.
- **No browser call can activate a loan.** Privileged routines are callable only by the service role.

Details: [DATABASE_SCHEMA.md](DATABASE_SCHEMA.md), [NIMIQ_INTEGRATION.md](NIMIQ_INTEGRATION.md), [docs/decisions](docs/decisions).

| Route | Screen |
| --- | --- |
| `/` | Home |
| `/explore` | Explore and search |
| `/books/:bookId` | Book details, preview, plan choice |
| `/checkout/:bookId?plan=…` | Payment / checkout |
| `/library` | My Library (current loans, history, return) |
| `/read/:loanId` | Protected reader |
| `/transactions` | Payment history |
| `/account` | Email sign-in, Nimiq Pay wallet verification, links |
| `/admin` | Admin dashboard (admin role required) |
| `/contribute` | Contributor application and status |

## Local development

Requirements:
- Node.js ≥ 22.12 (24 LTS recommended) and npm. On Windows, if `npm` isn't on PATH, add `C:\Program Files\nodejs`.
- Docker Desktop with Linux containers, for the local Supabase stack. The Supabase CLI and Deno are installed as project dev dependencies.
- Google Chrome, for the browser test suites.

```sh
npm ci
npm run db:start                   # local Supabase (ports 55320–55329)
npm run db:reset                   # DESTROYS local data: migrations + original demo seed + demo chapters
npm run dev:local                  # Vite at http://127.0.0.1:5173 against the local stack
```

The local stack uses **ports 55320–55329**: API 55321, database 55322, Studio 55323, Mailpit 55324. The CLI defaults (543xx) fell inside a Windows Hyper-V/WinNAT reserved range on the development machine. Local email isn't delivered: read sign-in codes in Mailpit at http://127.0.0.1:55324.

Without any `.env.local`, `npm run dev` serves the UI shell with a "not configured" notice. To point a dev server at a project, copy `.env.example` to `.env.local`. Only browser-public `VITE_` values belong there.

### Local payments and the phone preview

1. Copy `supabase/payments.env.example` to the ignored `supabase/.temp/payments.env`.
2. Set `PAYMENT_RECIPIENT_ADDRESS`, an HTTPS `POLYGON_RPC_URL` with `finalized` support, and a `PAYMENT_RECONCILE_SECRET` of at least 32 characters.
3. Run `npm run dev:wallet`. It starts the Edge functions and Vite on your LAN address, and runs reconciliation every 60 seconds.
4. In **Nimiq Pay → Mini Apps → Custom URL**, open the printed Network URL. The phone must be on the same Wi-Fi.

Payments made this way are **real mainnet USDT** and need POL for gas. Only the account owner should approve them.

### First admin (local)

Sign in once, then run:

```sh
docker exec supabase_db_shelf psql -U postgres -c "insert into public.user_roles(user_id, role) select id, 'admin' from auth.users where email = '<you>' on conflict do nothing;"
```

### Chapter format

Admins can upload DOCX or PDF, which is converted to text. Formatting, images and links are dropped, and scanned PDFs are not supported. They can also upload JSON directly, up to 1 MiB:

```json
{"format":"chapter-text-v1","chapter":1,"title":"Opening","paragraphs":["First paragraph."]}
```

Paragraphs are plain text: at most 1,000 per chapter, 20,000 characters each, and no `<` or `>`. Uploading the same chapter number again replaces it.

## Commands and tests

| Command | What it checks | Needs |
| --- | --- | --- |
| `npm run lint` | ESLint, zero warnings | — |
| `npm run typecheck` | Frontend, config and test TypeScript | — |
| `npm run typecheck:functions` | Deno type checks for all four functions | — |
| `npm test` | Unit tests: config, provider, payments, preflight, chapter import | — |
| `npm run test:payments:unit` | Independent Polygon verifier and release checks (fixtures) | — |
| `npm run test:e2e` | Routes, navigation and provider handling without configuration (Chrome desktop/mobile) | — |
| `npm run test:dist` | Production build under the `vercel.json` headers and CSP | — |
| `npm run build` | Type checks plus the production bundle in `dist/` | — |
| `npm run test:db` | 91 pgTAP checks, plus real Auth/RLS/Storage API tests | Local stack |
| `npm run test:payments:db` | Payment atomicity, replay, prompts, release, protected reading | Local stack + functions |
| `npm run test:wallet` | Email OTP, signature, replay and isolation | Local stack + functions |
| `npm run test:wallet:ui` | Desktop/mobile wallet journeys (test-only signing provider) | Local stack |
| `npm run test:catalogue` | Real-database catalogue UI, desktop/mobile | Local stack |
| `node --test tests/database/admin-ui.test.mjs` | Admin and applicant journey | Local stack |
| `node --test tests/database/chapter-import-ui.test.mjs` | DOCX/PDF import into private storage | Local stack |

`npm run test:db` also runs `supabase/tests/library_features.test.sql` (favorites and bookmarks).

For the suites that need functions, start them first with `npx supabase functions serve --env-file supabase/.temp/payments.env`, or run `npm run dev:wallet`.

Test providers and payment fixtures exist only in tests. Browser payment tests prove UX, not blockchain acceptance. Real acceptance was a controlled Android payment, recorded in the Phase 6 and 12 reports.

## Deployment

See **[docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)**. It covers Supabase project setup, Auth/SMTP/templates, Edge secrets, function deployment, the scheduled reconciliation job, first-admin bootstrap, Vercel settings, the full environment inventory, and the required post-deploy acceptance steps on a real device.

## Security notes

- `VITE_` values are public. Service-role keys, RPC keys and the reconcile secret are server-only, and the build rejects secret-looking Supabase keys.
- Protected chapters are never public. They are served one chapter at a time after per-request checks, with `Cache-Control: private, no-store`. Text already delivered to a device can't be recalled: this is access control, not DRM.
- Unknown wallet outcomes never trigger an automatic resend. Unmatched or late transfers need operator reconciliation, and there are no automatic refunds.
- Dependency notes:
  - `minimatch` is pinned through an override for GHSA-g3hv-75wg-m249.
  - `viem` is pinned to 2.57.14.
  - `pdfjs-dist` is pinned to 6.4.299 and loads only for PDF imports.

## Project documents

[AGENTS.md](AGENTS.md) (engineering rules) · [PROJECT_SPEC.md](PROJECT_SPEC.md) · [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md) · [DATABASE_SCHEMA.md](DATABASE_SCHEMA.md) · [NIMIQ_INTEGRATION.md](NIMIQ_INTEGRATION.md) · [TEST_PLAN.md](TEST_PLAN.md) · [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) · [docs/reports](docs/reports)

## License

Shelf is released under the [MIT License](LICENSE). Copyright (c) 2026 AG Akodi.

Third-party packages keep their own licenses:
- pdf.js is Apache 2.0.
- DM Sans, Playfair Display and Newsreader are SIL Open Font License.
- The design approach credits unslop by Damir Sokolovsky, CC BY 4.0.
