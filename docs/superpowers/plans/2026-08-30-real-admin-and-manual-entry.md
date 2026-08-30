# 真实管理员与手动录入 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让唯一白名单 ChatGPT 账号安全进入管理员后台，并手动录入不会冒充真实用户的成员资料。

**Architecture:** 管理员身份来自 Sites 注入的 ChatGPT 用户头，服务端使用 `ADMIN_EMAILS` 白名单授权并在 D1 同步一个管理员用户记录供审计引用。手动录入成员使用无登录凭证的托管资料；资料公开、学校坐标与连接资格通过独立状态字段控制，所有写入在同一 D1 批处理中附带审计日志。

**Tech Stack:** Next/Vinext、React、TypeScript、Drizzle/D1、Sites ChatGPT 身份头、node:test。

**Spec:** `docs/superpowers/specs/2026-08-30-real-admin-and-manual-entry-design.md`

## Global Constraints

- 生产环境只信任 Sites 注入的 ChatGPT 身份头；不得从客户端请求体、Cookie 或 query 参数读取管理员邮箱或角色。
- `ADMIN_EMAILS` 仅存于 Sites 受保护运行环境；生产环境缺失时必须拒绝管理员访问。
- 唯一初始管理员邮箱为 `jl5319604@gmail.com`；`2074712958@qq.com` 不是管理员。
- 手动资料不得存储登录邮箱、联系方式或个人实时位置。
- 手动录入资料默认不公开；只有已确认学校和完整公开默认范围可发布。
- 保留 `DEMO_MODE` 的本地测试入口，生产环境不得把 demo 会话授权为管理员。

---

## File Structure

- `features/admin/identity.ts`：解析白名单、将可信 ChatGPT 身份同步为可审计管理员用户。
- `features/admin/authorization.ts`：统一页面/API 的 demo 与生产管理员授权边界。
- `features/admin/manual-members.ts`：手动成员输入校验、公开规则和原子持久化服务。
- `lib/db/repositories/manual-members.ts`：D1 原子写入实现。
- `app/api/admin/members/manual/route.ts`：管理员手动成员 POST 边界。
- `app/admin/members/new/page.tsx` 与 `components/admin/ManualMemberForm.tsx`：管理员录入界面。
- `db/schema.ts`、`drizzle/0002_real_admin_manual_members.sql`：托管资料连接限制与审计支持。
- `tests/admin/real-authorization.test.ts`、`tests/admin/manual-members.test.ts`、`tests/admin/manual-member-route.test.ts`：授权、服务和路由回归测试。

### Task 1: 建立真实管理员身份边界

**Files:**
- Create: `features/admin/identity.ts`
- Modify: `features/admin/authorization.ts`, `app/admin/admin-session.ts`, `app/api/admin/**/route.ts`, `app/layout.tsx`, `app/page.tsx`, `.env.example`
- Test: `tests/admin/real-authorization.test.ts`

**Interfaces:**
- Consumes: `getChatGPTUser(): Promise<ChatGPTUser | null>`、`isDemoMode(): boolean`、`requireActiveSession(request)`。
- Produces: `requireRuntimeAdmin(request): Promise<{ id: string; email: string }>` 和 `authorizeAdminRoute(request): Promise<{ ok: true; admin: { id: string; email: string } } | { ok: false; response: Response }>`。

- [ ] **Step 1: Write the failing authorization tests**

```ts
test("authorizes only a header-derived ChatGPT email listed in ADMIN_EMAILS", async () => {
  const result = await authorizeRuntimeAdmin(chatGptRequest("jl5319604@gmail.com"), deps(["jl5319604@gmail.com"]));
  assert.deepEqual(result, { id: "oai-user-1", email: "jl5319604@gmail.com" });
});

test("rejects a signed-in but non-whitelisted ChatGPT account", async () => {
  await assert.rejects(() => authorizeRuntimeAdmin(chatGptRequest("2074712958@qq.com"), deps(["jl5319604@gmail.com"])));
});

test("never accepts demo-admin when DEMO_MODE is false", async () => {
  await assert.rejects(() => authorizeRuntimeAdmin(demoRequest(), deps(["jl5319604@gmail.com"], false)));
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm.cmd exec tsx -- --test tests/admin/real-authorization.test.ts`

Expected: FAIL because `authorizeRuntimeAdmin` does not exist.

