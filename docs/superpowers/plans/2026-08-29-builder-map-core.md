# 广东高校共建者地图核心系统 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 建成可公开浏览的广东高校共建者地图 Demo，以及可替换的模拟身份会话、申请审核、资料公开控制、贡献认证和运营后台。

**Architecture:** 使用 Sites 的 Vinext/React 应用作为同仓全栈 Web 项目；D1 保存结构化数据，R2 保存头像，高德 JS API 2.0 提供地图与学校点聚合。业务规则集中在 `features/*`，路由只做输入、鉴权和输出转换；公开地图始终读取经过审核和可见性投影后的数据。

**Tech Stack:** TypeScript 5.9、React 19、Vinext、Cloudflare Workers、D1、Drizzle ORM、R2、高德地图 JS API 2.0、Resend HTTP API、Node test runner + `tsx`

**Spec:** `docs/superpowers/specs/2026-08-29-guangdong-builder-map-design.md`

## Global Constraints

- 使用 Sites 当前的 `vinext-starter` 初始化项目，保留 `sites()` Vite 插件、npm 和锁文件。
- Node.js 版本不得低于 `22.13.0`。
- 生产绑定固定为 D1 `DB` 和 R2 `AVATARS`；浏览器存储不能作为业务数据源。
- 所有 D1 查询使用 Drizzle 或单条 prepared statement；一条 `prepare()` 只包含一条 SQL。
- 地图只保存学校/校区坐标，不请求浏览器定位，不保存成员独立坐标。
- 公开查询只返回 `approved + active + published` 且字段可见级别允许的数据。
- 当前 Demo 只使用服务端固定的“共建者/运营员”模拟身份；不发送登录邮件、不接入真实账号，不允许客户端提交任意用户 ID 或角色。
- Demo 会话使用服务端密钥签名的 HttpOnly Cookie，仅在 `DEMO_MODE=true` 时启用，8 小时过期；正式认证将在后续接公众号服务时替换同一会话接口。
- 高德安全密钥只在服务端环境变量中；前端只使用 Web JS API key 和固定 `serviceHost`。
- Demo 模拟登录必须在页面持续显示“演示模式”，README 必须明确禁止将其作为正式登录直接发布。
- 第一阶段不实现连接请求、联系方式交换、聊天、动态、关注、活动报名或公众号通知。
- 未经用户明确要求，不执行截图、DOM 点击或浏览器视觉 QA；用单元、集成、构建和渲染 HTML 测试验收。
- 每个任务结束后运行该任务列出的测试并提交；若执行环境仍未初始化 Git，Task 1 先初始化仓库。

---

## File Structure

```text
.openai/hosting.json                 # Sites 的 D1/R2 逻辑绑定
.env.example                        # 非秘密配置名和本地占位值
app/
  layout.tsx                         # 中文元数据、全局布局、社交预览
  page.tsx                           # 公共地图首页
  apply/page.tsx                     # 申请点亮流程
  apply/status/page.tsx              # 申请状态
  members/[slug]/page.tsx            # 成员资料页
  me/page.tsx                        # 成员资料与公开设置
  admin/page.tsx                     # 运营后台入口
  admin/applications/page.tsx        # 申请审核
  admin/schools/page.tsx             # 学校坐标管理
  admin/contributions/page.tsx       # 贡献确认
  admin/members/page.tsx             # 成员隐藏、恢复与暂停
  api/auth/magic-link/request/route.ts
  api/auth/magic-link/consume/route.ts
  api/auth/logout/route.ts
  api/applications/route.ts
  api/directory/route.ts
  api/members/[slug]/route.ts
  api/avatars/[...key]/route.ts       # 从私有 R2 安全读取公开头像
  api/me/profile/route.ts
  api/uploads/avatar/route.ts
  api/admin/applications/[id]/route.ts
  api/admin/schools/route.ts
  api/admin/contributions/route.ts
  api/amap/[...path]/route.ts         # 固定目标的高德安全代理
components/
  map/AmapLoader.tsx                 # JS API 加载和失败状态
  map/BuilderMap.tsx                 # 地图、聚合、筛选联动
  map/SchoolDirectoryFallback.tsx    # 地图失败的列表模式
  directory/DirectoryFilters.tsx
  directory/MemberPreviewCard.tsx
  directory/SchoolDrawer.tsx
  forms/ApplicationForm.tsx
  forms/VisibilityField.tsx
  admin/ApplicationReviewPanel.tsx
features/
  identity/types.ts                  # 会话与用户类型
  identity/demo-auth.ts              # 固定模拟身份与签名载荷
  identity/session.ts                # 会话 Cookie
  applications/types.ts
  applications/validation.ts
  applications/service.ts
  directory/types.ts
  directory/public-profile.ts        # 可见性投影
  directory/service.ts
  contributions/service.ts
  admin/authorization.ts
  notifications/types.ts             # 申请、审核及第二阶段连接共用的通知端口
  notifications/in-app.ts
lib/
  db/index.ts
  db/repositories/*.ts
  env.ts
  http.ts
  ids.ts
  time.ts
db/
  schema.ts
  seed-schools.ts
drizzle/*.sql
public/logo.png
public/og.png
tests/
  setup.ts
  schema.test.ts
  identity/*.test.ts
  applications/*.test.ts
  directory/*.test.ts
  admin/*.test.ts
  rendered-html.test.mjs
worker/index.ts
```

---

### Task 1: 初始化 Sites 项目、测试框架与品牌外壳

**Files:**
- Create: Sites starter files at repository root
- Create: `.env.example`
- Create: `tests/setup.ts`
- Modify: `package.json`
- Modify: `app/layout.tsx`
- Modify: `app/page.tsx`
- Modify: `app/globals.css`
- Create: `public/logo.png` copied from `logo终稿.png`
- Remove: `app/_sites-preview/*`
- Test: `tests/rendered-html.test.mjs`

**Interfaces:**
- Consumes: approved design spec and existing `logo终稿.png`
- Produces: a running Sites/Vinext app, `npm run test:unit`, `npm test`, and stable brand shell used by every later task

- [ ] **Step 1: Initialize the project and Git repository**

