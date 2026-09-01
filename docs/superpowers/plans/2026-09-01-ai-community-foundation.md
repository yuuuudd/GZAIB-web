# AI 社群基础 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在现有高校共建者地图上增加可独立上线的 AI 社群目录、城市聚合地图、轻量详情、关注、认领/更新投稿与运营审核闭环。

**Architecture:** 沿用现有 feature/service/repository 分层和 D1/Drizzle 数据边界。公开读取只投影 `published` 社群与动态；所有创建、资料更新、认领和动态发布先进入审核表，由运营原子地发布并写入审计日志。地图新增独立的社群城市聚合层，不复用或伪造学校/个人坐标。

**Tech Stack:** TypeScript 5.9、React 19、Vinext 1 beta、Cloudflare D1、Drizzle ORM、Node test runner、现有高德 JS API 2.0 适配层。

**Spec:** `docs/superpowers/specs/2026-09-01-ai-ecosystem-hub-design.md`

## Global Constraints

- 地域范围以广东为核心，全国社群均可收录；默认视图仍聚焦广东。
- 社群只展示主要活跃城市；纯线上社群不得拥有伪造经纬度。
- 未审核、被拒绝、下架和待修改数据不能进入公开 API、地图、搜索或页面 HTML。
- 社群官方入口和来源只允许 `https` URL；联系负责人通过现有成员资料/连接路径，不公开联系方式。
- 所有负责人提交的资料和动态必须再次审核，不允许直接覆盖公开版本。
- 首期不增加站内社群成员管理、评论、群聊、排行榜或复杂活跃指标。
- 不新增第三方运行时依赖；Node.js 版本继续要求 `>=22.13.0`。
- 所有数据库写入由服务端身份决定提交者/审核者，客户端字段不能覆盖用户 ID。
- 每项任务先写失败测试、验证失败，再写最小实现并提交。

---

## File Structure

### 数据与领域

- `db/schema.ts`：新增六张社群表；只声明持久化结构和索引。
- `drizzle/0004_ai_community_foundation.sql`：D1 可执行迁移。
- `drizzle/meta/_journal.json`：登记迁移顺序。
- `features/communities/types.ts`：公开 DTO、内部记录、筛选和审核输入类型。
- `features/communities/validation.ts`：文本、标签、地区模式和 HTTPS URL 的纯校验函数。
- `features/communities/service.ts`：公开目录/详情、关注、投稿、认领和更新领域规则。
- `features/admin/communities.ts`：运营审核状态机与审计记录生成。
- `lib/db/repositories/communities.ts`：所有社群相关 D1 查询和原子写入。

### HTTP 与页面

- `app/api/communities/route.ts`：公开目录 JSON。
- `app/api/communities/[slug]/route.ts`：公开详情 JSON。
- `app/api/community-submissions/route.ts`：登录用户提交新社群或资料变更。
- `app/api/community-claims/route.ts`：登录用户提交认领。
- `app/api/community-updates/route.ts`：已审核负责人提交动态。
- `app/api/community-follows/route.ts`：关注/取消关注。
- `app/api/admin/communities/[kind]/[id]/route.ts`：运营审核统一边界。
- `app/communities/page.tsx`、`app/communities/[slug]/page.tsx`：公开目录与轻量详情。
- `app/communities/submit/page.tsx`、`app/me/communities/page.tsx`：投稿和管理入口。
- `app/admin/communities/page.tsx`：运营待审核列表。

### UI 与地图

- `components/communities/CommunityDirectory.tsx`：筛选、目录卡片与空状态。
- `components/communities/CommunityProfile.tsx`：轻量社群详情。
- `components/communities/CommunityActions.tsx`：关注、官方入口和负责人资料入口。
- `components/communities/CommunitySubmissionForm.tsx`：创建/资料更新/认领/动态四种表单模式。
- `components/admin/CommunityReviewPanel.tsx`：审核操作。
- `features/map/community-map.ts`：社群城市聚合纯函数。
- `components/map/CommunityMap.tsx`：社群地图状态、API 读取与列表降级。
- `components/map/CommunityMapCanvas.tsx`：仅绘制城市聚合点和城市轮廓。
- `components/map/EcosystemMapSwitcher.tsx`：贡献者地图与社群地图的视图切换。

---

### Task 1: 社群数据库结构与迁移

**Files:**
- Modify: `db/schema.ts`
- Create: `drizzle/0004_ai_community_foundation.sql`
- Modify: `drizzle/meta/_journal.json`
- Modify: `tests/schema.test.ts`

**Interfaces:**
- Produces: `communities`, `communityProfileSubmissions`, `communityClaims`, `communityManagers`, `communityUpdates`, `communityFollows` Drizzle 表导出。
- Produces: 所有后续 repository 使用的 `$inferSelect` / `$inferInsert` 类型。

- [ ] **Step 1: 写 schema 导出失败测试**

在 `tests/schema.test.ts` 追加：

```ts
test("community foundation schema exports every required table", () => {
  for (const name of [
    "communities", "communityProfileSubmissions", "communityClaims",
    "communityManagers", "communityUpdates", "communityFollows",
  ]) assert.ok(name in schema, `missing ${name}`);
});
```

- [ ] **Step 2: 运行测试并确认失败**

