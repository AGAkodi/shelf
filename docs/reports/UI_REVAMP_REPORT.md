# UI revamp report

7 November 2026. Requested by the user, using two reference boards (desktop and mobile) and the unslop skill by Damir Sokolovsky (@heydamir, CC BY 4.0). The user also asked for that skill to be installed globally.

1. **Implemented.**
   - **Skill install.** Reviewed every file in `unslop-main.zip`, including both Node scripts, before installing. Nothing in it reached the network or credentials beyond what it documents. Installed it with its license at `~/.claude/skills/unslop`.
   - **Direction.** Audited the old UI against the skill's signs: uppercase tracked labels, italic emphasis, violet on everything, account panels on every page and flat covers. The user approved this direction, "a library reading room at night":
     - near-black neutrals with a faint green tint;
     - one brass accent for primary actions and key figures, and green only for active and positive states;
     - DM Sans for the interface, Playfair Display for titles and Newsreader for reading text;
     - a library date-due stamp on loans as the signature detail.
   - **Spacing, type and motion.** A 4px grid, nested radii, one easing curve, sentence case throughout and tabular figures.
   - **Shell:**
     - a 248px sidebar with a user card, and admin navigation shown only to admins;
     - a top search bar with a `/` shortcut that opens Explore;
     - a mobile tab bar (Home, Explore, Library, Account) with 44px+ targets.
   - **Account page.** Sign-in and wallet verification moved here from the top of every page. They also appear inline in checkout and in signed-out states. Wallet provider discovery now runs once in the layout, so a connection survives navigation.
   - **Screens:**
     - **Home:** a split hero with a rendered banker's lamp lighting the catalogue's real titles, a "Continue reading" row with due stamps, and the three borrowing steps.
     - **Book details:** covers rendered as cloth-bound objects, info chips, a plan picker, favorite and share buttons, and Overview / Preview / Similar books tabs.
     - **Checkout:** a Borrow → Payment → Access stepper with sign-in, wallet and pay steps.
     - **My Library:** Active / History / Favorites tabs and real stats.
     - **Transactions:** a table with Polygonscan links.
     - **Reader:**
       - a progress ring by chapter and time left;
       - return from the reader and bookmarks;
       - text size, paper or night page, and fullscreen through the Nimiq Pay SDK or the browser API;
       - chapter navigation.
     - **Admin overview:** books, active readers, confirmed revenue and payment success, a 30-day loans-started chart sized to its container, and pending applications with approve and reject.
   - **New features (user decision).** Reader **favorites**, and **bookmarks** that store only chapter and paragraph positions.
   - **Kept out (user decision):** the references' ratings, reviews, notifications, NEAR payment and commercial titles. Every number shown comes from real records.
2. **Files created:**
   - Pages and components: src/pages/AccountPage.tsx, src/components/art/ReadingLamp.tsx, src/features/admin/AdminOverview.tsx.
   - Hooks: src/features/account/useRole.ts, src/features/library/useFavorites.ts and useBookmarks.ts, src/features/wallet/useWalletDiscovery.ts.
   - Helpers: src/lib/format.ts and cover.ts.
   - Database: migration 20261107000200_favorites_bookmarks.sql and supabase/tests/library_features.test.sql.
   - This report.
3. **Files changed:**
   - Styles and shell: src/styles/index.css (rewritten), main.tsx (fonts), app/navigation.ts and routes.tsx, AppLayout.
   - Components and features: Catalogue components, EmailSignIn, WalletConnection, PaymentCheckout (status callback and layout only; payment logic unchanged), CatalogueEditor (platform label).
   - Pages: Home, Explore, Book details, Checkout, Library, Transactions, Reader, Contribute, Admin and Not found.
   - Generated database types, and package.json (`@fontsource/newsreader`).
   - Tests: foundation, nimiq, catalogue and wallet specs, the RLS table count in the foundation SQL test, and a unit test stub cast.
   - Docs: README, PROJECT_SPEC, AGENTS and DATABASE_SCHEMA.
4. **Database changes.**
   - **Favorites:** owner-only. Readers can add only published books.
   - **Bookmarks:** owner-only and position-only. Adding one requires an active, unexpired loan, and each reader is capped at 200 per book.
   - **Applied locally without a reset.** Your 6 and 7 November payments and loans are intact.
5. **Tests performed:**
   - **pgTAP:** 114 checks (91 existing plus 23 new for favorites and bookmarks).
   - **Visual review:** checked the real screens at 1440×900 and 375×812:
     - no horizontal overflow on any route;
     - all mobile touch targets at least 44px, with radios inside larger labels;
     - the reader rendered with mocked chapter data, for visual review only;
     - the admin view rendered with a temporary local admin that was then deleted.
   - **Suite results, all passing:**
     - Unit: 57. Verifier: 25.
     - pgTAP: 114 across both files. Auth/RLS/Storage API: 13.
     - Payment database/API: 12. Wallet API: 11.
     - Admin/applicant journey and DOCX/PDF import journey.
     - Catalogue browser: 10.
     - Route/provider browser: 32, including the new sidebar/tab bar and `/` search test.
     - Desktop/mobile wallet journeys: 2, with sign-in and verification on Account and the checkout steps to "Payment verified".
     - Production headers/CSP: 6.
     - Lint, both type checks and the build.
6. **Build/type checks.** Lint, TypeScript and the build passed.
7. **Problems discovered:**
   - Covers collided on one colour.
   - The book Overview tab had a double frame.
   - Tab rows showed a scrollbar artifact.
   - The avatar text sat off-centre.
   - The mobile reader put its panels before the text.
   - Admin chart labels distorted on mobile.
   - The plan radios blocked clicks.
   - Two search boxes shared one label in a test.
   - The signed-out favorites state could read from an empty object.
   - The platform owner was still labelled "Virtual Library".
8. **Problems fixed.** All of the above: an FNV hash for covers, the frame and scrollbar removed, scoped CSS, the text placed first on mobile, a ResizeObserver chart, full-area radio inputs, the test scoped to the main region, a guarded favorites state, and the owner renamed "Shelf (platform)".
9. **Limitations:**
   - **No real-device check.** Not yet checked on the user's Android device in Nimiq Pay; fullscreen there uses the SDK's host call.
   - **Reader shown with mock data.** The visual reader check used mocked chapter data. The real access paths are covered by the payment and database suites.
   - **No PDF/EPUB rendering.** The reader shows text chapters only; covers without an uploaded image use a generated cloth design.
   - **Bookmarks can't be added after a loan ends.** They stay visible to their owner.
   - **Contributor book management** remains admin-only for the MVP.
10. **Acceptance.** Pending the user's review of the new UI on their phone.
