# Execution efficiency audit

4 November 2026. Scope: visible Shelf chat/tool history; no billing ledger or per-turn token/credit accounting was available. No precise waste percentage or savings claim is possible.

## Observed avoidable work

- A GitHub fetch returned about 47,587 tokens of upstream source because the whole connector result was printed. Relevant payment-handler excerpts would have sufficed.
- Repeated short polls produced empty or incremental output and unnecessary agent continuations.
- Source edits/formatting overlapped a browser run; a development reload caused failed assertions and a rerun. The stable-source rerun passed.
- Whole-file reads and truncated output caused additional retrieval work.
- Broad test sequences were repeated where focused failing tests should have preceded final validation.
- Stale Phase 5/6 gate notes could trigger repeated questions and research despite user answers.

## Actions taken

Added durable credit-conscious execution rules to AGENTS.md: bounded/filter-before-print output, longer purposeful polls, batch reads, stable source during browser tests, affected-test-first repair, reuse passing evidence, no rebuilds for documentation-only changes, no unsolicited delegation/automation or phase-close scope expansion, and stop at the user-dependent device gate. Corrected the plan/spec's outdated recipient/finality gate notes.

No billing setting, model, reasoning level or speed mode was changed. The existing local device preview/reconciliation process is retained for the requested payment test; it does not itself make model/API calls. No new background agent or monitoring task was created.

## Current handoff

Phase 5 accepted, commit 4fec5dc. Phase 6 application/security/browser checks and live RPC quote smoke passed as recorded in PHASE_6_CHECKPOINT_REPORT.md. Recipient supplied and finalized-block policy approved. Remaining gate: user-approved real Nimiq Pay transfer, independently checked transaction evidence, reader/return acceptance, then Phase 6 completion commit. Phase 7 is not authorized. Do not rerun completed suites solely because a new chat turn starts.

Validation for this audit: review documentation diff and git diff --check only. Application tests are unnecessary because this audit changes no application code.
