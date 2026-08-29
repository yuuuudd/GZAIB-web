# Task 3 report — encrypted contact cards

## Delivered

- Added allowlisted, normalized contact-card validation and runtime-only `CONTACT_ENCRYPTION_KEY` validation.
- Added AES-256-GCM storage using a fresh 12-byte IV, owner-bound AAD, and the versioned `v1.<iv>.<ciphertext-and-tag>` payload format.
- Added a D1 ciphertext repository with live accepted-relationship, two-way block, and account-eligibility checks.
- Added authenticated owner `GET`/`PUT /api/me/contact-card` handlers. Ordinary GET responses expose only configuration state; plaintext requires an explicit settings reveal.
- Added the explicit `/me/contact-card` settings page and accessible editor with consent and privacy copy.

## TDD evidence

1. Initial focused test run failed with `ERR_MODULE_NOT_FOUND` for `features/connections/contact-card`.
2. The encryption/validation/authorization implementation made that focused suite green.
3. Added and observed failing tests for the owner route and editor before their implementation; both were then made green.

## Verification

- `npm.cmd run test:unit -- tests/connections/contact-card.test.ts` — pass (152 tests in the command's full glob run)
- `npm.cmd run test:unit` — pass, 152/152
- `npm.cmd run lint` — pass
- `npm.cmd run build` — pass

## Security review

- No key, plaintext, or decrypted card is logged.
- Key configuration is not read at module import, so unrelated routes remain bootable without it.
- Current cards are decrypted only after a live authorization check; blocked relationships are unavailable immediately.
- The normal contact endpoint response and all contact endpoint errors use `Cache-Control: private, no-store`.

## Fix round: canonical payload parsing and route seam

### RED → GREEN

1. Added a ciphertext mutation that changes only unused final base64url pad bits. Before the fix it decrypted successfully because it decoded to identical bytes.
2. Added malformed length, alphabet, version, and segment-count cases; every malformed payload must still fail with the generic contact-card error.
3. Added a route-boundary test for anonymous sessions, forged `userId`, ordinary configuration reads, explicit reveal, private cache headers, and missing contact-key configuration.

The focused suite first failed on the pad-bit alias and on the new route-boundary assertion. It is green after enforcing canonical base64url re-encoding and adding the delegate used by the Next route.

### Route-test caveat

The raw Next route module imports the D1 runtime, which resolves a `cloudflare:` binding unsupported by the Node unit-test loader. Instead of mocking framework/runtime internals, the route now delegates to `createContactCardRouteHandlers`; the actual Next exports call that delegate with `requireActiveSession` and the real D1-backed service. The focused test exercises this production delegate with real contact-card validation/encryption and controlled session/configuration dependencies.