Run the current Sites `scripts/init-site.sh` once with the workspace root as its target. Then initialize Git only if `git rev-parse --is-inside-work-tree` fails:

```bash
bash "C:/Users/王🐟哒/.codex/plugins/cache/openai-bundled/sites/0.1.34/scripts/init-site.sh" "$PWD"
git init
```

Expected: `package.json`, `app/page.tsx`, `vite.config.ts`, `worker/index.ts`, and `.openai/hosting.json` exist; existing community documents and logos remain untouched.

- [ ] **Step 2: Add the TypeScript unit-test runner**

Run:

```bash
npm install --save-dev tsx
```

Add scripts to `package.json`:

```json
{
  "scripts": {
    "test:unit": "tsx --test tests/**/*.test.ts",
    "test:render": "npm run build && node --test tests/rendered-html.test.mjs",
    "test": "npm run test:unit && npm run test:render"
  }
}
```

- [ ] **Step 3: Write the failing brand render test**

Replace the starter assertion in `tests/rendered-html.test.mjs` with:

```js
import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

test("home page contains the approved brand and primary action", async () => {
  const html = await readFile("dist/client/index.html", "utf8");
  assert.match(html, /广州AI共创社/);
  assert.match(html, /让广东每一所高校/);
  assert.match(html, /申请点亮我的头像/);
  assert.doesNotMatch(html, /codex-preview/);
});
```

- [ ] **Step 4: Run the render test and verify the starter fails**

Run:

```bash
npm run test:render
```

Expected: FAIL because the starter page still contains preview copy and `codex-preview` metadata.

- [ ] **Step 5: Replace the starter with the brand shell**

Set `app/layout.tsx` metadata and language exactly as follows, keeping the starter font wiring:

```tsx
export const metadata: Metadata = {
  title: "广东高校共建者地图｜广州AI共创社",
  description: "看见广东不同学校与城市中愿意分享、愿意行动的青年共建者。",
  icons: { icon: "/logo.png", shortcut: "/logo.png" },
};

// Root element:
<html lang="zh-CN">
```

Replace `app/page.tsx` with a server-rendered shell containing the exact headline and CTA from the spec. Remove `app/_sites-preview` and `react-loading-skeleton`, refresh `package-lock.json`, and copy `logo终稿.png` to `public/logo.png` without deleting the source.

Create `.env.example`:

```dotenv
NEXT_PUBLIC_AMAP_JS_KEY=
AMAP_SECURITY_JS_CODE=
AMAP_SERVICE_HOST=/api/amap
RESEND_API_KEY=
EMAIL_FROM=广州AI共创社 <no-reply@example.com>
SESSION_SIGNING_KEY=
CONTACT_ENCRYPTION_KEY=
ADMIN_EMAILS=
APP_ORIGIN=http://localhost:3000
```

- [ ] **Step 6: Run tests and build**

Run:

```bash
npm run test:unit
npm run test:render
```

Expected: both commands PASS and the build contains no starter preview marker.

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json app public .env.example tests worker vite.config.ts .openai docs
git commit -m "chore: initialize builder map site"
```

---

### Task 2: 建立 D1/R2 绑定与核心数据库结构

**Files:**
- Modify: `.openai/hosting.json`
- Modify: `db/schema.ts`
- Modify: `db/index.ts`
- Create: `tests/schema.test.ts`
- Create: `drizzle/0000_builder_map_core.sql`

**Interfaces:**
- Consumes: starter `getDb()` and Drizzle configuration
- Produces: exported tables `users`, `magicLinkTokens`, `sessions`, `schools`, `applications`, `memberProfiles`, `profileVisibility`, `contributions`, `notifications`, `dailyMetrics`, `auditLogs`

- [ ] **Step 1: Write the failing schema contract test**

Create `tests/schema.test.ts`:

```ts
import assert from "node:assert/strict";
import test from "node:test";
import * as schema from "../db/schema";

test("core schema exports every required table", () => {
  for (const name of [
    "users", "magicLinkTokens", "sessions", "schools", "applications",
    "memberProfiles", "profileVisibility", "contributions", "notifications", "dailyMetrics", "auditLogs",
  ]) assert.ok(name in schema, `missing ${name}`);
});
```

- [ ] **Step 2: Run the schema test and verify it fails**

Run:

```bash
npm run test:unit -- tests/schema.test.ts
```

Expected: FAIL with `missing users`.

- [ ] **Step 3: Configure logical bindings**

Set `.openai/hosting.json` to:

```json
{
  "d1": "DB",
  "r2": "AVATARS"
}
```

Extend `worker/index.ts` `Env` with `AVATARS: R2Bucket` while retaining the starter image optimizer bindings.

- [ ] **Step 4: Implement the core Drizzle schema**

Use `text()` UUID primary keys, integer millisecond timestamps, and the following exact columns:

```ts
import { index, integer, primaryKey, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull(),
  role: text("role", { enum: ["member", "admin"] }).notNull().default("member"),
  status: text("status", { enum: ["active", "hidden", "connection_suspended", "suspended", "deleted"] }).notNull().default("active"),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
}, (t) => [uniqueIndex("ux_users_email").on(t.email), index("idx_users_status").on(t.status)]);

export const schools = sqliteTable("schools", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  campus: text("campus").notNull().default("主校区"),
  city: text("city").notNull(),
  longitude: integer("longitude_e6").notNull(),
  latitude: integer("latitude_e6").notNull(),
  coordinateStatus: text("coordinate_status", { enum: ["suggested", "confirmed"] }).notNull().default("suggested"),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
}, (t) => [uniqueIndex("ux_schools_name_campus").on(t.name, t.campus), index("idx_schools_city").on(t.city)]);
```

Define the remaining tables with these exact columns and enums. Store structured arrays as JSON text with parsing confined to repository mappers:

```ts
export const magicLinkTokens = sqliteTable("magic_link_tokens", {
  id: text("id").primaryKey(), userId: text("user_id").notNull().references(() => users.id),
  tokenHash: text("token_hash").notNull(), purpose: text("purpose", { enum: ["application", "member_login", "admin_login"] }).notNull(),
  expiresAt: integer("expires_at").notNull(), usedAt: integer("used_at"), createdAt: integer("created_at").notNull(),
}, (t) => [uniqueIndex("ux_magic_link_token_hash").on(t.tokenHash), index("idx_magic_link_expiry").on(t.expiresAt)]);

