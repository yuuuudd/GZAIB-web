# Task 9 Report — 成员资料页、成员中心和即时公开控制

## Outcome

Implemented the public/member profile surface, owner-only member center, immediate privacy controls, active-account session boundary, and atomic self-service account deletion.

## Delivered behavior

- `/members/[slug]` resolves the viewer on the server and passes only a `ProjectedProfile` to `MemberProfile`.
- Visitor projection excludes member/private fields; approved members receive member-visible fields; owners receive all allowlisted editable fields without account/review/contact data.
- Profile page renders text-plus-icon verification, confirmed visibility-filtered contributions, capability sections, work links, and a disabled “想认识 TA” next-plan teaser explaining approved membership.
- `/me` and `/api/me/profile` support owner-only allowlisted edits, optional-field visibility, profile-level map hide/show, and immediate no-cache projection changes.
- Required map fields stay public while a profile is published. After explicit profile hiding, their visibility controls become editable; republishing is rejected until all required fields are public again.
- Stable slugs are not editable.
- A school change updates only the application/review proposal and changes that application to `pending`; the approved profile remains `published` at its prior school. Public profile and map-directory queries no longer treat that pending school proposal as a reason to remove the approved snapshot.
- `/api/me/account` requires the exact phrase `删除我的账号`, returns `204`, and clears the current cookie.
- Account deletion uses one D1 batch to gate and record a minimal self-service audit, mark the user deleted, unpublish the profile, withdraw a pending application, and revoke stored sessions.
- `requireActiveSession` verifies durable account status after HMAC cookie verification. Deleted/suspended identities are blocked on all authenticated application, upload, owner, admin API, and admin page boundaries; hidden and connection-suspended members retain account access. Fresh Demo login reactivates the fixed identity through the existing `ensureDemoIdentity` path.
- Added responsive member/profile/member-center layout at `max-width: 768px`, single-column forms, scrollable filters, full-height mobile map, bottom-card treatment, visible focus-compatible native controls, and text/icon status cues.

## TDD and review

- Added access, update, rendering, active-account, HTTP deletion, and atomic deletion tests.
- Red/green coverage includes visitor/member/owner projection, stable slug lookup, hidden profile behavior, immediate visibility, cross-user rejection, published required-field rules, school-review continuity, exact confirmation, stored-session revocation, and stale-cookie blocking.
- Self-review found and fixed the school-review regression where an application becoming `pending` could otherwise hide its previously approved profile.
- No subagent code review or browser QA was run, per the task instruction.

## Verification

- `npm.cmd run test:unit` — PASS, 96 tests, 0 failures.
- `npm.cmd run build` — PASS; Vinext lists `/members/:slug`, `/me`, `/api/me/profile`, and `/api/me/account`.
- Targeted ESLint over all Task 9 files — PASS, 0 errors/warnings.
- `git diff --check` — PASS (only Git line-ending notices on existing Windows checkout policy).

Note: repository-wide `npm.cmd run lint` and `npx.cmd tsc --noEmit` still report pre-existing errors outside Task 9 (legacy apply pages/tests and missing standalone Cloudflare ambient types). Task 9-targeted lint is clean and the required production build succeeds.