Run: `npx.cmd tsx --test tests/schema.test.ts`

Expected: FAIL，错误包含 `missing communities`。

- [ ] **Step 3: 在 `db/schema.ts` 增加精确表结构**

使用以下字段与枚举；所有时间均为毫秒 Unix 时间：

```ts
export const communities = sqliteTable("communities", {
  id: text("id").primaryKey(),
  slug: text("slug").notNull(),
  name: text("name").notNull(),
  summary: text("summary").notNull(),
  primaryCity: text("primary_city"),
  locationMode: text("location_mode", { enum: ["city", "hybrid", "online"] }).notNull(),
  focusTagsJson: text("focus_tags_json").notNull().default("[]"),
  officialUrl: text("official_url").notNull(),
  sourceUrl: text("source_url").notNull(),
  sourceLabel: text("source_label").notNull(),
  publishStatus: text("publish_status", { enum: ["draft", "published", "archived"] }).notNull().default("draft"),
  publishedAt: integer("published_at"),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
}, (t) => [
  uniqueIndex("ux_communities_slug").on(t.slug),
  index("idx_communities_status_city").on(t.publishStatus, t.primaryCity),
]);

export const communityProfileSubmissions = sqliteTable("community_profile_submissions", {
  id: text("id").primaryKey(),
  communityId: text("community_id").references(() => communities.id),
  submitterUserId: text("submitter_user_id").notNull().references(() => users.id),
  kind: text("kind", { enum: ["create", "update"] }).notNull(),
  name: text("name").notNull(),
  summary: text("summary").notNull(),
  primaryCity: text("primary_city"),
  locationMode: text("location_mode", { enum: ["city", "hybrid", "online"] }).notNull(),
  focusTagsJson: text("focus_tags_json").notNull(),
  officialUrl: text("official_url").notNull(),
  sourceUrl: text("source_url").notNull(),
  sourceLabel: text("source_label").notNull(),
  status: text("status", { enum: ["pending", "changes_requested", "approved", "rejected"] }).notNull(),
  submittedAt: integer("submitted_at").notNull(),
  reviewedAt: integer("reviewed_at"),
  reviewedBy: text("reviewed_by").references(() => users.id),
  reviewReason: text("review_reason"),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
}, (t) => [index("idx_community_submissions_status").on(t.status, t.submittedAt)]);

export const communityClaims = sqliteTable("community_claims", {
  id: text("id").primaryKey(),
  communityId: text("community_id").notNull().references(() => communities.id),
  applicantUserId: text("applicant_user_id").notNull().references(() => users.id),
  evidence: text("evidence").notNull(),
  evidenceUrl: text("evidence_url"),
  status: text("status", { enum: ["pending", "changes_requested", "approved", "rejected"] }).notNull(),
  submittedAt: integer("submitted_at").notNull(),
  reviewedAt: integer("reviewed_at"),
  reviewedBy: text("reviewed_by").references(() => users.id),
  reviewReason: text("review_reason"),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
}, (t) => [index("idx_community_claims_status").on(t.status, t.submittedAt)]);

export const communityManagers = sqliteTable("community_managers", {
  communityId: text("community_id").notNull().references(() => communities.id),
  userId: text("user_id").notNull().references(() => users.id),
  role: text("role", { enum: ["owner", "editor"] }).notNull().default("owner"),
  createdAt: integer("created_at").notNull(),
}, (t) => [primaryKey({ columns: [t.communityId, t.userId] }), index("idx_community_managers_user").on(t.userId)]);

export const communityUpdates = sqliteTable("community_updates", {
  id: text("id").primaryKey(),
  communityId: text("community_id").notNull().references(() => communities.id),
  submitterUserId: text("submitter_user_id").notNull().references(() => users.id),
  title: text("title").notNull(),
  summary: text("summary").notNull(),
  occurredAt: integer("occurred_at").notNull(),
  sourceUrl: text("source_url"),
  status: text("status", { enum: ["pending", "changes_requested", "published", "rejected", "archived"] }).notNull(),
  submittedAt: integer("submitted_at").notNull(),
  reviewedAt: integer("reviewed_at"),
  reviewedBy: text("reviewed_by").references(() => users.id),
  reviewReason: text("review_reason"),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
}, (t) => [index("idx_community_updates_public").on(t.communityId, t.status, t.occurredAt)]);

export const communityFollows = sqliteTable("community_follows", {
  communityId: text("community_id").notNull().references(() => communities.id),
  userId: text("user_id").notNull().references(() => users.id),
  createdAt: integer("created_at").notNull(),
}, (t) => [primaryKey({ columns: [t.communityId, t.userId] }), index("idx_community_follows_user").on(t.userId, t.createdAt)]);
```

在 SQL 迁移中使用完全相同的表名、外键、唯一约束和索引。向 `_journal.json` 追加 `idx: 4`、`tag: "0004_ai_community_foundation"`。

- [ ] **Step 4: 运行 schema 与完整单元测试**

Run: `npx.cmd tsx --test tests/schema.test.ts`

Expected: PASS。

Run: `npm.cmd run test:unit`

Expected: 现有测试全部 PASS。

- [ ] **Step 5: 提交数据库结构**