export const sessions = sqliteTable("sessions", {
  id: text("id").primaryKey(), userId: text("user_id").notNull().references(() => users.id),
  tokenHash: text("token_hash").notNull(), expiresAt: integer("expires_at").notNull(), revokedAt: integer("revoked_at"),
  createdAt: integer("created_at").notNull(), lastSeenAt: integer("last_seen_at").notNull(),
}, (t) => [uniqueIndex("ux_sessions_token_hash").on(t.tokenHash), index("idx_sessions_user_expiry").on(t.userId, t.expiresAt)]);

export const applications = sqliteTable("applications", {
  id: text("id").primaryKey(), userId: text("user_id").notNull().references(() => users.id),
  status: text("status", { enum: ["draft", "pending", "changes_requested", "approved", "rejected", "withdrawn"] }).notNull(),
  nickname: text("nickname").notNull(), realName: text("real_name"), avatarKey: text("avatar_key"), schoolId: text("school_id").notNull().references(() => schools.id),
  major: text("major"), grade: text("grade"), intro: text("intro").notNull(), currentFocus: text("current_focus"),
  canOffer: text("can_offer"), wantsToMeet: text("wants_to_meet"), skillsJson: text("skills_json").notNull().default("[]"),
  interestsJson: text("interests_json").notNull().default("[]"), rolesJson: text("roles_json").notNull().default("[]"),
  workLinksJson: text("work_links_json").notNull().default("[]"), visibilityJson: text("visibility_json").notNull().default("{}"),
  consentVersion: text("consent_version").notNull(), consentAcceptedAt: integer("consent_accepted_at").notNull(),
  submittedAt: integer("submitted_at"), reviewedAt: integer("reviewed_at"), reviewedBy: text("reviewed_by").references(() => users.id),
  reviewReason: text("review_reason"), createdAt: integer("created_at").notNull(), updatedAt: integer("updated_at").notNull(),
}, (t) => [uniqueIndex("ux_applications_user").on(t.userId), index("idx_applications_status_submitted").on(t.status, t.submittedAt)]);

export const memberProfiles = sqliteTable("member_profiles", {
  id: text("id").primaryKey(), userId: text("user_id").notNull().references(() => users.id), slug: text("slug").notNull(),
  nickname: text("nickname").notNull(), realName: text("real_name"), avatarKey: text("avatar_key"), schoolId: text("school_id").notNull().references(() => schools.id),
  major: text("major"), grade: text("grade"), intro: text("intro").notNull(), currentFocus: text("current_focus"),
  canOffer: text("can_offer"), wantsToMeet: text("wants_to_meet"), skillsJson: text("skills_json").notNull().default("[]"),
  interestsJson: text("interests_json").notNull().default("[]"), rolesJson: text("roles_json").notNull().default("[]"),
  workLinksJson: text("work_links_json").notNull().default("[]"), publishStatus: text("publish_status", { enum: ["unpublished", "published", "pending_school_review"] }).notNull(),
  verifiedBuilder: integer("verified_builder", { mode: "boolean" }).notNull().default(false), publishedAt: integer("published_at"),
  createdAt: integer("created_at").notNull(), updatedAt: integer("updated_at").notNull(),
}, (t) => [uniqueIndex("ux_member_profiles_user").on(t.userId), uniqueIndex("ux_member_profiles_slug").on(t.slug), index("idx_member_profiles_publish_school").on(t.publishStatus, t.schoolId)]);

export const profileVisibility = sqliteTable("profile_visibility", {
  id: text("id").primaryKey(), profileId: text("profile_id").notNull().references(() => memberProfiles.id, { onDelete: "cascade" }),
  fieldName: text("field_name").notNull(), visibility: text("visibility", { enum: ["public", "members", "private"] }).notNull(),
  updatedAt: integer("updated_at").notNull(),
}, (t) => [uniqueIndex("ux_profile_visibility_field").on(t.profileId, t.fieldName)]);

export const contributions = sqliteTable("contributions", {
  id: text("id").primaryKey(), profileId: text("profile_id").notNull().references(() => memberProfiles.id), activityKey: text("activity_key").notNull(),
  title: text("title").notNull(), activityDate: integer("activity_date").notNull(), role: text("role").notNull(), outcome: text("outcome").notNull(),
  publicSummary: text("public_summary").notNull(), visibility: text("visibility", { enum: ["public", "members", "private"] }).notNull().default("public"),
  status: text("status", { enum: ["pending", "confirmed", "rejected"] }).notNull(), confirmedBy: text("confirmed_by").references(() => users.id),
  confirmedAt: integer("confirmed_at"), createdAt: integer("created_at").notNull(), updatedAt: integer("updated_at").notNull(),
}, (t) => [index("idx_contributions_profile_status").on(t.profileId, t.status), index("idx_contributions_activity_status").on(t.activityKey, t.status)]);

export const notifications = sqliteTable("notifications", {
  id: text("id").primaryKey(), userId: text("user_id").notNull().references(() => users.id), type: text("type").notNull(),
  title: text("title").notNull(), body: text("body").notNull(), href: text("href").notNull(), dedupeKey: text("dedupe_key").notNull(),
  deliveryStatus: text("delivery_status", { enum: ["pending", "sent", "failed"] }).notNull().default("pending"),
  readAt: integer("read_at"), createdAt: integer("created_at").notNull(), updatedAt: integer("updated_at").notNull(),
}, (t) => [uniqueIndex("ux_notifications_dedupe").on(t.dedupeKey), index("idx_notifications_user_read_created").on(t.userId, t.readAt, t.createdAt)]);

export const dailyMetrics = sqliteTable("daily_metrics", {
  metricDate: text("metric_date").notNull(), eventType: text("event_type", { enum: ["map_view", "profile_view", "map_to_profile"] }).notNull(),
  dimensionKey: text("dimension_key").notNull().default("all"), count: integer("count").notNull().default(0), updatedAt: integer("updated_at").notNull(),
}, (t) => [primaryKey({ columns: [t.metricDate, t.eventType, t.dimensionKey] })]);