- [ ] **Step 3: Implement the smallest safe identity module**

```ts
export function parseAdminEmails(value = process.env.ADMIN_EMAILS): Set<string> {
  return new Set((value ?? "").split(",").map((email) => email.trim().toLowerCase()).filter(Boolean));
}

export function isWhitelistedAdmin(email: string, allowed: Set<string>): boolean {
  return allowed.has(email.trim().toLowerCase());
}
```

Read the ChatGPT identity only through `getChatGPTUser()`. In production, require a non-empty allowlist and a matching email. In demo mode, retain the existing signed `demo-admin` path only. Add `ADMIN_EMAILS=` to `.env.example`, change page and route guards to use the unified authorizer, and show the public “管理员入口” link without exposing whether the viewer is authorized.

- [ ] **Step 4: Run the focused tests to verify they pass**

Run: `npm.cmd exec tsx -- --test tests/admin/real-authorization.test.ts tests/admin/review.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add features/admin/identity.ts features/admin/authorization.ts app/admin app/api/admin app/layout.tsx app/page.tsx .env.example tests/admin/real-authorization.test.ts
git commit -m "feat: authorize real ChatGPT admins"
```

### Task 2: 增加托管成员的数据状态与原子录入服务

**Files:**
- Create: `features/admin/manual-members.ts`, `lib/db/repositories/manual-members.ts`, `drizzle/0002_real_admin_manual_members.sql`
- Modify: `db/schema.ts`, `features/admin/authorization.ts`, `features/connections/recipient-resolver.ts`, `features/connections/cta-state.ts`
- Test: `tests/admin/manual-members.test.ts`

**Interfaces:**
- Consumes: `DEFAULT_APPLICATION_VISIBILITY`, `MAP_REQUIRED_VISIBILITY_FIELDS`, confirmed-school lookup and `AuditRecord`.
- Produces: `parseManualMemberInput(value): ManualMemberInput`, `createManualMemberService(repository)` and `create(input, admin, now): Promise<ManualMemberRecord>`.

- [ ] **Step 1: Write failing manual-member service tests**

```ts
test("stores a manual member as an unpublished managed profile with private optional fields", async () => {
  const created = await service.create(input({ publication: "draft" }), admin, 1_000);
  assert.equal(created.profile.publishStatus, "unpublished");
  assert.equal(created.profile.adminManaged, true);
  assert.deepEqual(created.visibility, DEFAULT_APPLICATION_VISIBILITY);
});

test("publishes only through a confirmed school and writes one audit record", async () => {
  const created = await service.create(input({ publication: "publish" }), admin, 1_000);
  assert.equal(created.profile.publishStatus, "published");
  assert.equal(store.audits.length, 1);
  assert.equal(store.audits[0].action, "member.manually_created_published");
});

test("rejects a publish request for an unconfirmed school before any write", async () => {
  await assert.rejects(() => service.create(input({ publication: "publish", schoolId: "suggested-school" }), admin, 1_000));
  assert.equal(store.writes.length, 0);
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm.cmd exec tsx -- --test tests/admin/manual-members.test.ts`

Expected: FAIL because the manual member service does not exist.

- [ ] **Step 3: Implement schema and service**

Add `adminManaged integer not null default false` to `member_profiles` and migration `0002_real_admin_manual_members.sql`. Extend audit actions with `member.manually_created_draft` and `member.manually_created_published`. The repository batch must create: a synthetic non-login user with a generated `manual+<uuid>@managed.local` email, its profile, all visibility rows and one audit row. The service must create a slug from nickname plus a collision-safe suffix and set `adminManaged: true`; publication is `unpublished` for draft and `published` only after a confirmed-school check. Exclude `adminManaged` profiles from connection CTA and recipient resolution.

- [ ] **Step 4: Run focused tests to verify they pass**

Run: `npm.cmd exec tsx -- --test tests/admin/manual-members.test.ts tests/connections/recipient-resolver.test.ts tests/connections/cta-state.test.ts`

Expected: PASS.

- [ ] **Step 5: Generate and inspect the migration**

Run: `npm.cmd run db:generate`

Expected: generated migration contains `admin_managed` with default `0` and no unrelated table changes.

- [ ] **Step 6: Commit**

