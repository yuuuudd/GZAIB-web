# Task 5 report — member connection notifications

## Delivered

- Added the four exact connection event types and allowlisted, recipient-safe Chinese copy. Each event uses `connection:<requestId>:<status>` and only routes to the authenticated connection inbox.
- Extended the Task 2 atomic repository boundary so create/resolve batches receive a pending in-app notification together with the request mutation.
- Added post-commit optional Resend delivery with injected `fetch`, fixed endpoint, HTTPS/configuration checks, timeout, safe headers, and no logging. Missing Demo config safely skips delivery; transport errors, HTTP 429, and HTTP 400 record `failed` without changing connection status.
- Runtime composition now passes the production repository plus the optional Resend sender; it is not test-only wiring.
- Kept phase-one application/contribution notification copy and dedupe behavior unchanged.

## TDD evidence

- RED: the initial connection-event test failed with the expected missing-module error.
- RED: service atomic tests failed with the expected empty notification batch on create and resolve.
- RED: configuration validation test failed because malformed `from` was accepted.
- GREEN: all focused tests pass after minimal implementation.

## Verification

- `npx.cmd tsx --test tests/notifications/connection-events.test.ts` — 3 passed.
- `npm.cmd run test:unit -- tests/notifications/*.test.ts tests/connections/service.test.ts` — 177 passed (the package glob runs the complete unit suite).
- `npm.cmd run test:unit` — 177 passed.
- `npm.cmd run lint` — passed.
- `npm.cmd run build` — passed.
- `git diff --check` — passed.

`npx.cmd tsc --noEmit` remains nonzero because of existing project-wide Cloudflare type declarations and unrelated pre-existing type errors (for example `cloudflare:workers`, AMap route body typing, and contact-card BufferSource typing); no Task 5 source file was reported in its diagnostics.

## Privacy/idempotency/atomicity review

- Contact cards, plaintext contact channels, emails, private profiles, and review data are never mapped into notification title/body/href or Resend text.
- The business mutation and initial pending in-app notification share a D1 batch. Email starts only after that batch reports success.
- Repeating the same resolved action returns the existing request before any email attempt; failure bookkeeping does not alter request state.
