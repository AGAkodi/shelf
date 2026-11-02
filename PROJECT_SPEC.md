# Shelf product specification

Shelf is the Virtual Library digital book lending marketplace inside Nimiq Pay. The latest user master build instructions and IMPLEMENTATION_PLAN.md define the full requirements. Current authorization: Phase 1 foundation only.

Readers browse/search/filter/preview books, choose database-backed 3/7/14-day plans, pay USDT on Polygon, receive access only after backend verification, read inside Shelf, return early and view history. Rental fees are not collateral; return/expiry has no refund. Protected requests require authenticated user, owned loan, matching book, active status and now < expires_at. Loans: pending_payment, active, returned, expired, cancelled. Separate payments from loans.

Admins manage books, private content, covers, per-book enabled plans, publishing, loans, payments, revenue and contributor applications. Applicants provide name, contact, author/publisher type, description and ownership/rights information. Contributor-owned revenue is recorded 80/20; no automatic payouts. Platform-owned books accrue all revenue to platform.

Use Vite/React/TypeScript/Tailwind/React Router, Supabase PostgreSQL/Auth/private Storage/functions, Mini App SDK and injected EVM provider, Vercel SPA hosting. No Next.js. NIM follows reliable USDT support; it is not Phase 1 scope. Exclude collateral, NFTs, transferable ownership, DRM claims, AI/social/chat/subscriptions/complex publisher dashboards.

Preserve approved prototype dark theme, purple accents, DM Sans/Playfair Display, navigation/cards and reading layout. Full UI is Phase 3. Phase 1 routes: /, /explore, /books/:bookId, /checkout/:bookId, /library, /read/:loanId, /transactions, /admin, /contribute. This latest checkout route supersedes the plan's payment-ID URL; a later pending payment can be identified separately without changing this route.

Phase 1 must contain no fake catalogue, account, payment, borrowing, admin or contributor functionality. Placeholder routes must say they are unavailable. Public shell routes confer no privileges. No database schema or wallet integration in Phase 1.

Unresolved gates remain: Supabase runtime, wallet-signature Auth compatibility/replay protection, merchant address, finality policy, licensed content/format, deployment domain and real device evidence. See IMPLEMENTATION_PLAN.md before the affected phase.