```bash
git add db/schema.ts drizzle features/admin/manual-members.ts lib/db/repositories/manual-members.ts features/connections tests/admin/manual-members.test.ts
git commit -m "feat: add managed manual member records"
```

### Task 3: 添加受保护的手动录入接口和后台表单

**Files:**
- Create: `app/api/admin/members/manual/route.ts`, `app/admin/members/new/page.tsx`, `components/admin/ManualMemberForm.tsx`
- Modify: `app/admin/layout.tsx`, `app/admin/members/page.tsx`, `app/globals.css`
- Test: `tests/admin/manual-member-route.test.ts`

**Interfaces:**
- Consumes: `authorizeAdminRoute(request)`, `createRuntimeManualMemberService()`, `ManualMemberInput`.
- Produces: `POST /api/admin/members/manual` returning `{ id, slug, publishStatus }` on HTTP 201.

- [ ] **Step 1: Write failing route and render tests**

```ts
test("manual-member route ignores any client actor claim and uses the authorized admin", async () => {
  const response = await handleManualMemberPost(request({ actorId: "forged", publication: "draft" }), runtime);
  assert.equal(response.status, 201);
  assert.equal(runtime.savedAudit.actorUserId, "oai-user-1");
});

test("form offers draft and publish choices but never a login-email field", () => {
  const html = renderToStaticMarkup(createElement(ManualMemberForm, { schools: [] }));
  assert.match(html, /保存为草稿/);
  assert.match(html, /确认发布到地图/);
  assert.doesNotMatch(html, /登录邮箱/);
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm.cmd exec tsx -- --test tests/admin/manual-member-route.test.ts`

Expected: FAIL because the route and form do not exist.

- [ ] **Step 3: Implement the request boundary and form**

Use the same authorization function as every other admin endpoint. Allowlist the form fields exactly: nickname, realName, schoolId, intro, skills, roles, major, grade, currentFocus, canOffer, wantsToMeet, workLinks, publication. Submit JSON to the new route; on success show a status message and link to the profile or admin member list. Add “手动录入成员” to the admin sidebar and a direct call-to-action on the members page. Keep the form responsive and keyboard accessible.

- [ ] **Step 4: Run focused tests to verify they pass**

Run: `npm.cmd exec tsx -- --test tests/admin/manual-member-route.test.ts tests/admin/real-authorization.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/api/admin/members/manual app/admin/members/new components/admin/ManualMemberForm.tsx app/admin/layout.tsx app/admin/members/page.tsx app/globals.css tests/admin/manual-member-route.test.ts
git commit -m "feat: add admin manual member entry"
```

### Task 4: 完成运行环境、全量验证与发布

**Files:**
- Modify: `.env.example`, `README.md`
- Test: existing full suite and rendered HTML suite

**Interfaces:**
- Consumes: `ADMIN_EMAILS` production environment value and the completed protected admin routes.
- Produces: production deployment where `jl5319604@gmail.com` is the only admin allowlist entry.

- [ ] **Step 1: Add failing configuration documentation test**

```ts
test("README identifies ADMIN_EMAILS as required for production administration", () => {
  const readme = readFileSync("README.md", "utf8");
  assert.match(readme, /ADMIN_EMAILS/);
  assert.match(readme, /jl5319604@gmail\.com/);
});
```

- [ ] **Step 2: Run the documentation test to verify it fails**

Run: `npm.cmd exec tsx -- --test tests/admin/admin-config.test.ts`

Expected: FAIL because the administrator runtime variable is not documented.

- [ ] **Step 3: Document and configure the production allowlist**

Document `ADMIN_EMAILS` in `.env.example` and `README.md` as a server-only comma-separated production allowlist. Configure it in Sites as a secret value containing only `jl5319604@gmail.com`; do not commit the real value into the repository.

- [ ] **Step 4: Run all verification commands**

Run: `npm.cmd run test:unit`

Expected: PASS with zero failures.

Run: `npm.cmd run build`

Expected: exit code 0 and a generated `dist/server/index.js`.

- [ ] **Step 5: Commit and publish**

```bash
git add .env.example README.md tests/admin/admin-config.test.ts
git commit -m "docs: configure production admin allowlist"
```

Push the verified commit to the configured Sites source repository, package the validated `dist/` output with `scripts/package-site.sh`, save a version, deploy privately, and verify the deployment reaches `succeeded`.
