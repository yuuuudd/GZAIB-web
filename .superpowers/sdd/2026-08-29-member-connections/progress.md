# SDD ledger — plan: docs/superpowers/plans/2026-08-29-member-connections.md

Workspace: C:\Users\王🐟哒\Desktop\广州AI共创社\.worktrees\builder-map-demo
Branch: feature/builder-map-demo
Spec: docs/superpowers/specs/2026-08-29-guangdong-builder-map-design.md
Baseline: a8b784d

## Pre-flight task self-consistency scan

| Task | Internal agreement checked | Finding |
| --- | --- | --- |
| 1 | Four connection/safety tables, foreign keys, indexes, migration, schema test | Consistent; report/audit history intentionally avoids destructive cascades. |
| 2 | Policy, repository cursor/rate-limit/block checks, state transitions, atomic notification write | Consistent; consumes Task 1 schema and existing member/session boundaries. |
| 3 | AES-GCM contact card format, ownership AAD, accepted relationship/block gate, settings UI | Consistent; requires a 32-byte runtime key contract but no committed production secret. |
| 4 | Authenticated connection routes, member CTA, inbox/outbox/accepted UI | Consistent; consumes Tasks 2–3 and never accepts client sender identity. |
| 5 | In-app connection events, optional delivery adapter, dedupe/failure isolation | Consistent under the binding Demo amendment; real outbound delivery remains optional. |
| 6 | Atomic block cancellation, reports/admin resolution, account-deletion minimization | Consistent; reuses existing member status and audit services. |
| 7 | Permission matrix, full flow, complete gates, operations guide, local Demo verification | Consistent under the binding amendment replacing remote publish with local browser verification. |

## Rulings

Ruling: The user-approved first version remains a local Demo with fixed server-owned identities; real public authentication, official-account delivery, remote migrations, hosting, and production secrets are deferred. The full in-app connection and consent flow remains binding. Cost if wrong: Task 7 will require a separately authorized hosting/configuration pass.

Ruling: Task 4 adds one fixed fictional peer-member Demo identity so both sides of the consent flow are interactively demonstrable; the operator identity never impersonates a normal recipient. Cost if wrong: remove the peer allowlist entry and its deterministic seed profile when real official-account identity arrives.

Plan amendment commit: a8b784d (`docs: scope connection plan to local demo`).

## Progress

Task 1: complete (commits a8b784d..c807c86, review clean)

Ruling: Task 2 uses the plan and extracted brief's 2–60 character topic limit; an earlier controller prompt incorrectly said 2–30 and was corrected during the review fix round. Cost if wrong: only the shared limit and boundary tests need adjustment.

Task 2: fix round 1/5 (5 findings addressed; commits 56f218a..fb3832d)
Task 2 scoped re-review residual: explicit chained WeChat cues (`微信号是`, `WeChat ID is`) were fixed controller-side with focused RED→GREEN coverage; no second review wave was opened.
Task 2: complete (commits c807c86..77f614d, review findings closed; 143/143 unit and build controller-verified)

Task 3: fix round 1/5 (2 findings addressed; commits 4452fc3..0229ac7)
Task 3: complete (commits 77f614d..0229ac7, scoped re-review APPROVED)

Task 4: fix round 1/5 (3 findings addressed; commits a178945..615dc51)
Task 4 scoped re-review residual: successful-submit focus now moves to a stable focusable pending-status target; controller captured RED→GREEN and ran focused tests, lint, and build. No second review wave was opened.
Task 4: complete (commits c95f4fc..0a12336, review findings closed; build verified)

Task 5 deferred-minor: Task 7 full-flow/repository coverage must assert non-empty create/resolve notification statements share the guarded D1 batch; Task 5 implementation was reviewed as atomic and ready.
Task 5: complete (commits 0a12336..932631a, review ready with 1 deferred test-only minor)

Task 6: fix round 1/5 (6 findings addressed; commits 66c9b56..0884e69)
Task 6 scoped re-review residuals: controller added concrete D1 batch/SQL coverage, safety-dialog focus lifecycle, and aligned `connection_suspended` target eligibility; focused RED→GREEN, lint and build passed. No second review wave was opened.
Task 6: complete (commits 932631a..e3202c5, review findings closed; 189/189 unit, lint and build verified)
Task 2: complete (review-fix: sender requires active/approved/published; binding topic maximum corrected to 60; guarded D1 request repository, state transitions, and cursor tests)

Task 7 scoped re-review residuals: controller aligned standalone migrations with Vite's `.wrangler/state/v3`, replaced missing-request accept assertions with real pending requests across every authenticated state, and added live acceptance eligibility plus repeated D1 atomic guards. Focused RED→GREEN, exact local migrations, full unit/lint/build/rendered gates passed. No second scoped review wave was opened.
Task 7: complete (commits e3202c5..bb1988e, review findings closed; 197/197 unit, lint, build, rendered 6/6 verified)

Final-review fix pass: complete (contact disclosure in topic, member-role preflight/resolver/atomic guard, contact-card clear/delete UI and route, plus retained local Wrangler CLI correction; RED 35/43 then GREEN 43/43 + resolver 1/1; final 204/204 unit, lint, build, rendered 6/6, diff-check verified; commit pending).