export const auditLogs = sqliteTable("audit_logs", {
  id: text("id").primaryKey(), actorUserId: text("actor_user_id").references(() => users.id), targetType: text("target_type").notNull(),
  targetId: text("target_id").notNull(), action: text("action").notNull(), diffJson: text("diff_json").notNull().default("{}"),
  createdAt: integer("created_at").notNull(),
}, (t) => [index("idx_audit_target_created").on(t.targetType, t.targetId, t.createdAt)]);
```

- [ ] **Step 5: Generate and inspect the migration**

Run:

```bash
npm run db:generate
```

Rename the generated migration to `drizzle/0000_builder_map_core.sql` if needed. Verify each statement is separate, foreign keys reference existing tables, and the migration creates indexes for `applications(status, submitted_at)`, `member_profiles(publish_status, school_id)`, `contributions(profile_id, status)`, and token/session expiry.

- [ ] **Step 6: Run schema tests and build**

```bash
npm run test:unit -- tests/schema.test.ts
npm run build
```

Expected: PASS; build recognizes both logical bindings.

- [ ] **Step 7: Commit**

```bash
git add .openai/hosting.json worker/index.ts db drizzle tests/schema.test.ts
git commit -m "feat: add core member directory schema"
```

---

### Task 3: 建立领域类型、可见性投影和仓储边界

**Files:**
- Create: `features/directory/types.ts`
- Create: `features/directory/public-profile.ts`
- Create: `features/applications/types.ts`
- Create: `lib/db/repositories/directory.ts`
- Create: `lib/db/repositories/applications.ts`
- Create: `lib/db/repositories/contributions.ts`
- Create: `tests/directory/public-profile.test.ts`

**Interfaces:**
- Produces: `Visibility = "public" | "members" | "private"`; `Viewer = { kind: "visitor" } | { kind: "member"; userId: string } | { kind: "admin"; userId: string }`; `projectProfile(profile, visibility, viewer): ProjectedProfile`
- Produces: repository functions `listPublishedDirectory(filters)`, `getPublishedProfileBySlug(slug)`, `saveApplication(input)`, `reviewApplication(input)`, `listApprovedContributions(profileId)`

- [ ] **Step 1: Write failing visibility tests**

Create `tests/directory/public-profile.test.ts` with cases asserting that a visitor receives only public fields, a member receives public and member fields, an admin receives all reviewable fields, and nobody receives `loginEmail`, `reviewNotes`, or private contact data through this projector:

```ts
assert.deepEqual(projectProfile(profile, rules, { kind: "visitor" }), {
  slug: "lin-tong-xue",
  nickname: "林同学",
  avatarUrl: "/avatars/lin.webp",
  school: "中山大学",
  city: "广州",
  intro: "关注 AI 产品与教育",
  skills: ["产品设计", "AI应用"],
  roles: ["活动共建者"],
  verifiedBuilder: true,
  contributions: [],
});
```

- [ ] **Step 2: Run the tests and verify they fail**

```bash
npm run test:unit -- tests/directory/public-profile.test.ts
```

Expected: FAIL because `projectProfile` does not exist.

- [ ] **Step 3: Implement exact domain types and projector**

Define `MemberProfileRecord`, `VisibilityRules`, and `ProjectedProfile` in `features/directory/types.ts`. Implement a field allowlist rather than deleting forbidden keys after serialization:

```ts
const PUBLIC_FIELDS = ["nickname", "avatarUrl", "school", "city", "intro", "skills", "roles", "verifiedBuilder", "contributions"] as const;
const MEMBER_FIELDS = ["currentFocus", "canOffer", "wantsToMeet", "workLinks", "major", "grade"] as const;
```

`projectProfile` copies only allowlisted fields whose stored visibility permits the current viewer. Admin review data is returned through a separate admin DTO, never through `ProjectedProfile`.

- [ ] **Step 4: Implement repository interfaces and D1 adapters**

Each repository receives `ReturnType<typeof getDb>` and returns domain DTOs. Public directory SQL must include all three predicates:

```ts
eq(applications.status, "approved"),
eq(users.status, "active"),
eq(memberProfiles.publishStatus, "published")
```

Parse JSON with `safeJsonArray(value)` that returns `[]` for malformed legacy values and never throws from a public route.

- [ ] **Step 5: Run tests and type/build checks**

```bash
npm run test:unit -- tests/directory/public-profile.test.ts
npm run build
```

Expected: PASS; private fields are absent rather than present with `null` values.

- [ ] **Step 6: Commit**

```bash
git add features lib/db/repositories tests/directory
git commit -m "feat: enforce profile visibility projection"
```

---

### Task 4: 实现 Demo 模拟身份与安全会话

**Files:**
- Create: `features/identity/types.ts`
- Create: `features/identity/demo-auth.ts`
- Create: `features/identity/session.ts`
- Create: `features/notifications/types.ts`
- Create: `lib/db/repositories/identity.ts`
- Create: `lib/db/repositories/notifications.ts`
- Create: `lib/env.ts`
- Create: `app/api/auth/demo-login/route.ts`
- Create: `app/api/auth/logout/route.ts`
- Create: `components/auth/DemoIdentitySwitcher.tsx`
- Modify: `app/layout.tsx`
- Modify: `app/globals.css`
- Create: `tests/identity/demo-auth.test.ts`
- Create: `tests/identity/session.test.ts`

**Interfaces:**
- Produces: two server-owned identities, `demo-member` and `demo-admin`, with fixed roles and safe display names
- Produces: `createDemoSession(identity, now)`, `verifyDemoSession(cookie, now)`, `requireSession(request)`, `clearSession(response)`
- Produces: `NotificationSender.send(message): Promise<DeliveryResult>` as an in-app notification port

- [ ] **Step 1: Record the product decision before coding**

The user selected Demo-only simulated identities on 2026-08-29 after the current Sites authentication reference ruled out silently scaffolding app-owned public sign-in. Record this decision in the commit message body. Do not add ChatGPT sign-in, email magic links, OAuth, passwords, or real emails.

- [ ] **Step 2: Write failing demo-session tests**

Cover the fixed role allowlist, `DEMO_MODE` gating, HMAC tamper rejection, 8-hour expiry, cookie attributes, and rejection of client-supplied user IDs or role escalation:

```ts
test("demo session rejects tampering and expires after eight hours", async () => {
  const cookie = await createDemoSession("member", 1_000, secret);
  await assert.rejects(() => verifyDemoSession(`${cookie}x`, 2_000, secret), /invalid/i);
  await assert.rejects(() => verifyDemoSession(cookie, 28_801_001, secret), /expired/i);
});
```

- [ ] **Step 3: Run the tests and verify they fail**

```bash
npm run test:unit -- tests/identity/demo-auth.test.ts tests/identity/session.test.ts
```

Expected: FAIL because demo identity modules do not exist.

- [ ] **Step 4: Implement fixed identities and signed sessions**

Define the two identities in server code and map the only accepted input values `member` and `admin` to them. Sign a versioned base64url JSON payload with HMAC-SHA-256 using `DEMO_SESSION_SECRET`. Session cookies must be `HttpOnly`, `Secure` in production, `SameSite=Lax`, path `/`, and expire after 8 hours. Reject missing/short secrets outside tests. Do not put emails, contacts, arbitrary user IDs, or client-provided roles in the payload.

Ensure the fixed identities exist in D1 before issuing a session, using idempotent repository writes. Keep all later callers behind the generic session interface so公众号认证 can replace Demo auth without changing application/admin services.

- [ ] **Step 5: Implement the explicit Demo switcher and logout**

`POST /api/auth/demo-login` accepts only `{ identity: "member" | "admin", returnTo?: string }`, works only when `DEMO_MODE=true`, and redirects only to a same-origin relative path. `POST /api/auth/logout` expires the session cookie. Add a persistent “演示模式” banner and identity switcher; visually distinguish “以共建者体验” and “以运营员体验”. Never imply this is a real account.

- [ ] **Step 6: Run identity tests and build**

```bash
npm run test:unit -- tests/identity/*.test.ts
npm run build
```

Expected: PASS, including tamper, role escalation, disabled-mode, expiry, and open-redirect rejection tests.

- [ ] **Step 7: Commit**

```bash
git add features/identity features/notifications lib/env.ts lib/db/repositories/identity.ts lib/db/repositories/notifications.ts app/api/auth components/auth app/layout.tsx app/globals.css tests/identity
git commit -m "feat: add demo identity sessions"
```

---

### Task 5: 实现申请点亮、逐项公开设置和审核状态

**Files:**
- Create: `features/applications/validation.ts`
- Create: `features/applications/service.ts`
- Create: `components/forms/ApplicationForm.tsx`
- Create: `components/forms/VisibilityField.tsx`
- Create: `app/apply/page.tsx`
- Create: `app/apply/status/page.tsx`
- Create: `app/api/applications/route.ts`
- Create: `tests/applications/validation.test.ts`
- Create: `tests/applications/service.test.ts`

**Interfaces:**
- Consumes: `requireSession`, `ApplicationRepository`, `schools`
- Produces: `ApplicationInput`; `submitApplication(userId, input, now)`; `getApplicationStatus(userId)`

- [ ] **Step 1: Write failing application validation tests**

Cover required nickname, confirmed school, intro length, allowed URLs, enumerated role/skill values, visibility values, and consent version:

```ts
assert.deepEqual(validateApplication(validInput), { ok: true, value: validInput });
assert.equal(validateApplication({ ...validInput, schoolId: "" }).ok, false);
assert.equal(validateApplication({ ...validInput, consentAccepted: false }).ok, false);
```

- [ ] **Step 2: Run tests and verify they fail**

```bash
npm run test:unit -- tests/applications/*.test.ts
```

Expected: FAIL because validation/service modules do not exist.

- [ ] **Step 3: Implement application validation and state transitions**

Allow transitions `draft -> pending`, `changes_requested -> pending`, and `pending -> withdrawn` for applicants. Reject direct client attempts to set `approved` or `rejected`. Use exact limits: nickname 2–30 characters, intro 10–160, current focus/can offer/wants to meet 500 each, maximum 8 skills, 6 interests, 4 roles, and 5 HTTPS work links.

- [ ] **Step 4: Implement the form and public-field controls**

The form groups identity, school, direction, participation, works, and privacy. Every optional profile field renders `VisibilityField` with values:

```ts
[
  { value: "public", label: "所有访客可见" },
  { value: "members", label: "仅审核成员可见" },
  { value: "private", label: "仅自己和必要管理员可见" },
]
```

Default new optional fields to `private`; nickname, school, city, avatar, intro, skills, roles, builder status, and approved contributions must be public to appear on the map. Explain that hiding these required public fields hides the profile from the map.

- [ ] **Step 5: Implement authenticated application routes**

`GET /api/applications` returns only the current user's application. `POST` creates/submits with server-derived `userId`; ignore any client-supplied owner/status. Persist the accepted consent version string `builder-map-2026-08-29` and timestamp.

- [ ] **Step 6: Run tests and build**

```bash
npm run test:unit -- tests/applications/*.test.ts
npm run build
```

Expected: PASS; an unconfirmed school or missing consent cannot be submitted.

- [ ] **Step 7: Commit**

```bash
git add features/applications components/forms app/apply app/api/applications tests/applications
git commit -m "feat: add reviewed profile application flow"
```

---

### Task 6: 实现学校目录、高德地图和无地图降级视图

**Files:**
- Create: `features/directory/service.ts`
- Create: `app/api/directory/route.ts`
- Create: `app/api/members/[slug]/route.ts`
- Create: `app/api/metrics/route.ts`
- Create: `app/api/amap/[...path]/route.ts`
- Create: `components/map/AmapLoader.tsx`
- Create: `components/map/BuilderMap.tsx`
- Create: `components/map/SchoolDirectoryFallback.tsx`
- Create: `components/directory/DirectoryFilters.tsx`
- Create: `components/directory/SchoolDrawer.tsx`
- Create: `components/directory/MemberPreviewCard.tsx`
- Modify: `app/page.tsx`
- Create: `tests/directory/service.test.ts`
- Create: `tests/directory/amap-proxy.test.ts`
- Create: `tests/directory/metrics.test.ts`

**Interfaces:**
- Produces: `DirectoryQuery = { city?: string; schoolId?: string; skills?: string[]; roles?: string[]; verified?: boolean; q?: string }`
- Produces: `DirectorySchool = { id; name; campus; city; lng; lat; memberCount; previewMembers[] }`
- Consumes: `projectProfile`, `NEXT_PUBLIC_AMAP_JS_KEY`, `AMAP_SECURITY_JS_CODE`

- [ ] **Step 1: Write failing directory and proxy tests**

Test that pending/hidden/private profiles never enter results, filters combine with AND semantics, coordinates convert from integer microdegrees, and the AMap proxy refuses non-AMap destinations and unsupported methods. In `metrics.test.ts`, assert an allowed aggregate event increments exactly one daily counter and rejects profile ids, emails or arbitrary dimension keys:

```ts
assert.deepEqual(await service.list({ city: "广州", skills: ["AI应用"] }), [expectedSchool]);
assert.equal(await proxy(new Request("https://site/api/amap/https://evil.example")), 404);
assert.equal(await metrics.record({ eventType: "map_view", dimensionKey: "all" }, now), 1);
await assert.rejects(() => metrics.record({ eventType: "profile_view", dimensionKey: "profile:u1" }, now));
```

- [ ] **Step 2: Run tests and verify they fail**

```bash
npm run test:unit -- tests/directory/service.test.ts tests/directory/amap-proxy.test.ts tests/directory/metrics.test.ts
```

Expected: FAIL because services and routes do not exist.

- [ ] **Step 3: Implement directory queries and DTOs**

Return schools grouped with `memberCount` and at most four preview avatars. Search only normalized nickname, school name, city, approved public skills, and roles. Add a hard response cap of 2,000 published profiles and cursor pagination for list mode; the map response aggregates by school instead of returning every full profile.

- [ ] **Step 4: Implement the fixed-target AMap proxy**

The route must derive its upstream from a server-side mapping, never from a client URL. Allow `GET` and `POST`, forward only required query/body data, append `AMAP_SECURITY_JS_CODE` server-side, and set a 10-second timeout. The mapping may include only official AMap hosts and the JS API security-service paths used by the deployed map. Reject all other paths with `404` and all other methods with `405`.

- [ ] **Step 5: Implement the client map loader and fallback state**

`AmapLoader` owns four states: `idle | loading | ready | failed`. It loads JS API 2.0 once, sets `window._AMapSecurityConfig = { serviceHost: "/api/amap" }` before loading, and emits `failed` after 12 seconds or a script error. `BuilderMap` uses `AMap.MarkerCluster` with custom React-free HTML markers. `SchoolDirectoryFallback` receives the exact same `DirectorySchool[]`, so map and list cannot disagree.

- [ ] **Step 6: Build the approved map homepage interaction**

Implement the concept direction: warm off-white surface, cobalt/orange brand accents, Guangdong-centered map, filter chips, school glow points, school drawer, member preview, statistics strip and four-step approval explanation. Use CSS rather than generated SVG illustration. All map items must also exist as keyboard-focusable list controls.

- [ ] **Step 7: Implement privacy-safe aggregate metrics**

Implement `POST /api/metrics` with allowed events `map_view`, `profile_view`, and `map_to_profile`. Store only UTC date, event type, aggregate dimension (`all` or a validated `school:<schoolId>`), count and update time using an atomic SQLite upsert; do not store IP address, email, profile id, user-agent or private connection data. The homepage records `map_view`; member navigation records `profile_view` and `map_to_profile` without creating member rankings.

- [ ] **Step 8: Run tests and build**

```bash
npm run test:unit -- tests/directory/*.test.ts
npm run build
```

Expected: PASS; unsetting `NEXT_PUBLIC_AMAP_JS_KEY` renders the fallback list without crashing.

- [ ] **Step 9: Commit**

```bash
git add features/directory components/map components/directory app/page.tsx app/api/directory app/api/members app/api/amap app/api/metrics tests/directory
git commit -m "feat: add public builder map directory"
```

---

### Task 7: 实现头像上传与安全公开

**Files:**
- Create: `features/directory/avatar.ts`
- Create: `app/api/uploads/avatar/route.ts`
- Create: `app/api/avatars/[...key]/route.ts`
- Create: `lib/r2.ts`
- Create: `tests/directory/avatar.test.ts`
- Modify: `components/forms/ApplicationForm.tsx`

**Interfaces:**
- Produces: `validateAvatar(file): AvatarValidationResult`; `storeAvatar(userId, file): Promise<{ objectKey: string; publicUrl: string }>`
- Consumes: R2 binding `AVATARS`, authenticated session

- [ ] **Step 1: Write failing avatar validation tests**

Test JPEG/PNG/WebP acceptance, GIF/SVG rejection, 5 MB source limit, non-image magic bytes rejection, and owner-scoped object keys.

```ts
assert.equal(validateAvatar(fakePng({ size: 1024 })).ok, true);
assert.equal(validateAvatar(fakeSvg()).ok, false);
assert.match(createAvatarKey("user-1", "webp"), /^avatars\/user-1\/[a-f0-9-]+\.webp$/);
```

- [ ] **Step 2: Run tests and verify they fail**

```bash
npm run test:unit -- tests/directory/avatar.test.ts
```

Expected: FAIL because avatar utilities do not exist.

- [ ] **Step 3: Implement safe upload handling**

Accept one multipart file, verify content signature and declared type, reject files above 5 MB, normalize orientation, transform to a square WebP no larger than 1024×1024 using the platform image pipeline, and store with `Cache-Control: public, max-age=31536000, immutable`. Save only the object key in D1.

- [ ] **Step 4: Implement authorization and replacement**

Only the current user can upload their avatar. Generate a new immutable key on replacement, update the profile transactionally, then delete the previous object after the database update succeeds. A failed delete is logged for cleanup and does not roll back the visible replacement.

Serve avatars through `GET /api/avatars/[...key]`. Accept only keys matching `avatars/<user-id>/<uuid>.webp`, read from the fixed `AVATARS` binding, return `404` for missing/invalid keys, set the stored content type, `X-Content-Type-Options: nosniff`, and immutable public cache headers. Do not expose a general R2 object browser.

- [ ] **Step 5: Run tests and build**

```bash
npm run test:unit -- tests/directory/avatar.test.ts
npm run build
```

Expected: PASS; SVG and oversized files return `400`, anonymous requests return `401`.

- [ ] **Step 6: Commit**

```bash
git add features/directory/avatar.ts app/api/uploads app/api/avatars lib/r2.ts components/forms/ApplicationForm.tsx tests/directory/avatar.test.ts
git commit -m "feat: add secure member avatar uploads"
```

---

### Task 8: 实现运营审核、学校坐标和贡献认证

**Files:**
- Create: `features/admin/authorization.ts`
- Create: `features/applications/review.ts`
- Create: `features/contributions/service.ts`
- Create: `app/admin/layout.tsx`
- Create: `app/admin/page.tsx`
- Create: `app/admin/applications/page.tsx`
- Create: `app/admin/schools/page.tsx`
- Create: `app/admin/contributions/page.tsx`
- Create: `app/admin/members/page.tsx`
- Create: `app/api/admin/applications/[id]/route.ts`
- Create: `app/api/admin/schools/route.ts`
- Create: `app/api/admin/contributions/route.ts`
- Create: `app/api/admin/members/[id]/route.ts`
- Create: `components/admin/ApplicationReviewPanel.tsx`
- Create: `tests/admin/review.test.ts`
- Create: `tests/admin/contributions.test.ts`
- Create: `tests/admin/member-status.test.ts`
- Create: `db/demo-seed.ts`
- Create: `app/api/admin/demo-seed/route.ts`
- Create: `tests/admin/demo-seed.test.ts`

**Interfaces:**
- Produces: `requireAdmin(session)`; `reviewApplication(adminId, applicationId, decision, now)`; `confirmContribution(adminId, input, now)`
- Consumes: core repositories and the signed fixed `demo-admin` session while `DEMO_MODE=true`

- [ ] **Step 1: Write failing authorization and transition tests**

Test that only allowlisted admin users can review, applicants cannot approve themselves, a school must be coordinate-confirmed before approval publishes, and every decision creates an audit log:

```ts
await assert.rejects(() => reviewAs(memberSession, input), /forbidden/);
const result = await reviewAs(adminSession, { applicationId: "a1", decision: "approved" });
assert.equal(result.profile.publishStatus, "published");
assert.equal(audit.rows[0].action, "application.approved");
```

- [ ] **Step 2: Run tests and verify they fail**

```bash
npm run test:unit -- tests/admin/*.test.ts
```

Expected: FAIL because admin services do not exist.

- [ ] **Step 3: Implement Demo admin authorization and audit writes**

Require the verified session to contain both `identity.id === "demo-admin"` and `identity.role === "admin"`, and require `DEMO_MODE=true` at the route boundary. Do not accept email, user ID, or role claims from the request. Keep the authorization interface transport-neutral for future公众号 auth. Use an explicit audit action union: `application.approved`, `application.changes_requested`, `application.rejected`, `school.coordinate_confirmed`, `contribution.confirmed`, `member.hidden`, `member.restored`, `member.connections_suspended`, `member.account_suspended`, `member.self_deleted`, `demo.seeded`.

- [ ] **Step 4: Implement application review atomically**

For approval, batch the application status update, profile upsert, visibility replacement, and audit insert. Reject approval if the school coordinate is not `confirmed`. For `changes_requested` and `rejected`, require a 10–500 character reason and never publish/update the public profile.

- [ ] **Step 5: Implement contribution confirmation**

Use fields `activityKey`, `title`, `activityDate`, `role`, `outcome`, `publicSummary`, and `status`. A profile is `verifiedBuilder = true` when at least one contribution is `confirmed`; recalculate after every contribution status change rather than persisting an irreversible badge. Add a test where the same `activityKey` has confirmed public contributions from two schools and assert the directory returns one aggregate collaboration link; unconfirmed/private contributions return no link. The map never derives links from private member connections.

- [ ] **Step 6: Build focused admin screens**

The review screen shows private application data only after server-side admin authorization. Buttons post exact decisions and show state-specific confirmation. School management geocodes a school name through the server and requires an administrator to confirm the proposed coordinate before publication. Member management allows `hide`, `restore`, `suspend_connections`, and `suspend_account` through the shared member-status service, with one audit row per action. The admin landing page derives totals for approved members, confirmed builders, schools, cities, pending applications, profile views and map-to-profile visits without exposing individual social rankings.

Add an idempotent Demo dataset initializer available only to the verified `demo-admin` while `DEMO_MODE=true`. It creates at least six Guangdong university/campus records across multiple cities, twelve clearly fictional members with public required fields, one pending application, and several confirmed public contributions/collaboration links. Use `.invalid` placeholder emails, no real names or contact details, no avatar object keys, and confirmed school coordinates. Expose a clearly labeled “初始化演示数据” admin action; repeated calls must not duplicate rows. Do not run or expose this initializer outside Demo mode.

- [ ] **Step 7: Run tests and build**

```bash
npm run test:unit -- tests/admin/*.test.ts
npm run build
```

Expected: PASS; direct requests by non-admin sessions return `403`.

- [ ] **Step 8: Commit**

```bash
git add features/admin features/applications/review.ts features/contributions app/admin app/api/admin components/admin tests/admin db/demo-seed.ts
git commit -m "feat: add application and contribution review"
```

---

### Task 9: 实现成员资料页、成员中心和即时公开控制

**Files:**
- Create: `app/members/[slug]/page.tsx`
- Create: `app/me/page.tsx`
- Create: `app/api/me/profile/route.ts`
- Create: `app/api/me/account/route.ts`
- Create: `features/identity/account-deletion.ts`
- Create: `components/directory/MemberProfile.tsx`
- Create: `components/forms/ProfileEditor.tsx`
- Create: `tests/directory/profile-access.test.ts`
- Create: `tests/directory/profile-update.test.ts`
- Create: `tests/identity/account-deletion.test.ts`

**Interfaces:**
- Consumes: `projectProfile`, `requireSession`, application/profile repositories
- Produces: public/member profile rendering and `updateOwnProfile(userId, patch, now)`
- Produces: `deleteOwnAccount(userId, confirmation, now)`

- [ ] **Step 1: Write failing profile access tests**

Cover visitor projection, member projection, owner editing, forbidden cross-user editing, immediate visibility changes, hidden profile behavior, stable slug lookup, and deletion with the exact confirmation phrase `删除我的账号`.

```ts
assert.equal((await getProfile("lin", visitor)).canOffer, undefined);
assert.equal((await getProfile("lin", member)).canOffer, "产品原型评审");
await assert.rejects(() => updateProfile("other-user", patch), /forbidden/);
```

- [ ] **Step 2: Run tests and verify they fail**

```bash
npm run test:unit -- tests/directory/profile-*.test.ts
```

Expected: FAIL because pages and update service do not exist.

- [ ] **Step 3: Implement profile route and page**

The server determines viewer type from the session and passes only `ProjectedProfile` to UI. Render the agreed sections, verified badge text plus icon, approved contributions, and a disabled “想认识 TA” teaser for visitors explaining that approved membership is required. The active button is added in the second plan.

- [ ] **Step 4: Implement owner-only profile updates**

Allow updates only to approved editable fields and visibility rules. School changes set the profile to `pending_school_review` and keep the prior published school until approved. Required map-public fields cannot be set private while `publishStatus = published`; offer “隐藏我的地图资料” as an explicit profile-level action instead.

Implement `DELETE /api/me/account` with the exact confirmation phrase `删除我的账号`. In one batch set the user to `deleted`, unpublish the profile, withdraw any pending application, revoke every session and write a self-service deletion audit row containing only the user id and timestamp. Return `204` and clear the current cookie. Phase two extends this service to delete contact cards and cancel pending connections.

Add responsive CSS at `max-width: 768px`: the map becomes full viewport height below the header; filters become horizontally scrollable; school/member content uses the bottom-drawer layout; forms become single-column. Keep all actions keyboard reachable and pair color badges with text/icons.

- [ ] **Step 5: Run tests and build**

```bash
npm run test:unit -- tests/directory/profile-*.test.ts
npm run build
```

Expected: PASS; visibility changes affect the next public query without a cache delay.

- [ ] **Step 6: Commit**

```bash
git add app/members app/me app/api/me features/identity/account-deletion.ts components/directory/MemberProfile.tsx components/forms/ProfileEditor.tsx tests/directory/profile-*.test.ts tests/identity/account-deletion.test.ts app/globals.css
git commit -m "feat: add member profiles and privacy controls"
```

---

### Task 10: 完成站内通知端口和核心系统验证

**Files:**
- Modify: `features/notifications/types.ts`
- Create: `features/notifications/in-app.ts`
- Modify: `lib/db/repositories/notifications.ts`
- Create: `tests/notifications/in-app.test.ts`
- Modify: application and review services to enqueue/send notifications
- Modify: `app/layout.tsx`
- Create: `public/og.png`
- Modify: `tests/rendered-html.test.mjs`
- Modify: `README.md`

**Interfaces:**
- Produces: `NotificationSender.send(message): Promise<DeliveryResult>`; `InAppNotificationSender`
- Consumes: the D1 `DB` binding only; external delivery remains an adapter point for公众号 service

- [ ] **Step 1: Write failing notification tests**

Test exact event mapping, generic in-app content without private review notes, and business success even when notification persistence fails:

```ts
assert.equal(message.subject, "你的共建者地图申请已通过");
assert.doesNotMatch(message.text, /internalReviewNotes/);
assert.equal(await service.approveApplication(input).status, "approved");
assert.equal(notifications.rows[0].deliveryStatus, "failed");
```

- [ ] **Step 2: Run tests and verify they fail**

```bash
npm run test:unit -- tests/notifications/in-app.test.ts
```

Expected: FAIL because the in-app adapter has no application/contribution event mapping yet.

- [ ] **Step 3: Implement the in-app notification adapter**

Support event types `application_submitted`, `application_approved`, `application_changes_requested`, `application_rejected`, and `contribution_confirmed`. Persist only the member-facing title/body/link and delivery status. Never store private review notes. Keep the port transport-neutral so a later公众号 adapter does not change application/review services.

- [ ] **Step 4: Generate exactly one site-specific social card**

After the visual direction and headline are stable, use image generation once to create `public/og.png` matching the blue/orange Guangdong map concept. Inspect text; retry only if unusable. Add absolute Open Graph and X metadata derived from the incoming request host; omit `og:image` rather than shipping a generic fallback if the card fails validation.

- [ ] **Step 5: Extend the rendered HTML test**

Assert Chinese language, title, description, primary CTA, privacy note, and absence of starter metadata. Add a unit test that every public profile DTO serializes without any of these keys:

```ts
for (const forbidden of ["email", "contactCard", "reviewNotes", "reportHistory", "sessionId"]) {
  assert.equal(JSON.stringify(dto).includes(`\"${forbidden}\"`), false);
}
```

- [ ] **Step 6: Run the complete phase-one verification**

Run:

```bash
npm run test:unit
npm run lint
npm run build
node --test tests/rendered-html.test.mjs
```

Expected: all commands PASS. Keep the development server running for Sites hosting, but do not perform browser clicking or screenshot QA unless the user separately requests it.

- [ ] **Step 7: Document environment and launch prerequisites**

In `README.md`, list the exact environment variable names, D1/R2 bindings, migration command, Demo identity procedure and publication warning, 高德 Web JS API key/security-key creation, future公众号 adapter point, and the 10–20 member private-beta checklist. Do not include real secrets.

- [ ] **Step 8: Commit**

```bash
git add features/notifications lib/db/repositories/notifications.ts tests app/layout.tsx public/og.png README.md
git commit -m "feat: complete reviewed builder map core"
```

## Phase-One Completion Gate

Phase one is complete only when:

- The public directory contains no pending, hidden, suspended, rejected, or private records.
- A real application can be submitted, reviewed and published without manual database edits.
- A member can change visibility and hide their profile.
- A confirmed contribution changes the badge deterministically.
- Map failure renders the school list with equivalent filters.
- Unit, lint, build and rendered HTML tests pass.
- Production uses D1 `DB`, R2 `AVATARS`, server-protected AMap security configuration and a configured email sender.
