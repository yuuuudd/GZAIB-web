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