```powershell
git add db/schema.ts drizzle/0004_ai_community_foundation.sql drizzle/meta/_journal.json tests/schema.test.ts
git commit -m "feat: add AI community foundation schema"
```

---

### Task 2: 社群输入校验与领域类型

**Files:**
- Create: `features/communities/types.ts`
- Create: `features/communities/validation.ts`
- Create: `tests/communities/validation.test.ts`

**Interfaces:**
- Produces: `CommunityLocationMode`, `CommunityProfileInput`, `CommunityDirectoryQuery`, `PublicCommunity`, `PublicCommunityUpdate`。
- Produces: `validateCommunityProfileInput(value): CommunityProfileInput`、`validateClaimInput(value)`、`validateUpdateInput(value)`、`safeHttpsUrl(value, field)`。

- [ ] **Step 1: 写纯校验失败测试**

创建 `tests/communities/validation.test.ts`，至少覆盖：

```ts
test("online communities reject a city while city and hybrid require one", () => {
  assert.throws(() => validateCommunityProfileInput(valid({ locationMode: "online", primaryCity: "广州" })), /线上社群/);
  assert.throws(() => validateCommunityProfileInput(valid({ locationMode: "city", primaryCity: "" })), /主要城市/);
  assert.equal(validateCommunityProfileInput(valid({ locationMode: "online", primaryCity: null })).primaryCity, null);
});

test("community URLs must be https and input keys are allowlisted", () => {
  assert.throws(() => validateCommunityProfileInput(valid({ officialUrl: "http://example.com" })), /HTTPS/);
  assert.throws(() => validateCommunityProfileInput({ ...valid(), submitterUserId: "forged" }), /字段/);
});

test("normalizes unique focus tags and enforces concise copy", () => {
  const result = validateCommunityProfileInput(valid({ focusTags: ["Agent", " Agent ", "产品"] }));
  assert.deepEqual(result.focusTags, ["Agent", "产品"]);
  assert.throws(() => validateCommunityProfileInput(valid({ focusTags: Array.from({ length: 9 }, (_, i) => `标签${i}`) })), /标签/);
});
```

`valid()` 返回名称 2–80 字、简介 10–300 字、城市 2–40 字、1–8 个标签（单个 1–24 字）、`https` 官方与来源 URL、来源名称 2–80 字。

- [ ] **Step 2: 运行测试并确认模块不存在**

Run: `npx.cmd tsx --test tests/communities/validation.test.ts`

Expected: FAIL with `Cannot find module`。

- [ ] **Step 3: 实现类型和精确校验契约**

在 `types.ts` 定义：

```ts
export type CommunityLocationMode = "city" | "hybrid" | "online";
export type CommunityProfileInput = {
  name: string;
  summary: string;
  primaryCity: string | null;
  locationMode: CommunityLocationMode;
  focusTags: string[];
  officialUrl: string;
  sourceUrl: string;
  sourceLabel: string;
};
export type CommunityDirectoryQuery = { q?: string; city?: string; locationMode?: CommunityLocationMode; focus?: string };
export type PublicCommunityUpdate = { id: string; title: string; summary: string; occurredAt: number; sourceUrl?: string };
export type PublicCommunity = CommunityProfileInput & {
  id: string;
  slug: string;
  claimed: boolean;
  updatedAt: number;
  contactSlug?: string;
  updates: PublicCommunityUpdate[];
  followed?: boolean;
};
```

在 `validation.ts` 使用 `Object.keys()` 严格 allowlist；所有文本先 `normalize("NFKC").trim()`；URL 通过 `new URL()` 验证 `protocol === "https:"`，禁止用户名和密码。`validateClaimInput` 只接受 `communityId`、20–500 字 `evidence` 和可选 HTTPS `evidenceUrl`。`validateUpdateInput` 只接受 `communityId`、2–100 字标题、10–500 字摘要、有效毫秒时间和可选 HTTPS 来源。

- [ ] **Step 4: 运行校验测试**

Run: `npx.cmd tsx --test tests/communities/validation.test.ts`

Expected: PASS。

- [ ] **Step 5: 提交领域契约**

```powershell
git add features/communities/types.ts features/communities/validation.ts tests/communities/validation.test.ts
git commit -m "feat: define AI community validation contracts"
```

---

### Task 3: 公开社群目录与详情读取

**Files:**
- Create: `features/communities/service.ts`
- Create: `lib/db/repositories/communities.ts`
- Create: `app/api/communities/route.ts`
- Create: `app/api/communities/[slug]/route.ts`
- Create: `tests/communities/service.test.ts`
- Create: `tests/communities/routes.test.ts`

**Interfaces:**
- Consumes: Task 1 表导出与 Task 2 DTO/校验类型。
- Produces: `createCommunityDirectoryService(repository)`，包含 `list(query, viewerId?)` 与 `getBySlug(slug, viewerId?)`。
- Produces: `createCommunityRepository(db)` 和 `createRuntimeCommunityDirectoryService()`。
- Produces: `GET /api/communities` 返回 `{ items, citySummaries }`；`GET /api/communities/:slug` 返回 `{ community }`。

- [ ] **Step 1: 写服务过滤与投影失败测试**

核心测试：

