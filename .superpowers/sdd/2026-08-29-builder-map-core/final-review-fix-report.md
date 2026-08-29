# Final review fix report

## 2026-08-30 — recurrence, directory discovery, canonical origin, and request bounds

### RED → GREEN evidence

- Notification regressions first failed because application keys omitted the transition time; they now prove same-event retries share a key while a later `changes_requested` transition gets a new key. Existing exact route/adapter expectations were updated.
- Rendered metadata first failed when a valid hostile `x-forwarded-host` replaced direct `localhost`; it now passes with loopback metadata and never emits the hostile host. Unit coverage also proves valid `APP_ORIGIN`, invalid/missing `APP_ORIGIN`, and loopback-only fallback behavior.
- AMap and avatar tests first returned `200`/`400`/`201` for declared and chunked oversized bodies; both boundaries now return `413` before upstream, parsing, or storage work.
- School drawer contract tests cover the exact public list-mode request: selected school plus active allowlisted city/skills/roles/verified/query filters and opaque cursor. The UI starts with the four fast previews, fetches only after `查看全部成员`, and handles pagination, empty/error/loading states, and aborts.

### Files changed

- `features/notifications/in-app.ts`, notification and application route tests
- `components/directory/SchoolDrawer.tsx`, `components/map/BuilderMap.tsx`, `features/directory/client-query.ts`, drawer tests and drawer styling
- `app/layout.tsx`, `lib/site-origin.ts`, metadata tests
- `app/api/amap/[...path]/route.ts`, `features/directory/avatar.ts`, `lib/bounded-body.ts`, AMap/avatar tests

### Verification

- `npm.cmd run test:unit` — PASS, 120 tests, 0 failed.
- `npm.cmd run lint` — PASS, 0 errors/warnings.
- `npm.cmd run build` — PASS.
- `node --test tests/rendered-html.test.mjs` — PASS, 4 tests, 0 failed.
- `git diff --check` — PASS (only the workspace's LF/CRLF notices).

### Remaining caveats

- No browser, DOM-click, or screenshot QA was run by request. The drawer behavior is protected by request-contract and server-rendered metadata tests plus the production build.
