# Test plan

Phase 1: clean dependency install; actual dev-server startup; browser-render all nine requested routes and not-found; desktop/mobile navigation and no overflow; configuration missing/invalid/valid states; no Supabase client when config is invalid; render error recovery; lazy-loading state. Run npm run lint, npm run typecheck, npm test, npm run test:e2e, npm run build. No production database or wallet test claims in this phase.

Later phases: real reset/migrate/seed and multi-user RLS/storage tests; active/expired/returned/wrong-user/wrong-book/no-loan access; payment wrong-chain/token/sender/recipient/amount, fake hash, failed receipt, confirmation/reorg, concurrent replay/idempotence and refresh/multiple tabs; admin privilege escalation and contributor privacy; complete reader/admin device journeys. Fixture/provider doubles belong only in tests. No production mocks may ship. Reference the phase-specific gates in IMPLEMENTATION_PLAN.md.

Security assertions: secrets absent from tracked files/build output, protected books absent from public assets, UI state never grants authorization, every future content request uses server time/loan checks. Record unavailable tooling or credentials instead of claiming tests passed.