```ts
test("public directory excludes non-published communities and non-published updates", async () => {
  const service = createCommunityDirectoryService(repository([
    community({ slug: "visible", publishStatus: "published" }),
    community({ slug: "draft", publishStatus: "draft" }),
  ], [
    update({ communityId: "visible-id", status: "published" }),
    update({ communityId: "visible-id", status: "pending", title: "secret" }),
  ]));
  const result = await service.list({});
  assert.deepEqual(result.items.map((item) => item.slug), ["visible"]);
  assert.equal(JSON.stringify(result).includes("secret"), false);
});

test("online communities never enter city summaries", async () => {
  const result = await createCommunityDirectoryService(repository([
    community({ id: "gz", primaryCity: "广州市", locationMode: "hybrid" }),
    community({ id: "online", primaryCity: null, locationMode: "online" }),
  ])).list({});
  assert.deepEqual(result.citySummaries, [{ city: "广州", communityCount: 1 }]);
});
```

再覆盖 NFKC 关键词、城市规范化、标签、线上模式、认领状态、最多三条动态、详情 404 和 viewer 的 `followed` 状态。

- [ ] **Step 2: 运行测试并确认失败**

Run: `npx.cmd tsx --test tests/communities/service.test.ts tests/communities/routes.test.ts`

Expected: FAIL，模块尚不存在。

- [ ] **Step 3: 实现 repository 接口与公开服务**

在 `service.ts` 定义并实现：

```ts
export type CommunityDirectoryRepository = {
  listPublished(limit: number): Promise<CommunityRecord[]>;
  findPublishedBySlug(slug: string): Promise<CommunityRecord | undefined>;
  listPublishedUpdates(communityIds: string[], limitPerCommunity: number): Promise<CommunityUpdateRecord[]>;
  listManagerContacts(communityIds: string[]): Promise<{ communityId: string; memberSlug: string }[]>;
  listClaimedCommunityIds(communityIds: string[]): Promise<string[]>;
  listFollowedCommunityIds(userId: string, communityIds: string[]): Promise<string[]>;
};
```

服务最多读取 2,000 个公开社群；目录按最近更新倒序、名称次序排序；详情只接受 `/^[a-z0-9][a-z0-9-]{0,79}$/` slug。`safeJsonArray` 复用 `lib/db/repositories/directory.ts` 的安全解析，且标签最多返回八个。

Repository 的所有公开查询都在 SQL `WHERE` 中限定 `publish_status = 'published'`；动态限定 `status = 'published'`。城市统一去掉末尾“市”。纯线上条目不加入 `citySummaries`。

- [ ] **Step 4: 实现可注入的路由处理器**

`app/api/communities/route.ts` 导出 `handleCommunityList(request, dependencies)`；`dependencies.viewerId` 失败时降级为访客而不是 500。只接受 `q`、`city`、`locationMode`、`focus`，每项最长 100 字。

`app/api/communities/[slug]/route.ts` 导出 `handleCommunityDetail(request, { params }, dependencies)`；不存在返回 404，存储错误返回 503。公开响应设置 `Cache-Control: public, max-age=60, stale-while-revalidate=300`；登录后的 `followed` 响应设置 `private, no-store`。

- [ ] **Step 5: 运行服务与路由测试**

Run: `npx.cmd tsx --test tests/communities/service.test.ts tests/communities/routes.test.ts`

Expected: PASS。

Run: `npm.cmd run test:unit`

Expected: 全部 PASS。

- [ ] **Step 6: 提交公开读取链路**

```powershell
git add features/communities/service.ts lib/db/repositories/communities.ts app/api/communities tests/communities/service.test.ts tests/communities/routes.test.ts
git commit -m "feat: expose reviewed AI community directory"
```

---

### Task 4: 社群目录、轻量详情与主导航

**Files:**
- Create: `app/communities/page.tsx`
- Create: `app/communities/[slug]/page.tsx`
- Create: `components/communities/CommunityDirectory.tsx`
- Create: `components/communities/CommunityProfile.tsx`
- Create: `components/communities/CommunityActions.tsx`
- Modify: `app/page.tsx`
- Modify: `app/layout.tsx`
- Modify: `app/globals.css`
- Create: `tests/communities/pages.test.ts`
- Modify: `tests/rendered-html.test.mjs`

**Interfaces:**
- Consumes: `PublicCommunity` 和 `createRuntimeCommunityDirectoryService()`。
- Produces: `/communities` 与 `/communities/:slug` 可公开浏览页面。
- Produces: 所有页面共用的文案“AI 社群”“AI 资讯”“活动赛事”。

- [ ] **Step 1: 写页面语义失败测试**

在 `tests/communities/pages.test.ts` 读取源文件并断言：

```ts
test("community pages expose the lightweight profile actions and no vanity leaderboard", () => {
  const source = readFileSync("components/communities/CommunityProfile.tsx", "utf8");
  assert.match(source, /关注社群/);
  assert.match(source, /官方入口/);
  assert.match(source, /联系负责人/);
  assert.doesNotMatch(source, /排行榜|活跃指数|成员总数/);
});
```

在渲染测试追加 `/communities` 的标题、筛选标签和空状态；详情 fixture 只允许输出公开动态，不得包含 `reviewReason`、提交者 ID 或审核者 ID。

