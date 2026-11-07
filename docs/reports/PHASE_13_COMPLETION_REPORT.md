# Phase 13 completion report

7 November 2026. Scope: an actionable Vercel/Supabase deployment package, deployment/test/demo documentation and an accurate README and environment inventory. Nothing was deployed. No hosting is claimed.

1. **Implemented.**
   - **Security headers.** `vercel.json` now sends a Content-Security-Policy, `nosniff`, `X-Frame-Options: DENY`, Referrer-Policy, Permissions-Policy, HSTS and COOP. It also sets immutable caching for hashed assets and `no-cache` for the HTML shell, with the existing SPA rewrite kept.
   - **CSP sources.** The policy was derived from the official Nimiq Pay source:
     - The provider is injected natively before page scripts run, so `script-src 'self'` holds.
     - Mini apps load top-level in their own WebView, so `frame-ancestors 'none'` holds.
     - The provider makes RPC fetches from the page to host-configurable endpoints, so `connect-src 'self' https:` is required.
   - **docs/DEPLOYMENT.md**, covering:
     - prerequisites, Supabase link and `db push` (migrations only, no seed or development SQL);
     - Auth, OTP and SMTP settings and the email templates;
     - the Edge secrets, with exact names, and function deployment;
     - a `pg_cron` + `pg_net` + Vault reconciliation job;
     - first-admin bootstrap, Vercel settings and variables, and Nimiq Pay testing;
     - a nine-step post-deploy acceptance checklist on a real device;
     - rollback, backups, stuck-checkout handling and secret rotation;
     - the full environment inventory.
   - **README.md** rewritten to describe the current app accurately. The phase history stays in the reports.
   - **Local header test.** `npm run serve:dist` and `npm run test:dist` test the production build under the real headers.
2. **Files created.** docs/DEPLOYMENT.md, scripts/serve-dist.mjs, playwright.dist.config.ts, tests/dist/headers.spec.ts and this report.
3. **Files changed.** vercel.json, README.md, TEST_PLAN.md, .env.example (doc pointer), package.json (two scripts) and .gitignore. The `dist/` rule now matches only the root build output; it had been hiding `tests/dist/`.
4. **Database changes.** None.
5. **Tests performed.**
   - **Header test (`test:dist`), 6 passing on desktop and mobile Chrome.** The production build was served with the exact `vercel.json` headers:
     - all ten routes return the CSP and security headers, with no CSP violations and the self-hosted fonts loading;
     - hashed assets are immutable;
     - the PDF worker starts under `worker-src`;
     - `connect-src` blocks plain HTTP and allows HTTPS.
   - **Other suites, all passing:**
     - Lint, TypeScript and Deno checks.
     - Unit: 57. Verifier: 25. Route/provider browser: 30.
     - Production build.
   - **Secrets scan.** The staged tree and the build contain no secret keys, JWTs, private keys or reconcile secrets.
   - **Database suites not rerun.** This phase changed no application or database code. They last passed on the same source, as recorded in the chapter import report.
6. **Build/type checks.** Passed.
7. **Problems discovered.** The `.gitignore` `dist/` rule excluded `tests/dist`. The provider's in-page RPC fetches rule out a fixed `connect-src` allowlist.
8. **Problems fixed.** Anchored the ignore rule. Documented and tested the CSP choices.
9. **Limitations.** These still need the operator's accounts and a real deployment:
   - Vercel and Supabase projects, the custom domain, SMTP and scheduler runs.
   - Confirming the CSP inside Nimiq Pay on the deployed HTTPS site.
   - Measuring wallet-auth cold-start CPU on hosted Edge.
   - Gateway acceptance of the scheduler's Authorization header on projects that have only new-style keys.
   - A hosted real-payment acceptance run.
   - Nimiq Mini Apps directory listing, which has no documented self-service process.
10. **Acceptance.** The deployment package passes its local gates: lint, types, tests, build and an actionable guide. Deployment itself is not claimed. The post-deploy checklist in docs/DEPLOYMENT.md must pass on the hosted site before launch.
