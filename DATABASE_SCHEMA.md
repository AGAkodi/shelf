# Phase 2 database foundation

Canonical identity is auth.users.id. Web3 is disabled. Ten RLS-enabled tables implement profiles, protected user_roles, contributors, private contributor_applications, public books, private book_licenses/book_assets, per-book borrowing_plans, loans and payments. Reviews and payment_attempts are omitted; each payment may claim one immutable hash, and later reconciliation can create a separate payment record if necessary.

All financial amounts are bigint micro-USDT, capped at JavaScript's maximum safe integer for generated SDK number types. Only Polygon 137 USDT with six decimals is supported. Contributor accounting uses floor(gross * 4 / 5); platform receives the remainder. Quotes, loan duration and activated timestamps are immutable. Plan edits do not rewrite history. Normalized chain/hash uniqueness and user/idempotency uniqueness prevent duplicate claims. One pending/active loan per user/book requires later checkout to expire stale records transactionally.

Deferred constraints require confirmation and matching activation in one transaction. These constraints do not verify blockchain receipts. Phase 4 adds service-only access RPCs and local simulated checkout; independent blockchain verification remains Phase 6. Browser administrators also cannot mutate financial records or roles. Service-role credentials remain trusted backend-only capabilities.

Readers can select their own private records, edit their display name and submit pending contributor applications. Admin membership comes only from user_roles, never editable Auth metadata. Admin policies allow catalogue/rights/assets/plans management and application review. Public access includes only published books and enabled plans for published books. Contacts, rights evidence and asset paths remain private.

Storage: covers is public, accepts PNG/JPEG/WebP up to 5 MiB. protected-books is private, accepts JSON chapters up to 1 MiB. Readers have no direct download/list/signing access. Admins may manage objects; Phase 4 implements server-proxied, loan-checked delivery. MIME restrictions are not semantic validation: the future uploader must validate chapter-text-v1 structure and the reader must render plain text. Publication currently requires reviewed valid rights and asset metadata; upload completeness and ongoing license revocation checks must be integrated before production publishing.

## Local development

Start Docker Desktop (Linux containers), then run npm run db:start, npm run db:reset, npm run test:db and npm run db:types. CLI 3.0.0 defaults to local; never add --remote for these tests. Reset destroys only local test data. db:reset applies SQL and uploads the three original demo chapters through Storage. The seed includes no users, loans or payments. The fictional contributor is unclaimed (user_id NULL). Auth test users are created through the actual local Auth API and removed afterward; pgTAP fixtures roll back.

Local credentials are obtained in memory from CLI status by Node-only tooling. Do not copy service/secret keys into Vite configuration. supabase/.temp and other runtime files are ignored. Only public schema types are generated into src/lib/supabase/database.types.ts.

## Explicit first-admin bootstrap

Create a legitimate Supabase Auth user through the selected secure authentication flow, verify its UUID and intended operator identity, then use the trusted SQL editor or privileged database connection:

```sql
insert into public.user_roles(user_id, role)
values ('REPLACE_WITH_VERIFIED_AUTH_USER_UUID'::uuid, 'admin')
on conflict (user_id, role) do nothing;
```

Never expose this operation as a browser RPC, grant role writes to authenticated users, or use a hardcoded personal email/wallet. Revoke with a privileged DELETE restricted to that UUID and role. Contributor approval never grants admin.

## Deferred gates

Phase 5 must prove server-issued expiring one-time nonces, atomic consumption, domain/origin and appropriate account/chain binding, signature verification, replay rejection, account-change handling and secure association to auth.users.id. No wallet field is proof of ownership. Phase 4 implements local borrowing and per-request access; Phase 6 adds chain verification and Phase 7 hardens reading.

## Phase 4 implementation (3 November 2026)

The user authorized Phase 4. Canonical identity remains auth.users.id. Local-only email/password sign-in uses real Supabase Auth for lifecycle tests; it is not the production login decision. Web3 and wallet associations remain unimplemented. The Phase 5 one-time nonce/replay gate is unchanged.

Development SQL is outside production migrations and installed only in the fixed local Docker database. Edge simulation actions require both a local Supabase URL and SHELF_DEV_ADAPTER=enabled. Production builds omit local sign-in/simulation controls. Development payments are labeled, forbid fabricated chain evidence and cannot change environment. Production evidence constraints remain enforced. Remove this temporary adapter before Phase 6 acceptance.

The shelf-api handler verifies bearer identity. Service-only RPCs handle transactional borrowing, return and chapter authorization. Private delivery proxies bounded, digest-checked plain JSON chapters, rechecks authorization after storage I/O and returns no file URL. Every request checks current database time; expiry denial needs no scheduler. Already delivered text cannot be recalled; this is access control, not DRM.

Migration 20261103000100_borrowing_access.sql adds immutable payments.environment, default production, and service-only library_state, return_loan and authorize_chapter. Anonymous/authenticated execute is denied. Production submitted/confirmed evidence constraints remain strict; development rows forbid recipient/sender/hash/block evidence. Existing RLS, quote immutability, uniqueness and atomic paid-loan constraints remain.

The separately installed supabase/development/adapter.sql locks the Auth user to serialize checkout/completion, snapshots server-side plan and integer 80/20 revenue, and activates exactly once. Reset removes these RPCs; reinstall explicitly. Never deploy development SQL to a hosted project.
