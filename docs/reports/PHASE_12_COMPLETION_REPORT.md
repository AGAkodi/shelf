# Phase 12 completion report

7 November 2026. Scope: full reader and admin acceptance journeys on the configured local environment and a real device, plus the Nimiq pre-ship checklist.

1. **Implemented.**
   - **Pre-ship checklist.** Ran the Nimiq mini-apps checklist (.agents/skills/mini-apps/references/checklist.md). Rechecked the official Ethereum provider, EVM token and local loading pages. The method contracts, Polygon USDT address, 6 decimals, error 4902 and POL gas requirement all match the code.
   - **Stuck-payment fix (commit dae8d2d).** The checklist's error-handling item found a defect. A wallet send that failed before broadcast left the payment prompted with no hash. Claim, cancel and reconciliation all refused it, so the reader could never borrow that book again. The fix has two parts:
     - Read-only USDT balance, POL balance and gas checks now run before Shelf reserves a wallet prompt.
     - A service-only release re-enables the prompt. It requires 15 minutes since the prompt. It also requires the server's own Polygon RPC to show no pending sender transaction and no USDT Transfer from the quoted sender to the recipient after the quote block. Searches longer than 50,000 blocks fail closed.
   - **Android picker.** The chapter file field now also accepts `application/json` and `text/plain`, because some Android pickers cannot map `.json`. Contents are still validated as chapter-text-v1 before upload.
2. **Files created.**
   - Migration 20261107000100_payment_release.sql.
   - This report.
3. **Files changed.**
   - Payments: verify.ts, verify.test.ts, payments/index.ts, src/lib/nimiq/payments.ts and client.ts, PaymentCheckout.tsx.
   - Admin: CatalogueEditor.tsx.
   - Tests: tests/unit/payments.test.ts, tests/database/payments.test.mjs, tests/wallet/auth.spec.mjs (test-only read-only provider answers), supabase/tests/foundation.test.sql and tests/database/api.test.mjs.
   - The last two tests counted whole tables and updated every application. They now scope to the seed and fixture rows, so they stay valid on a database that contains real acceptance data.
4. **Database changes.**
   - Added a `prompted_at` column to the private dispatch table, set by a trigger. The migration was applied locally without a reset.
   - payment_state now also returns `prompted_at`.
   - payment_release is service-only.
   - Local operator action: granted the admin role to talk2monarch77@gmail.com (UUID f0aa01a7-…), as the user approved.
5. **Tests performed.**
   - **Reader journey, Android Nimiq Pay, real funds:**
     - Email sign-in and verified wallet.
     - Early return of the 6 November Quiet Orbit loan. The server then denied the chapter.
     - A new 3-day borrow for 1.00 USDT, transaction 0x75e397114b5c5433538f8c3cc67bc3293106d0f319369975d015998ee18a962d. I verified it independently with the backend verifier against a separate public Polygon RPC: receipt successful, block 96,903,760, finalized (height 96,903,817), exact amount, token, sender and recipient.
     - The loan is active until 10 November, 14:18 UTC, and the server authorizes the chapter.
     - There are no duplicate transaction hashes.
     - The user confirmed that reading, transactions and the return denial looked right.
   - **Admin journey (phone and desktop):**
     - Two contributor applications were approved by the admin, and contributor records were created. The second applicant stayed a reader.
     - The Paper City (seed draft) was published, then unpublished.
     - A new contributor-owned draft, Acceptance test volume, got two plans, rights, a cover and a chapter. It was then published and unpublished.
     - While published, signed-out visitors saw the book, its plans and its cover. The chapter could not be downloaded or signed, and asset rows stayed hidden. The stored chapter matched its SHA-256 and size. After unpublishing, the public saw nothing.
     - Revenue shows 2.00 USDT confirmed, all platform share.
   - **Automated suites, all passing:**
     - Unit: 45.
     - Verifier: 25.
     - Payment database/API: 12, twice.
     - Wallet API: 11.
     - pgTAP: 91. Auth/RLS/Storage API: 13.
     - Route/provider browser: 30. Catalogue browser: 10.
     - Desktop/mobile wallet journeys.
     - Admin/applicant journey.
   - **Live release check.** Against live Polygon, the release check detected the real 6 November transfer and returned clear for windows with no transfer.
6. **Build/type checks.** ESLint, frontend TypeScript, Deno checks for all four functions and the production build passed.
7. **Problems discovered.**
   - **Stuck prompted payments.** See item 1.
   - **Android file picker.** Mobile uploads of `.json` chapters failed on the user's phone.
   - **Data-dependent tests.** Two database suites assumed seed-only data.
   - **Unpublish location.** The user expected publishing controls on the Contribute page. Per the approved spec, publishing is admin-only, and the spec excludes publisher dashboards.
8. **Problems fixed.**
   - Stuck payments, the picker filter and the data-dependent tests are fixed.
   - The user kept contributor book management admin-only for the MVP.
9. **Limitations and follow-ups.**
   - **Nimiq Pay version.** Not supplied. Android, latest Play Store release.
   - **Mobile chapter upload.** Not re-verified on the phone after the picker change. The chapter was uploaded from desktop.
   - **Old stuck checkout.** The 5 November A Small Garden of Time checkout is still prompted, with no hash. It is older than the 50,000-block self-release window, so it needs an operator decision: verify on Polygon that nothing was sent, then cancel.
   - **Leftover test data.** The local database keeps the acceptance data (Acceptance test volume as a draft, approved applications) and an old `ui-…@example.invalid` test user.
   - **Post-MVP, by user decision.** Contributor self-service for viewing books, publishing and editing.
   - **Requested next.** Importing DOCX/PDF chapters, converted to plain-text chapters on upload.
   - **Not done here.** Hosted deployment, SMTP, the hosted reconciliation scheduler and CSP headers remain Phase 13 work. The hosted CPU behaviour of wallet-auth (see the Phase 10 report) is still unmeasured.
10. **Acceptance.** Passed. The reader journey passed on a real device with real funds, independently verified. The admin journey passed on the local stack. The checklist failure was fixed. Phase 13 (deployment package) requires separate approval.

## Pre-ship checklist results

PASS: Provider integration uses window.ethereum with EIP-6963 discovery, a timeout, error handling and an outside-Nimiq-Pay message. The SDK is installed; NIM is out of scope.
PASS: Mobile-first UI: 375 px, 44 px targets, no horizontal scroll, readable text (Phase 11 audit).
PASS: Security: no key access, native dialogs only, no hardcoded secrets, eth_signTypedData_v4 for the login challenge.
PASS: Error handling: rejection (4001), RPC failures and, after this phase's fix, ERC-20 balance, gas and contract failures.
PASS: Approval dialog UX: every prompt follows a button press, and nothing prompts on load.
PASS: Token handling: Polygon USDT 0xc2132D05…8e8F, 6 decimals, chain checked before send, viem encoding.
PASS: Chain usage: hex 0x89, and 4902 is handled.
PASS: Dev server and testing: the LAN URL was tested in Nimiq Pay on Android. crypto.getRandomValues is used, and the randomUUID path is development-only.
SKIP: Visual identity: no Nimiq logo or brand assets are used.

Summary: 8 passed, 0 failed, 1 skipped (after fixing the error-handling failure).
