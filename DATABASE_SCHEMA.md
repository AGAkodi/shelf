# Database design status

Planning reference only; no schema/migrations or database changes in Phase 1. IMPLEMENTATION_PLAN.md defines the proposed entities and security boundaries.

Phase 2 will implement profiles, books, contributors, contributor_applications, book_licenses, borrowing_plans, loans and payments, with private book_assets and protected user_roles as needed. Reviews are omitted from the MVP. Prices/durations belong to individual database plans. Persist integer token base units and immutable payment/loan quote snapshots.

Enable RLS, foreign keys, checks and unique transaction/idempotency constraints. Readers cannot write payment confirmation, loan activation or admin membership. Finalization is an atomic privileged server transaction. Private protected-books storage has no public reader URLs; authenticated server requests revalidate loans each time. Only admin-authorized uploads; public covers are separate.

Resolve wallet authentication and duplicate pending/active borrowing semantics before schema implementation. Supabase credentials/runtime and admin bootstrap are not configured. Do not create generated database types until a real schema exists.
