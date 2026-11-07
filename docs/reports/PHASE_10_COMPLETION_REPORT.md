# Phase 10 completion report

7 November 2026. This report completes the Phase 10 checkpoint in PHASE_10_CHECKPOINT_REPORT.md, after development moved from Codex to Claude Code.

1. **Work performed.** Restarted the existing local stack without a reset. The Phase 6 confirmed payment and its active loan were preserved. Recreated the ignored local payment configuration. Reproduced and closed the open desktop wallet verification gate. Measured the CPU cost of wallet-auth. Reran every automated suite.
2. **Files created.** This report.
3. **Files changed.** supabase/config.toml, scripts/dev-wallet.mjs, scripts/lib/local-supabase.mjs and scripts/lib/local-otp.mjs. The local-URL allowlists in the shelf-api, wallet-auth and payments entry points also changed. These all moved local ports from 54320–54329 to 55320–55329. Docs were updated in README, AGENTS, PROJECT_SPEC, NIMIQ_INTEGRATION and IMPLEMENTATION_PLAN to correct stale phase status.
4. **Database changes.** None. All nine migrations were already applied locally, and the audit migration came from the checkpoint commit.
5. **Tests performed.** All of these passed:
   - The desktop and mobile wallet journeys (`test:wallet:ui`) passed three consecutive runs each.
   - Wallet API security: 11 tests.
   - pgTAP: 91 checks.
   - Auth/RLS/Storage API: 13 tests.
   - Payment database tests: 11.
   - Verifier: 18 cases.
   - Unit: 38 tests.
   - Catalogue browser: 10 tests.
   - Route/provider browser: 30 tests.
   - The mobile admin/applicant journey.
6. **Build/type results.** ESLint, frontend TypeScript, Deno checks for all four functions and the production build passed.
7. **Problems discovered.**
   - **Reserved ports.** Windows Hyper-V/WinNAT reserved TCP 54102–54801 on this machine. Docker started the containers without publishing ports, so Auth, API, Edge and Mailpit were unreachable from the host.
   - **CPU cost of wallet-auth.** Each cold wallet-auth isolate spends 0.4–2.9 s loading viem's utils barrel. The signature check itself takes about 10 ms. The local runtime logs "CPU time soft limit reached" and recycles the worker after it responds.
8. **Fixes.**
   - **Ports.** Moved the local ports to 55320–55329 at the user's direction. The non-local target refusal in local-supabase.mjs is kept, with the new exact port.
   - **CPU cost.** No code change. An ox-based verifier was measured at a similar 0.33–0.46 s load cost, so replacing security-critical verification code was not justified.
   - **Earlier failure.** The checkpoint's desktop failure (HTTP 546, hard CPU kills) did not recur. All runs had zero hard-limit terminations and zero 546 responses.
9. **Limitations.**
   - **Hosted CPU risk.** Soft CPU-limit recycling of wallet-auth remains. Its effect on hosted Supabase Edge CPU limits must be measured on the deployed project (Phase 12/13). If hosted verification fails there, move signature verification to a lighter dedicated verifier.
   - **Simulated payments.** Browser payment broadcasts are simulated. No real funds moved in this phase.
   - **Historical test not run.** tests/database/borrowing.test.mjs covers the historical Phase 4 development adapter. It needs the separately installed development SQL and was not run.
   - **Missing security headers.** vercel.json still lacks CSP and security headers. These belong to the Phase 13 deployment package.
10. **Acceptance.** Passed on the local stack. Phase 11 requires separate approval.
