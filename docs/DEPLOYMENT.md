# Deploying Shelf

Shelf is a static Vite single-page app on **Vercel** and a **Supabase** project. Supabase provides PostgreSQL, Auth, Storage and four Edge Functions. Nothing has been deployed by the development agent. Every hosted step below is for an operator with their own Vercel and Supabase accounts. Items marked **Verify on hosted** could not be checked locally.

Use separate Supabase projects for staging and production. Never run the local test suites against a hosted project; the Node test harness refuses non-local targets.

## 1. Prerequisites

- **Node.js 22.12+** (Node 24 LTS recommended), npm and Git. Run `npm ci` in the repository.
- **Supabase** account with the CLI: use the project-local one via `npx supabase`, version 3.0.0, pinned.
- **Vercel** account, connected to the Git repository.
- **Polygon RPC** HTTPS endpoint that supports the `finalized` block tag. Use a monitored, rate-limited provider for production. https://polygon-bor-rpc.publicnode.com passed the chain, finalized-block and token checks, but it is a public endpoint without guarantees.
- **SMTP provider** for real email delivery. Supabase's built-in email is rate-limited and not for production.
- **Merchant address.** The approved Polygon recipient is `0x46a32BBB4cf751dfeEa222E1ceD2813f229D1FD5`, set as a server secret. Replace it only through an explicit operator decision.

## 2. Supabase project

1. Create the project and note its **project ref** and **URL** (`https://<ref>.supabase.co`).
2. Link and push the schema. This applies `supabase/migrations/*` only: no seed data and no development SQL.
   ```sh
   npx supabase login
   npx supabase link --project-ref <ref>
   npx supabase db push
   ```
   The migrations create all tables, RLS policies, service-only functions and both storage buckets: public `covers` and private `protected-books`. **Never** apply `supabase/development/adapter.sql` or `supabase/seed.sql` to a hosted project. The demo books and the storage seeding script are for local development only, so a hosted catalogue starts empty.
3. **Auth settings** (Dashboard → Authentication):
   - Enable the email provider and email confirmations. Set **OTP length 6** and **OTP expiry 600 s**.
   - Leave password sign-in unused. The approved flow is the email code, and the functions require an OTP session.
   - Keep **Web3 (Ethereum/Solana) sign-in disabled**.
   - Set **Site URL** to the production origin, e.g. `https://shelf.example.com`. Leave redirect URLs empty unless magic links are adopted later.
   - **Email templates:** paste the body of `supabase/templates/otp.html` into both the *Magic Link* and *Confirm signup* templates, subject "Your Shelf sign-in code". The template shows the 6-digit `{{ .Token }}`.
   - **SMTP:** configure your provider under Authentication → SMTP settings.