- [ ] **Step 2: 运行测试并确认失败**

Run: `npx.cmd tsx --test tests/communities/pages.test.ts`

Expected: FAIL，页面不存在。

- [ ] **Step 3: 实现目录与详情组件**

`CommunityDirectory` 使用 GET 查询参数的原生表单，字段固定为 `q`、`city`、`locationMode`、`focus`。卡片只展示名称、城市/纯线上、一句话简介、最多三个标签、认领状态和最近更新时间。

`CommunityProfile` 固定顺序为：名称与状态 → 简介与标签 → 三个操作 → 最近动态（最多三条） → “活动与赛事即将接入”的轻量占位。不得添加指标卡、页签或排行榜。

`CommunityActions`：

- 未登录时“关注社群”链接到 `/apply` 并说明审核成员可关注。
- 已登录时渲染可切换按钮，调用 Task 6 的 `/api/community-follows`；Task 6 完成前可先传入 `followEnabled={false}`，测试必须固定禁用态文案。
- “官方入口”直接使用已校验 HTTPS URL，并设置 `target="_blank" rel="noopener noreferrer external"`，可见文本包含目标域名。
- 有 `contactSlug` 时链接到 `/members/{contactSlug}`；没有时不渲染“联系负责人”。

- [ ] **Step 4: 更新首页导航与元数据**

在 `app/page.tsx` 主导航新增 `/communities`，同时增加仅作为后续入口的 `/news` 与 `/events` 文案；在对应页面尚未实现前，不创建死链接，而是以非链接文本标记“即将上线”。

将 `app/layout.tsx` 标题调整为“广州 AI 共创社｜共建者、AI 社群与行动机会”，描述调整为“发现广东及全国 AI 共建者与社群，了解他们正在做什么，并找到值得关注的 AI 行动机会。”

- [ ] **Step 5: 添加响应式样式**

在 `app/globals.css` 新增 `community-*` 命名空间；桌面目录最多三列，`max-width: 760px` 时单列；按钮在 320px 宽度下换行且不横向溢出。复用现有品牌色变量和边框风格，不改变现有地图/成员/后台选择器。

- [ ] **Step 6: 运行页面、渲染与 lint 测试**

Run: `npx.cmd tsx --test tests/communities/pages.test.ts`

Expected: PASS。

Run: `npm.cmd run lint`

Expected: PASS。

- [ ] **Step 7: 提交公开页面**

```powershell
git add app/communities components/communities app/page.tsx app/layout.tsx app/globals.css tests/communities/pages.test.ts tests/rendered-html.test.mjs
git commit -m "feat: add lightweight AI community pages"
```

---

### Task 5: 社群城市聚合地图与列表降级

**Files:**
- Create: `features/map/community-map.ts`
- Create: `components/map/CommunityMap.tsx`
- Create: `components/map/CommunityMapCanvas.tsx`
- Create: `components/map/EcosystemMapSwitcher.tsx`
- Modify: `app/page.tsx`
- Modify: `app/globals.css`
- Create: `tests/map/community-map.test.ts`
- Create: `tests/map/ecosystem-map-switcher.test.ts`

**Interfaces:**
- Consumes: `/api/communities` 的 `items` 与 `citySummaries`。
- Produces: `groupCommunitiesByCity(items): CommunityCitySummary[]`。
- Produces: `<EcosystemMapSwitcher initialView="builders" />`，在现有 `<BuilderMap />` 与 `<CommunityMap />` 间切换。

- [ ] **Step 1: 写城市聚合与降级失败测试**

```ts
test("groups communities by normalized city and excludes online-only entries", () => {
  assert.deepEqual(groupCommunitiesByCity([
    community({ id: "a", primaryCity: "广州市", locationMode: "city" }),
    community({ id: "b", primaryCity: "广州", locationMode: "hybrid" }),
    community({ id: "c", primaryCity: null, locationMode: "online" }),
  ]).map(({ city, communityCount }) => ({ city, communityCount })), [{ city: "广州", communityCount: 2 }]);
});
```

源文件测试还应断言 `CommunityMap` 同时包含 `CommunityMapCanvas` 和可操作的城市/社群列表，不允许只渲染地图 canvas。

- [ ] **Step 2: 运行测试并确认失败**

Run: `npx.cmd tsx --test tests/map/community-map.test.ts tests/map/ecosystem-map-switcher.test.ts`

Expected: FAIL，模块不存在。

- [ ] **Step 3: 实现纯聚合与稳定城市中心**

`CommunityCitySummary` 精确类型：

```ts
export type CommunityCitySummary = {
  city: string;
  communityCount: number;
  center: { lng: number; lat: number };
  communities: Pick<PublicCommunity, "id" | "slug" | "name" | "summary" | "focusTags">[];
};
```

复用 `features/map/semantic-map.ts` 已有广东城市中心；为北京、上海、杭州、成都、武汉、西安补充明确常量。未知非广东城市不伪造中心，只进入全国目录且不绘制点位。聚合按数量倒序、城市名次序排序。

- [ ] **Step 4: 实现地图 Canvas 与降级目录**

