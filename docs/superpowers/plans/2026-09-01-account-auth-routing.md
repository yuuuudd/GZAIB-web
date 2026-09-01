# Account Authentication Routing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every member account page and API recognize trusted ChatGPT identity in production while retaining signed Demo-mode sessions locally.

**Architecture:** Reuse `resolveRequestUserId` as the single identity boundary and add one session-shaped required wrapper for consumers that already accept `{ identity: { id } }`. Account pages redirect anonymous visitors into the existing Sites SIWC path; member APIs return their existing `401` contract.

**Tech Stack:** TypeScript, Vinext App Router, React 19, Node test runner, Sites SIWC headers, D1.

**Spec:** User report in this task: clicking “我的” must enter the account system instead of returning to the home page.

## Global Constraints

- Trust only signed Demo sessions in Demo mode and `oai-authenticated-user-*` headers in production.
- Keep authorization server-side and ensure the production account row before member data access.
- Reuse existing routes, services, response copy, and database schema; add no dependency or new auth stack.

---

### Task 1: Shared required member identity

**Files:**
- Modify: `features/identity/request-user.ts`
- Test: `tests/identity/request-user.test.ts`

**Interfaces:**
- Consumes: `resolveRequestUserId(request, dependencies?)`.
- Produces: `requireRequestUserSession(request, dependencies?) => Promise<{ identity: { id: string } }>`.

- [ ] **Step 1: Write the failing test**

```ts
test("required member identity accepts trusted production headers and rejects visitors", async () => {
  const session = await requireRequestUserSession(authenticatedRequest, dependencies);
  assert.equal(session.identity.id, "chatgpt:user-42");
  await assert.rejects(() => requireRequestUserSession(anonymousRequest, dependencies));
});
```

- [ ] **Step 2: Run the focused identity test and confirm the missing export fails.**
- [ ] **Step 3: Implement the wrapper by calling `resolveRequestUserId` once and throwing when it returns `null`.**
- [ ] **Step 4: Run the focused identity test and confirm it passes.**

### Task 2: Account pages and member APIs

**Files:**
- Modify: `app/me/page.tsx`
- Modify: `app/me/activities/page.tsx`
- Modify: `app/me/blocked/page.tsx`
- Modify: `app/me/contact-card/page.tsx`
- Modify: `app/me/communities/page.tsx`
- Modify: `app/me/connections/page.tsx`
- Modify: `app/api/me/profile/route.ts`
- Modify: `app/api/me/account/route.ts`
- Modify: `app/api/me/blocks/route.ts`
- Modify: `app/api/me/contact-card/route.ts`
- Modify: `app/api/reports/route.ts`
- Modify: `app/api/me/reports/[id]/route.ts`
- Modify: `features/connections/runtime-route.ts`
- Modify: `features/directory/profile-access.ts`
- Modify: `features/identity/account-deletion.ts`
- Test: `tests/identity/request-user.test.ts`

**Interfaces:**
- Consumes: `requireRequestUserSession` for session-shaped consumers and `resolveRequestUserId` for page redirects.
- Produces: production-aware account pages/APIs with unchanged service contracts.

- [ ] **Step 1: Extend the failing boundary test to execute one real account API with trusted headers and assert it does not return `401`.**
- [ ] **Step 2: Run the focused test and confirm the current Demo-only dependency returns `401`.**
- [ ] **Step 3: Replace only member-facing `requireActiveSession` wiring with the shared required member identity.**
- [ ] **Step 4: Redirect anonymous account pages to `chatGPTSignInPath(returnTo)` and keep existing destinations after sign-in.**
- [ ] **Step 5: Run identity, account, connection, contact-card, profile, and safety tests.**

### Task 3: Verification and release

**Files:**
- Verify: `.openai/hosting.json`
- Verify: all modified source and tests

**Interfaces:**
- Consumes: successful unit tests and build.
- Produces: a saved Sites version ready for the existing public site.

- [ ] **Step 1: Run full unit tests, targeted lint, rendered build tests, and `git diff --check`.**
- [ ] **Step 2: Commit and push the exact validated source, package the matching build, and save one Sites version.**
- [ ] **Step 3: Request public deployment approval, deploy, then verify `/me` and a member API with the live browser.**
