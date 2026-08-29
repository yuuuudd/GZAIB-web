# Task 4 report — member connection entry points and inbox

## Delivered

- Added authenticated, private/no-store connection routes for create, list, and resolve actions. The route delegate uses the active server session, ignores a forged client `senderId`, resolves the public recipient slug server-side, validates cursor/action input, and emits only safe request DTOs without participant IDs.
- Added member profile CTAs derived on the server: visitor/apply, own-profile edit, eligible request, pending wait, accepted inbox, and absent unavailable/blocked state.
- Added the accessible request dialog and responsive inbox with received/sent/accepted tabs, accept/decline/withdraw controls, pagination, loading/error/empty states, and live authorized contact cards only after acceptance.
- Added fixed Demo identity `peer` (`demo-peer`, member role) with signed-session validation, fixed login parser, identity switcher labels `共建者 A / 共建者 B / 运营员`, and idempotent seeded approved/published/verified profiles for both peer members.

## TDD evidence

1. Initial route test run failed with `ERR_MODULE_NOT_FOUND` for the route delegate.
2. The route implementation made the authorization, policy-code, cursor, forged-sender, and resolve tests green.
3. Peer session/seed tests were added and failed until the fixed allowlist and deterministic seed records were implemented.
4. CTA/inbox markup/privacy tests were added before their components and failed with the expected missing-module error.
5. A production-style asynchronous service-factory test failed with `503 !== 201`; the delegate now awaits the real runtime D1 service before calling it.

## Verification

- `npm.cmd run test:unit -- tests/connections/routes.test.ts` — pass (164/164 command-wide test glob)
- `npm.cmd run test:unit` — pass, 164/164
- `npm.cmd run lint` — pass
- `npm.cmd run build` — pass
- `git diff --check` — pass

## Security and privacy review

- POST ownership is from the active session only; client-provided sender identity never controls the service call.
- Public target slugs resolve only to approved, published, active-or-connection-suspended members. Missing, hidden, deleted, and nonpublic targets receive the same generic 404.
- All route responses are `Cache-Control: private, no-store`; returned request DTOs intentionally omit sender/recipient IDs.
- Contact-card plaintext is not SSR-provided by the inbox. It is live-read only for accepted requests through the Task 3 authorization boundary; denied live reads omit it.
- The operator identity remains admin-only and cannot impersonate either fixed member peer.

## Review-fix round — CTA, production adapter, and dialog focus

### RED → GREEN

1. Added focused CTA-state tests for an accepted relationship subsequently blocked in either direction, plus normal accepted and pending relationships. They first failed because no shared server-side CTA resolver existed; the resolver now applies blocked/unavailable before accepted or pending.
2. Added runtime-adapter tests that exercise create, list, public-slug resolve, and a cross-user forbidden response through the same `createConnectionRouteHandlers` composition used by the app routes. They initially failed because the adapter module did not exist.
3. Added dialog focus tests for Tab and Shift+Tab wrapping, Escape-only close requests, and modal labeling/close-control structure. They initially failed because the focus helpers did not exist.

### Production-wiring evidence and caveat

- `app/api/connections/route.ts` and `app/api/connections/[id]/route.ts` now lazily import `createDefaultRuntimeConnectionRouteAdapter`. The factory composes the production active-session boundary, runtime D1 service, public recipient resolver, and live contact-card service without evaluating the platform D1 binding at module load.
- The controlled adapter test proves the real route-handler composition receives its active session, service, slug resolver, and live-card service dependencies and maps a cross-user service rejection to 403. A source contract also checks both application route modules delegate to that lazy production factory.
- The Node unit runner cannot construct a Cloudflare D1 binding, so this is intentionally not represented as a real SQL/D1 integration test. Before production, run the same create/list/resolve/forbidden flow against the local Worker/D1 runtime binding.

### Focus lifecycle

- The request dialog installs its key listener only while mounted, removes it on close/unmount, traps Tab/Shift+Tab within enabled controls, closes on Escape, and restores focus to the opening CTA when the dialog is dismissed.

### Review-round verification

- `npm.cmd run test:unit` — pass, 172/172
- `npm.cmd run lint` — pass
- `npm.cmd run build` — pass
- `git diff --check` — pass
## Scoped re-review residual — successful-submit focus

- Added a failing test proving the pending state needed a stable focusable status target.
- Successful request creation now records the pending status as the focus destination; after React commits the replacement state, focus moves to that `role="status"`, `tabIndex={-1}` node instead of disappearing with the trigger button.
- Focus/dialog tests: 4/4; lint, Vinext build, and `git diff --check`: pass.