`CommunityMapCanvas` 复用 `AmapLoader` 类型，只绘制城市轮廓和城市聚合 Marker；Marker 文案为“城市名 + 社群数”。点击后选择城市并在同一区域展示社群列表。不得显示道路、商业 POI 或社群精确地址。

`CommunityMap` 请求失败时显示“社群地图暂时无法读取”，但保留指向 `/communities` 的目录入口。高德失败时仍用已经读取的 `citySummaries` 和社群列表浏览。

- [ ] **Step 5: 将首页地图替换为视图切换器**

在 `app/page.tsx` 用 `<EcosystemMapSwitcher initialView="builders" />` 替换直接 `<BuilderMap />`。切换按钮精确文案为“高校共建者”和“AI 社群”；默认保持现有地图，避免回归首屏体验。

- [ ] **Step 6: 运行地图回归与 lint**

Run: `npx.cmd tsx --test tests/map/*.test.ts`

Expected: PASS，包括现有语义地图测试。

Run: `npm.cmd run lint`

Expected: PASS。

- [ ] **Step 7: 提交社群地图**

```powershell
git add features/map/community-map.ts components/map/CommunityMap.tsx components/map/CommunityMapCanvas.tsx components/map/EcosystemMapSwitcher.tsx app/page.tsx app/globals.css tests/map
git commit -m "feat: add city-level AI community map"
```

---

### Task 6: 登录用户关注、投稿、认领与社群动态

**Files:**
- Modify: `features/communities/service.ts`
- Modify: `lib/db/repositories/communities.ts`
- Create: `app/api/community-submissions/route.ts`
- Create: `app/api/community-claims/route.ts`
- Create: `app/api/community-updates/route.ts`
- Create: `app/api/community-follows/route.ts`
- Create: `app/communities/submit/page.tsx`
- Create: `app/me/communities/page.tsx`
- Create: `components/communities/CommunitySubmissionForm.tsx`
- Modify: `components/communities/CommunityActions.tsx`
- Create: `tests/communities/mutations.test.ts`
- Create: `tests/communities/mutation-routes.test.ts`

**Interfaces:**
- Consumes: Task 2 validators、`resolveRequestUserId(request)` 和 Task 1 写表。
- Produces: `submitProfile(userId, kind, communityId, input, now)`、`submitClaim(userId, input, now)`、`submitUpdate(userId, input, now)`、`setFollow(userId, communityId, following, now)`。

- [ ] **Step 1: 写身份与权限失败测试**

必须覆盖：

```ts
test("server identity overrides any client attempt to forge the submitter", async () => {
  const response = await handleCommunitySubmission(request({ ...validProfile(), submitterUserId: "admin" }), deps({ userId: "member-1" }));
  assert.equal(response.status, 400);
  assert.equal(store.saved.length, 0);
});

test("only an approved manager may submit an update", async () => {
  await assert.rejects(() => service.submitUpdate("stranger", validUpdate(), NOW), /负责人/);
  await service.submitUpdate("manager", validUpdate(), NOW);
  assert.equal(store.updates[0]?.status, "pending");
});

test("following is idempotent and cannot target an unpublished community", async () => {
  await service.setFollow("member", "published", true, NOW);
  await service.setFollow("member", "published", true, NOW + 1);
  assert.equal(store.follows.length, 1);
  await assert.rejects(() => service.setFollow("member", "draft", true, NOW), /社群不存在/);
});
```

再覆盖：非负责人不能提交 profile `update`；同一用户/社群不能存在两个 pending claim；changes-requested 记录可重新提交；客户端不能指定状态、审核人或发布时间。

- [ ] **Step 2: 运行测试并确认失败**

Run: `npx.cmd tsx --test tests/communities/mutations.test.ts tests/communities/mutation-routes.test.ts`

Expected: FAIL，mutation 方法和路由不存在。

- [ ] **Step 3: 扩展 repository 写接口与领域服务**

写接口必须是：

```ts
export type CommunityMutationRepository = {
  isPublishedCommunity(id: string): Promise<boolean>;
  isManager(userId: string, communityId: string): Promise<boolean>;
  hasPendingClaim(userId: string, communityId: string): Promise<boolean>;
  saveProfileSubmission(record: CommunityProfileSubmissionRecord): Promise<void>;
  saveClaim(record: CommunityClaimRecord): Promise<void>;
  saveUpdate(record: CommunityUpdateRecord): Promise<void>;
  setFollow(input: { userId: string; communityId: string; following: boolean; createdAt: number }): Promise<void>;
  listManagedCommunities(userId: string): Promise<ManagedCommunitySummary[]>;
};
```

所有创建记录由服务生成 `crypto.randomUUID()`；状态固定为 `pending`；`createdAt/submittedAt/updatedAt` 取服务端 `now`。`setFollow` 使用 `onConflictDoNothing` 和复合主键删除实现幂等。

- [ ] **Step 4: 实现四个认证路由**

每个路由先调用 `resolveRequestUserId`；未登录返回 401；JSON 解析或领域校验失败返回 400；存储失败记录服务器日志并返回 500。响应不得返回证据、审核字段或其他用户 ID。

`community-follows` 精确输入为 `{ communityId: string, following: boolean }`，多余字段拒绝。

- [ ] **Step 5: 实现投稿与我的社群页面**