4. **Edge Function secrets.** `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are provided by the platform. Never set them by hand or expose them.
   ```sh
   npx supabase secrets set \
     PAYMENT_RECIPIENT_ADDRESS=0x46a32BBB4cf751dfeEa222E1ceD2813f229D1FD5 \
     POLYGON_RPC_URL=https://<your-polygon-rpc> \
     PAYMENT_RECONCILE_SECRET=<at least 32 random characters> \
     SHELF_ALLOWED_ORIGINS=https://shelf.example.com
   ```
   - `SHELF_ALLOWED_ORIGINS` is a comma-separated list of **exact HTTPS origins**, with no paths or trailing slashes. Hosted functions reject every other origin, including HTTP and LAN addresses.
   - Generate the reconcile secret with `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`.
5. **Deploy the functions** with JWT verification on. That is the default, and `supabase/config.toml` sets it explicitly for `shelf-api`, `wallet-auth` and `payments`.
   ```sh
   npx supabase functions deploy shelf-api wallet-auth payments payments-reconcile
   ```
   The production `shelf-api` entry point always disables the development payment adapter, whatever the environment.
6. **Scheduled reconciliation.** Every minute, a trusted caller must POST to `payments-reconcile` with the anon key and the reconcile secret. The worker only re-checks pending payments that already have a submitted transaction hash, at most ten per run. It never sends funds. In the SQL editor, with `pg_cron` and `pg_net` enabled under Database → Extensions:
   ```sql
   select vault.create_secret('<PAYMENT_RECONCILE_SECRET>', 'shelf_reconcile_secret');
   select vault.create_secret('<project anon key JWT>', 'shelf_anon_key');
   select cron.schedule('shelf-payments-reconcile', '* * * * *', $$
     select net.http_post(
       url := 'https://<ref>.supabase.co/functions/v1/payments-reconcile',
       headers := jsonb_build_object(
         'Content-Type', 'application/json',
         'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'shelf_anon_key'),
         'apikey', (select decrypted_secret from vault.decrypted_secrets where name = 'shelf_anon_key'),
         'x-shelf-reconcile', (select decrypted_secret from vault.decrypted_secrets where name = 'shelf_reconcile_secret')),
       body := '{}'::jsonb,
       timeout_milliseconds := 45000);
   $$);
   ```
   **Verify on hosted:**
   - `select * from cron.job_run_details order by start_time desc limit 5;` should show successful runs.
   - The function logs should show HTTP 200.
   - If your project uses only the new `sb_publishable_` keys, confirm the gateway accepts the scheduler's Authorization header. If it doesn't, use the legacy anon JWT from Project Settings → API.
7. **First administrator.** Sign in once through the deployed app with the operator's email. Then grant the role in the SQL editor, after checking the UUID belongs to the intended person:
   ```sql
   select id, email from auth.users where email = '<operator email>';
   insert into public.user_roles(user_id, role) values ('<that uuid>'::uuid, 'admin')
   on conflict (user_id, role) do nothing;
   ```
   Never expose role assignment through the app. Contributor approval never grants admin.

## 3. Vercel project

| Setting | Value |
| --- | --- |
| Framework preset | Vite |
| Install command | `npm ci` |
| Build command | `npm run build` |
| Output directory | `dist` |
| Node.js version | 22.x or 24.x |

Environment variables (Production, and Preview pointing at the staging project). All are browser-public:

| Variable | Value |
| --- | --- |
| `VITE_SUPABASE_URL` | `https://<ref>.supabase.co` |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | The project's `sb_publishable_…` key, or the legacy anon JWT. **Never** a secret or service-role key; the build refuses those. |
| `VITE_APP_URL` | Optional canonical origin, e.g. `https://shelf.example.com` |

Do not set `VITE_DEV_BORROWING`. It only works in local development builds.

`vercel.json` provides:
- **SPA rewrites** for direct route visits.
- **Long-lived caching** for hashed `/assets/*`, and `no-cache` for the HTML shell.
- **Security headers:** CSP, `nosniff`, `X-Frame-Options: DENY`, Referrer-Policy, Permissions-Policy, HSTS and COOP.

About the CSP:
- **Scripts:** `script-src 'self'`.
- **Network:** `connect-src 'self' https:`, because Nimiq Pay's injected provider makes RPC requests from the page to endpoints the host can change at runtime.
- **Images:** `img-src 'self' data: blob: https:`, for Supabase cover images.
- **Workers:** `worker-src 'self' blob:`, for the PDF import worker.
- **Framing:** `frame-ancestors 'none'`.

The headers are tested locally against the production build by `npm run test:dist`.

Add your custom domain in Vercel, then use that exact origin in `SHELF_ALLOWED_ORIGINS` and the Auth Site URL.

## 4. Nimiq Pay

Mini apps load top-level in Nimiq Pay's WebView, and the wallet providers are injected natively before page scripts run. To test, enter the HTTPS URL in Nimiq Pay → Mini Apps → Custom URL. Shelf has no documented self-service listing process, so ask Nimiq about publishing in the Mini Apps directory.

## 5. Post-deploy acceptance (required before announcing)

Run these on the deployed HTTPS URL, inside Nimiq Pay on a phone:

1. **Headers.** `curl -sI https://shelf.example.com/explore` shows the CSP and the other headers.
2. **Wallet under CSP.** Open the app in Nimiq Pay, connect, switch to Polygon and verify wallet ownership. If the wallet fails only on the deployed site, temporarily rename the header to `Content-Security-Policy-Report-Only` in `vercel.json`, redeploy, read the console violation, and adjust the policy. Don't simply remove it.
3. **Wallet-auth CPU.** Locally, a cold wallet-auth worker spent 0.4–2.9 s loading its signature library (see PHASE_10_COMPLETION_REPORT.md). Verify ownership 3–5 times after idle periods and check the function logs for CPU-limit or 546 errors. If they appear, report them: verification needs a lighter verifier before launch.
4. **Email.** The sign-in code arrives through your SMTP provider within a minute.
5. **Admin.** Create a book, upload a cover and a chapter (DOCX, PDF or JSON), record rights, add a plan, publish it and see it on Explore.
6. **Real payment.** Borrow it for the smallest plan with a real USDT payment, as the operator, with funds they approve. Confirm **Payment verified**, reading, Transactions and the payments/revenue admin view. Check the transaction on a Polygon explorer.
7. **Scheduler.** Close the app right after approving a payment, wait two minutes, and confirm the cron run reconciled it.
8. **Return.** Return the loan and confirm reading is denied.
9. **Origin rejection.** A request from any other origin is rejected:
   ```sh
   curl -s -o /dev/null -w "%{http_code}" -X OPTIONS -H "Origin: https://evil.example" https://<ref>.supabase.co/functions/v1/payments
   ```
   It should print 403.

## 6. Operations

- **Rollback.** For the frontend, use Vercel's *Instant Rollback* to a previous deployment. For functions, check out the previous commit and run `supabase functions deploy`. Migrations are forward-only: write a new corrective migration and never edit an applied one.
- **Backups.** Enable Supabase point-in-time recovery or daily backups for production before taking real payments.
- **Stuck checkouts.** A reader can restart a wallet request that produced no transaction after 15 minutes, once the server confirms on Polygon that nothing was sent. The check only looks back 50,000 blocks, about one day. Older cases need an operator to:
  1. Check the sender's history on a Polygon explorer.
  2. If nothing was sent, cancel the payment and loan in SQL.
  3. If something was sent, verify it with its hash.
- **No automatic refunds or contributor payouts.** Contributor shares (80%) are accounting records. Settle them outside Shelf.
- **Secrets rotation.** `npx supabase secrets set PAYMENT_RECONCILE_SECRET=…`, then update the Vault secret in the same maintenance window.
- **Logs.** Supabase → Edge Functions → Logs, and Database → cron job runs. Functions never log chapter contents, and responses use `Cache-Control: private, no-store`.

## 7. Environment inventory

| Name | Where | Secret | Purpose |
| --- | --- | --- | --- |
| `VITE_SUPABASE_URL` | Vercel / `.env.local` | No | Supabase project origin (HTTPS, or local HTTP in dev only) |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Vercel / `.env.local` | No | Publishable or anon key; secret keys are refused |
| `VITE_APP_URL` | Vercel / `.env.local` | No | Optional canonical origin |
| `VITE_DEV_BORROWING` | Local dev only | No | Historical Phase 4 simulation; ignored by production builds |
| `SUPABASE_URL` | Edge (platform) | No | Provided by Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | Edge (platform) | **Yes** | Provided by Supabase; never in the frontend |
| `PAYMENT_RECIPIENT_ADDRESS` | Edge secret | No (sensitive config) | Merchant Polygon address quoted to readers |
| `POLYGON_RPC_URL` | Edge secret | **Yes** if it contains an API key | Independent HTTPS Polygon RPC with `finalized` support |
| `PAYMENT_RECONCILE_SECRET` | Edge secret + Vault | **Yes** | Authenticates the scheduled reconciliation caller (≥ 32 chars) |
| `SHELF_ALLOWED_ORIGINS` | Edge secret | No | Exact HTTPS frontend origins, comma-separated |
| `SHELF_LAN_HOST` | Local dev only | No | Overrides LAN address detection in `npm run dev:wallet` |
| `SHELF_USE_LOCAL_PREVIEW` | Local tests only | No | Reuse a running Vite server in the wallet browser suite |
| `SHELF_DIST_PORT` | Local tests only | No | Port for `npm run serve:dist` (default 4174) |
