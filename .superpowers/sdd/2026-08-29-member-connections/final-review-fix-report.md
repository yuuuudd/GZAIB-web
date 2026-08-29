# Final-review fix report — member connections

## Final-review findings closed

- Contact-disclosure validation now applies the same explicit email, phone, and WeChat detector to both the topic and the message. Requests with a contact-bearing topic fail before a request or notification can be persisted; ordinary community discussion remains allowed.
- New connection participants must both be members. The policy preflight, public recipient resolver, and guarded D1 INSERT all require the member role, while unavailable public targets retain the generic unavailable response.
- Contact-card owners can now clear a card. The D1 repository deletes only the owner's ciphertext; the service, authenticated DELETE route, and two-step UI confirmation preserve private/no-store responses, session-owned identity, cleared form state, and feedback focus. Accepted peers lose access on their next live read.
- Retained the controller's local-only Wrangler correction: `wrangler.local.jsonc` is CLI-only, uses compatibility date `2026-05-22`, avoids Vite auto-discovery duplicate compatibility flags, and matches the README's `.wrangler/state` local migration commands.

## TDD evidence

- RED: `npx.cmd tsx --test tests/connections/policy.test.ts tests/connections/service.test.ts tests/connections/contact-card.test.ts` — 35 passed / 8 failed. The failures proved topic disclosures were accepted, admin role was absent from the policy and guarded SQL, and clear/delete/UI functionality did not exist.
- GREEN: the same focused suite passed 43/43 after the implementation. A recipient-resolver factory test was added RED-first after its Cloudflare module-load dependency was isolated; `tests/connections/recipient-resolver.test.ts` then passed 1/1.

## Final verification

- `npm.cmd run test:unit` — PASS, 204 tests.
- `npm.cmd run lint` — PASS.
- `npm.cmd run build` — PASS (Vinext printed only its known proxy-environment warning).
- `node --test tests/rendered-html.test.mjs` — PASS, 6 tests.
- `git diff --check` — PASS.

## Scope and safety

No deployment, remote migration, email delivery, real secret, or network-side effect was performed. The only configuration change remains the tracked local Demo CLI contract.