`/communities/submit` 先提供“提交新社群”表单；`/me/communities` 展示已管理社群，并允许发起资料更新、认领和动态投稿。表单提交成功后显示“已提交，运营审核通过后公开”，不乐观更新公开页面。

把 `CommunityActions` 的关注按钮接到 follow API；成功后只更新按钮为“已关注”，失败显示 `role="status"` 文案。

- [ ] **Step 6: 运行 mutation、身份与完整单元测试**

Run: `npx.cmd tsx --test tests/communities/mutations.test.ts tests/communities/mutation-routes.test.ts tests/identity/*.test.ts`

Expected: PASS。

Run: `npm.cmd run test:unit`

Expected: 全部 PASS。

- [ ] **Step 7: 提交用户侧写入闭环**

```powershell
git add features/communities/service.ts lib/db/repositories/communities.ts app/api/community-submissions app/api/community-claims app/api/community-updates app/api/community-follows app/communities/submit app/me/communities components/communities tests/communities
git commit -m "feat: add reviewed community submissions and follows"
```

---

### Task 7: 运营审核与原子发布

**Files:**
- Create: `features/admin/communities.ts`
- Modify: `features/admin/authorization.ts`
- Modify: `lib/db/repositories/communities.ts`
- Create: `app/api/admin/communities/[kind]/[id]/route.ts`
- Create: `app/admin/communities/page.tsx`
- Create: `components/admin/CommunityReviewPanel.tsx`
- Modify: `app/admin/layout.tsx`
- Create: `tests/admin/communities.test.ts`
- Create: `tests/admin/community-routes.test.ts`

**Interfaces:**
- Consumes: `authorizeAdminRoute`、待审核记录和审计日志表。
- Produces: `parseCommunityReviewAction(value)` 和 `createCommunityAdminService(repository)`。
- Produces: `reviewProfileSubmission`、`reviewClaim`、`reviewUpdate` 原子状态转换。

- [ ] **Step 1: 写审核状态机失败测试**

```ts
test("approving a create submission publishes one community and one audit atomically", async () => {
  const result = await service.review("demo-admin", "profile", "submission-1", { decision: "approve" }, NOW);
  assert.equal(result.status, "approved");
  assert.equal(store.communities[0]?.publishStatus, "published");
  assert.deepEqual(store.audits.map((row) => row.action), ["community.profile_approved"]);
});

test("approving a claim creates manager access only after the audit gate succeeds", async () => {
  await service.review("demo-admin", "claim", "claim-1", { decision: "approve" }, NOW);
  assert.deepEqual(store.managers, [{ communityId: "community-1", userId: "member-1", role: "owner" }]);
});

test("a repeated or concurrent review cannot publish twice", async () => {
  await service.review("demo-admin", "update", "update-1", { decision: "approve" }, NOW);
  await assert.rejects(() => service.review("demo-admin", "update", "update-1", { decision: "approve" }, NOW + 1), /状态已变化/);
  assert.equal(store.audits.length, 1);
});
```

还需覆盖 reject/changes_requested 必须提供 2–300 字理由，approve 不接受任意公开字段覆盖，非管理员返回 403。

- [ ] **Step 2: 运行测试并确认失败**

Run: `npx.cmd tsx --test tests/admin/communities.test.ts tests/admin/community-routes.test.ts`

Expected: FAIL，审核模块不存在。

- [ ] **Step 3: 扩展审计枚举**

在 `features/admin/authorization.ts` 增加：

```ts
"community.profile_approved",
"community.profile_changes_requested",
"community.profile_rejected",
"community.claim_approved",
"community.claim_changes_requested",
"community.claim_rejected",
"community.update_published",
"community.update_changes_requested",
"community.update_rejected",
"community.archived",
```

将 `AuditRecord.targetType` 扩展为包含 `community`、`community_submission`、`community_claim`、`community_update`。

- [ ] **Step 4: 实现严格审核解析器与服务**

输入精确为：

```ts
type CommunityReviewAction =
  | { decision: "approve" }
  | { decision: "changes_requested"; reason: string }
  | { decision: "reject"; reason: string };
```

Repository 使用 D1 `db.batch()` 和“先插入审计门记录，再以 `exists(audit)` 为条件更新”的现有模式：

- profile create：创建/更新 `communities` 公布版本，再将 submission 标为 approved。
- profile update：只从存储的 submission 复制 allowlisted 字段到 community，不读取客户端 profile 数据。
- claim approve：插入 manager 复合主键，再更新 claim。
- update approve：将待审核 update 标为 published。
- 任何源记录不再是 pending 时整批操作不产生第二次审计，服务返回“状态已变化”。

- [ ] **Step 5: 实现统一运营路由和后台页面**

路由 `kind` 仅允许 `profile | claim | update`；ID 最大 160 字；先 `authorizeAdminRoute`。后台页面分别列出三组 pending 项，显示来源、提交者公开昵称或邮箱、字段差异、证据和时间。

`CommunityReviewPanel` 提供“通过”“要求修改”“拒绝”；后两项必须填写理由。成功后用 `router.refresh()` 更新计数。

在 `app/admin/layout.tsx` 增加“AI 社群审核”导航。

- [ ] **Step 6: 运行后台权限与原子性测试**

