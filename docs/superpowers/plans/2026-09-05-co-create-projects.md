# Co-create Projects Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace static co-create cards with owner-managed projects, detail dialogs, and project-context connection requests.

**Architecture:** Store projects in one D1/Drizzle table keyed by the existing user account. Reuse the existing session, member profile, connection CTA, connection request, and contact-unlock flows; add only project CRUD and the UI needed to expose it.

**Tech Stack:** TypeScript, React 19, vinext App Router, Drizzle ORM, Cloudflare D1, Node test runner/JSDOM.

**Spec:** `docs/superpowers/specs/2026-09-05-co-create-projects-design.md`

## Global Constraints

- No new dependency and no parallel project-application subsystem.
- New projects publish immediately; archive is reversible and does not delete data.
- All mutations derive ownership from the authenticated session.
- Production examples belong to `2074712958@qq.com`.

---

### Task 1: Project model and repository

**Files:**
- Modify: `db/schema.ts`
- Create: `drizzle/0010_co_create_projects.sql`
- Create: `features/co-create/projects.ts`
- Create: `lib/db/repositories/co-create-projects.ts`
- Test: `tests/co-create/projects.test.ts`

**Interfaces:**
- Produces: `CoCreateProject`, `CoCreateProjectInput`, `validateCoCreateProject(input)`, and repository methods `listPublished`, `listByOwner`, `findPublicById`, `create`, `updateOwned`, `setPublishStatusOwned`.

- [ ] Write failing tests proving invalid required fields are rejected, archived projects are excluded from public queries, and updates cannot cross owners.
- [ ] Run `npx tsx --test tests/co-create/projects.test.ts` and confirm failure before implementation.
- [ ] Add the table, migration, minimal validator, and Drizzle repository. The migration inserts the three examples with `owner_user_id` selected from `users.email = '2074712958@qq.com'`.
- [ ] Run `npx tsx --test tests/co-create/projects.test.ts` and confirm pass.
- [ ] Commit the model slice.

### Task 2: Authenticated project mutations and management pages

**Files:**
- Create: `app/api/co-create-projects/route.ts`
- Create: `app/api/co-create-projects/[id]/route.ts`
- Create: `app/me/co-creates/page.tsx`
- Create: `app/me/co-creates/new/page.tsx`
- Create: `app/me/co-creates/[id]/edit/page.tsx`
- Create: `components/co-create/CoCreateProjectForm.tsx`
- Test: `tests/co-create/project-routes.test.ts`

**Interfaces:**
- Consumes: project validator/repository from Task 1 and existing `resolveRequestUserId`/`accountSignInPath` auth flow.
- Produces: JSON create/update/archive/restore endpoints and server-rendered owner management pages.

- [ ] Write failing route tests for authentication, server-owned `ownerUserId`, owner-only update, archive, and restore.
- [ ] Run `npx tsx --test tests/co-create/project-routes.test.ts` and confirm failure.
- [ ] Implement shared create/edit form plus the smallest authenticated pages and handlers that satisfy the tests.
- [ ] Run the route tests and confirm pass.
- [ ] Commit the management slice.

### Task 3: Public square detail and connection handoff

**Files:**
- Modify: `app/co-create/page.tsx`
- Modify: `components/co-create/CoCreateSquare.tsx`
- Modify: `components/connections/ConnectButton.tsx`
- Modify: `components/connections/ConnectionRequestDialog.tsx`
- Modify: `app/globals.css`
- Modify: `tests/co-create/square.test.ts`
- Modify: `tests/connections/connect-button.test.ts`

**Interfaces:**
- Consumes: `listPublished` project rows and existing member connection-state endpoint.
- Produces: card detail dialog; project-aware `ConnectButton`/`ConnectionRequestDialog` optional `topic` prop that defaults to the existing topic for all old callers.

- [ ] Add failing JSDOM/render tests proving cards are buttons, details appear in a dialog, old `/events/submit` navigation is gone, owners see “管理项目”, and applicants send the project title as connection topic.
- [ ] Run the focused square and connection tests and confirm failure.
- [ ] Implement accessible Escape/backdrop/focus behavior using the existing dialog helpers, fetch connection state only when needed, and retain the existing default connection topic for non-project uses.
- [ ] Run the focused tests and confirm pass.
- [ ] Commit the public interaction slice.

### Task 4: End-to-end verification and release

**Files:**
- Modify only files required by failures found in verification.

**Interfaces:**
- Consumes: all prior tasks.
- Produces: a tested production deployment.

- [ ] Run `npm run test:unit`, `npm run lint`, and `npm run build`; fix only failures caused by this feature.
- [ ] Apply `drizzle/0010_co_create_projects.sql` to the production D1 database and verify the three rows resolve to the requested owner account.
- [ ] Push the verified commit and deploy with the existing PM2/wrangler production procedure.
- [ ] Browser-check the public modal, login return, create/edit/archive/restore, owner management action, and project-context connection request.