Run: `npx.cmd tsx --test tests/admin/communities.test.ts tests/admin/community-routes.test.ts tests/admin/real-authorization.test.ts`

Expected: PASS。

Run: `npm.cmd run test:unit`

Expected: 全部 PASS。

- [ ] **Step 7: 提交审核闭环**

```powershell
git add features/admin/communities.ts features/admin/authorization.ts lib/db/repositories/communities.ts app/api/admin/communities app/admin/communities components/admin/CommunityReviewPanel.tsx app/admin/layout.tsx tests/admin
git commit -m "feat: add audited AI community review workflow"
```

---

### Task 8: Demo 数据、端到端回归与交付验证

**Files:**
- Modify: `db/demo-seed.ts`
- Modify: `tests/admin/demo-seed.test.ts`
- Create: `tests/communities/full-flow.test.ts`
- Modify: `tests/rendered-html.test.mjs`
- Modify: `README.md`

**Interfaces:**
- Consumes: Tasks 1–7 所有公开与审核接口。
- Produces: 可重复初始化的虚构社群数据和一条完整可演练流程。

- [ ] **Step 1: 写 Demo 数据与全流程失败测试**

Demo 数据至少包含：

```ts
[
  { slug: "demo-guangzhou-ai-builders", primaryCity: "广州", locationMode: "hybrid", publishStatus: "published" },
  { slug: "demo-shenzhen-agent-lab", primaryCity: "深圳", locationMode: "city", publishStatus: "published" },
  { slug: "demo-online-ai-makers", primaryCity: null, locationMode: "online", publishStatus: "published" },
]
```

三者必须明确标注“演示虚构”，每个社群有一条 published 动态。`full-flow.test.ts` 走通：访客列表 → 成员关注 → 成员提交新社群 → 管理员通过 → 新社群公开 → 申请认领 → 管理员通过 → 负责人提交动态 → 管理员发布 → 访客详情只看到已发布动态。

- [ ] **Step 2: 运行测试并确认失败**

Run: `npx.cmd tsx --test tests/admin/demo-seed.test.ts tests/communities/full-flow.test.ts`

Expected: FAIL，seed 尚未包含社群记录或全流程接口不完整。

- [ ] **Step 3: 扩展幂等 Demo seed**

将 communities、communityManagers、communityUpdates 加入 `DemoSeed` 和 `DemoSeedCounts`。Repository 使用 `onConflictDoNothing()`，重复初始化不得产生重复社群、负责人或动态。`demo-member` 作为一个虚构社群负责人，供联系/认领演练。

- [ ] **Step 4: 更新 README 的本地迁移与演练步骤**

在本地初始化命令中追加：

```powershell
npx.cmd wrangler d1 execute site-creator-d1 --local --config wrangler.local.jsonc --file=drizzle/0004_ai_community_foundation.sql --persist-to=.wrangler/state
```

新增演练：运营员初始化 → 浏览 `/communities` → 成员关注 → 成员提交社群 → 管理员在 `/admin/communities` 审核 → 认领 → 发布动态。明确所有数据为虚构，不能直接公开运营。

- [ ] **Step 5: 运行完整验证**

Run: `npm.cmd run test:unit`

Expected: 全部 PASS。

Run: `npm.cmd run lint`

Expected: PASS。

Run: `npm.cmd run build`

Expected: PASS，生成 `/communities`、`/communities/[slug]`、投稿和后台路由。

Run: `node --test tests/rendered-html.test.mjs`

Expected: PASS，公开 HTML 不包含审核理由、证据、内部用户 ID 或未发布动态。

Run: `git diff --check`

Expected: 无输出。

- [ ] **Step 6: 手工浏览器验收**

依次验证：

1. 首页默认仍是高校共建者地图，可切换到 AI 社群。
2. 社群地图失败时城市与社群列表仍可操作。
3. `/communities` 可筛选广州、纯线上和标签。
4. 详情页只有简介、标签、关注、官方入口、负责人入口和三条以内动态。
5. 官方入口显示目标域名并在新窗口打开。
6. 未登录不能关注或投稿；非负责人不能更新社群。
7. 审核前内容在公开 API、页面和搜索中均不存在。
8. 320px、768px 和桌面宽度无横向溢出。

- [ ] **Step 7: 提交社群基础阶段**

```powershell
git add db/demo-seed.ts tests/admin/demo-seed.test.ts tests/communities/full-flow.test.ts tests/rendered-html.test.mjs README.md
git commit -m "feat: complete AI community foundation"
```

---

## Phase Completion Gate

社群基础阶段只有在以下条件全部满足时完成：

- 六张新表及迁移可在全新本地 D1 上顺序执行。
- 公开目录、详情和地图仅返回 published 数据。
- 城市社群聚合不含纯线上社群，也不使用精确地址。
- 投稿、认领、资料更新和动态均需审核。
- 负责人联系不公开联系方式，官方入口只允许 HTTPS。
- 现有成员地图、隐私投影、连接、举报和管理员测试无回归。
- 单元测试、渲染测试、lint、build 与 diff check 全部通过。

通过后再编写并执行第二份计划 `AI 资讯与活动赛事`，不在本计划中提前加入文章、赛事或公众号 API 表。
