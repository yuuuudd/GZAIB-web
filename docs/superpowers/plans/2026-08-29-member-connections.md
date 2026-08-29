# 共建者双向连接系统 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在已审核成员目录上增加无需运营转发的连接请求、双向同意后联系方式解锁、站内/邮件提醒、拉黑举报和运营安全处理。

**Architecture:** 连接系统作为独立领域模块叠加在核心成员目录上；服务端统一执行成员状态、频率、重复请求和拉黑检查。联系名片加密保存，接受连接只授予读取当前名片的权限，不复制明文；站内通知先落库，邮件投递失败不回滚连接状态。

**Tech Stack:** TypeScript、Vinext App Router、D1/Drizzle、Web Crypto AES-GCM、Resend HTTP API、Node test runner + `tsx`

**Spec:** `docs/superpowers/specs/2026-08-29-guangdong-builder-map-design.md`

## Global Constraints

### Binding Demo execution amendment (2026-08-30)

- This execution targets the user-approved lightweight local Demo and reuses the core plan's two fixed, server-owned Demo identities. Real public authentication and official-account identity remain deferred.
- Task 4 may extend the server-owned Demo identity allowlist with one additional fictional approved member persona so the sender and recipient sides can both be demonstrated without granting connection actions to the operator identity. The identity remains fixed server-side and is not a general sign-up path.
- The complete in-app connection flow is required. Real Resend/public-account delivery is optional at runtime and must fail without rolling back connection state; no real recipient messages are sent during Demo verification.
- Task 7 Steps 5–7 are replaced for this execution by configuration-contract checks, an updated local operations guide, and a retained local Demo server with browser-based visual/interaction verification. Do not publish, create hosted resources, apply remote migrations, or invent production secrets without a separate user authorization.
- In the Final Completion Gate, “Sites returns a deployed URL” is replaced by “the local Demo URL is healthy and the primary member/admin connection screens pass browser verification.” Public hosting remains a separately authorized handoff step.

- 必须先完成并通过 `docs/superpowers/plans/2026-08-29-builder-map-core.md` 的 Phase-One Completion Gate。
- 只有 `active` 的已审核成员可以发送连接请求；`connection_suspended`、`suspended`、`hidden` 和 `deleted` 用户不能发送。
- 每名发送者滚动 24 小时内最多创建 5 个请求；撤销、婉拒和被拉黑取消的请求仍计入当日上限。
- 请求正文不超过 500 字，不允许包含联系方式字段；同一成员对同时最多一个 `pending` 请求。
- 接受前不返回任何联系名片；接受后仍从名片表按当前权限读取，不把明文复制到请求记录。
- 任一方拉黑后立即取消双方待处理请求，并停止双方联系名片访问。
- 正常连接不经过运营团队；管理员只处理举报和账号状态。
- 第一版不加入即时聊天、好友列表公开、连接数量排名、已读回执或公众号通知。
- 所有权限和状态转换由服务端执行；客户端按钮不是安全边界。
- 未经用户明确要求，不执行浏览器点击、DOM 检查或截图 QA。

---

## File Structure

```text
app/
  me/connections/page.tsx
  me/contact-card/page.tsx
  me/blocked/page.tsx
  admin/reports/page.tsx
  api/connections/route.ts
  api/connections/[id]/route.ts
  api/me/contact-card/route.ts
  api/me/blocks/route.ts
  api/reports/route.ts
  api/admin/reports/[id]/route.ts
components/
  connections/ConnectButton.tsx
  connections/ConnectionRequestDialog.tsx
  connections/ConnectionInbox.tsx
  connections/ConnectionCard.tsx
  connections/ContactCardEditor.tsx
  safety/BlockButton.tsx
  safety/ReportDialog.tsx
  admin/ReportReviewPanel.tsx
features/
  connections/types.ts
  connections/policy.ts
  connections/service.ts
  connections/contact-card.ts
  safety/types.ts
  safety/service.ts
  notifications/connection-events.ts
lib/db/repositories/
  connections.ts
  contact-cards.ts
  safety.ts
db/schema.ts
drizzle/0001_member_connections.sql
tests/
  connections/policy.test.ts
  connections/service.test.ts
  connections/contact-card.test.ts
  connections/routes.test.ts
  notifications/connection-events.test.ts
  safety/service.test.ts
  safety/admin.test.ts
```

---

### Task 1: 扩展连接、安全和通知数据库结构

**Files:**
- Modify: `db/schema.ts`
- Create: `drizzle/0001_member_connections.sql`
- Modify: `tests/schema.test.ts`

**Interfaces:**
- Consumes: `users`, `memberProfiles`, `auditLogs`, `notifications`
- Produces: exported tables `contactCards`, `connectionRequests`, `blocks`, `reports`

- [ ] **Step 1: Extend the failing schema contract test**

Add these names to the table export assertion in `tests/schema.test.ts`:

```ts
for (const name of ["contactCards", "connectionRequests", "blocks", "reports"]) {
  assert.ok(name in schema, `missing ${name}`);
}
```

- [ ] **Step 2: Run the schema test and verify it fails**

```bash
npm run test:unit -- tests/schema.test.ts
```

Expected: FAIL with `missing contactCards`.

- [ ] **Step 3: Define the exact connection tables**

Add the following schema shape, using foreign keys to `users.id` and integer millisecond timestamps:

```ts
export const contactCards = sqliteTable("contact_cards", {
  userId: text("user_id").primaryKey().references(() => users.id, { onDelete: "cascade" }),
  encryptedPayload: text("encrypted_payload").notNull(),
  updatedAt: integer("updated_at").notNull(),
});

export const connectionRequests = sqliteTable("connection_requests", {
  id: text("id").primaryKey(),
  senderId: text("sender_id").notNull().references(() => users.id),
  recipientId: text("recipient_id").notNull().references(() => users.id),
  message: text("message").notNull(),
  topic: text("topic").notNull(),
  status: text("status", { enum: ["pending", "accepted", "declined", "withdrawn", "cancelled_by_block"] }).notNull(),
  createdAt: integer("created_at").notNull(),
  resolvedAt: integer("resolved_at"),
  updatedAt: integer("updated_at").notNull(),
}, (t) => [
  index("idx_connection_sender_created").on(t.senderId, t.createdAt),
  index("idx_connection_recipient_status_created").on(t.recipientId, t.status, t.createdAt),
  index("idx_connection_pair_status").on(t.senderId, t.recipientId, t.status),
]);

export const blocks = sqliteTable("blocks", {
  blockerId: text("blocker_id").notNull().references(() => users.id),
  blockedId: text("blocked_id").notNull().references(() => users.id),
  createdAt: integer("created_at").notNull(),
}, (t) => [
  primaryKey({ columns: [t.blockerId, t.blockedId] }),
  index("idx_blocks_blocked").on(t.blockedId),
]);

export const reports = sqliteTable("reports", {
  id: text("id").primaryKey(),
  reporterId: text("reporter_id").notNull().references(() => users.id),
  targetUserId: text("target_user_id").notNull().references(() => users.id),
  connectionRequestId: text("connection_request_id").references(() => connectionRequests.id),
  category: text("category", { enum: ["harassment", "spam", "false_identity", "privacy", "other"] }).notNull(),
  description: text("description").notNull(),
  status: text("status", { enum: ["open", "resolved", "dismissed"] }).notNull().default("open"),
  resolution: text("resolution"),
  createdAt: integer("created_at").notNull(),
  resolvedAt: integer("resolved_at"),
  resolvedBy: text("resolved_by").references(() => users.id),
}, (t) => [index("idx_reports_status_created").on(t.status, t.createdAt)]);
```

Import `primaryKey` from `drizzle-orm/sqlite-core`.

- [ ] **Step 4: Generate and inspect the migration**

```bash
npm run db:generate
```

Keep the new migration as `drizzle/0001_member_connections.sql`. Confirm there is no redundant rowid index, pair/status and inbox indexes match the actual queries, and foreign keys do not cascade-delete audit/report history unexpectedly.

- [ ] **Step 5: Run schema tests and build**

```bash
npm run test:unit -- tests/schema.test.ts
npm run build
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add db/schema.ts drizzle/0001_member_connections.sql tests/schema.test.ts
git commit -m "feat: add member connection schema"
```

---

### Task 2: 实现连接请求领域规则和仓储

**Files:**
- Create: `features/connections/types.ts`
- Create: `features/connections/policy.ts`
- Create: `features/connections/service.ts`
- Create: `lib/db/repositories/connections.ts`
- Create: `tests/connections/policy.test.ts`
- Create: `tests/connections/service.test.ts`

**Interfaces:**
- Produces: `ConnectionStatus`, `CreateConnectionInput`, `ConnectionPolicyContext`
- Produces: `createRequest(senderId, input, now)`, `resolveRequest(actorId, requestId, action, now)`, `listInbox(userId, box, cursor)`
- Consumes: member status/profile repository, block repository, notification port

- [ ] **Step 1: Write failing policy tests**

Cover self-request, inactive sender, non-published recipient, existing block in either direction, duplicate pending pair, 500-character message limit, and rolling 24-hour cap:

```ts
assert.equal(canCreate({ ...base, senderId: "u1", recipientId: "u1" }).code, "self_request");
assert.equal(canCreate({ ...base, requestsInLast24Hours: 5 }).code, "daily_limit");
assert.equal(canCreate({ ...base, blockedEitherDirection: true }).code, "blocked");
assert.equal(canCreate(base).ok, true);
```

- [ ] **Step 2: Run tests and verify they fail**

```bash
npm run test:unit -- tests/connections/policy.test.ts tests/connections/service.test.ts
```

Expected: FAIL because policy/service modules do not exist.

- [ ] **Step 3: Implement deterministic policy functions**

Return typed failures rather than free-form strings:

```ts
type ConnectionPolicyCode =
  | "self_request" | "sender_ineligible" | "recipient_unavailable"
  | "blocked" | "duplicate_pending" | "daily_limit" | "invalid_message";

type PolicyResult = { ok: true } | { ok: false; code: ConnectionPolicyCode };
```

Normalize message whitespace, require 20–500 characters, and require a 2–60 character topic. Reject obvious email/phone/WeChat disclosure patterns in the request body with code `invalid_message` so contact exchange remains consent-based.

- [ ] **Step 4: Implement repository queries**

Provide prepared/Drizzle queries for rolling count (`createdAt >= now - 86_400_000`), block lookup in either direction, pending pair lookup in either direction, recipient inbox pagination, sender outbox pagination, and accepted relationship lookup. Use cursor `{ createdAt, id }` with page size 30.

- [ ] **Step 5: Implement create and resolve services**

Recheck all policy inputs on the server immediately before insert. Allowed actions and actors:

```ts
const transitions = {
  accept: { from: "pending", actor: "recipient", to: "accepted" },
  decline: { from: "pending", actor: "recipient", to: "declined" },
  withdraw: { from: "pending", actor: "sender", to: "withdrawn" },
} as const;
```

Write request state and in-app notification in one D1 batch. Repeated identical resolve actions return the existing final state; conflicting actions return `409`.

- [ ] **Step 6: Run tests and build**

```bash
npm run test:unit -- tests/connections/policy.test.ts tests/connections/service.test.ts
npm run build
```

Expected: PASS, including a test that withdrawn requests still count toward the 24-hour cap.

- [ ] **Step 7: Commit**

```bash
git add features/connections lib/db/repositories/connections.ts tests/connections
git commit -m "feat: add consent-based connection requests"
```

---

### Task 3: 加密联系名片并只对已接受双方解锁

**Files:**
- Create: `features/connections/contact-card.ts`
- Create: `lib/db/repositories/contact-cards.ts`
- Create: `app/api/me/contact-card/route.ts`
- Create: `components/connections/ContactCardEditor.tsx`
- Create: `app/me/contact-card/page.tsx`
- Create: `tests/connections/contact-card.test.ts`

**Interfaces:**
- Produces: `ContactCard = { wechat?: string; email?: string; otherLabel?: string; otherValue?: string }`
- Produces: `encryptContactCard(userId, card)`, `decryptContactCard(userId, payload)`, `getVisibleContactCard(viewerId, ownerId)`
- Consumes: base64 32-byte `CONTACT_ENCRYPTION_KEY`

- [ ] **Step 1: Write failing encryption and authorization tests**

Cover AES-GCM round-trip, random IVs, wrong-user associated-data failure, invalid key length, no accepted relationship, accepted relationship, block after acceptance, and owner access:

```ts
const a = await encryptContactCard("u1", card, key);
const b = await encryptContactCard("u1", card, key);
assert.notEqual(a, b);
assert.deepEqual(await decryptContactCard("u1", a, key), card);
await assert.rejects(() => decryptContactCard("u2", a, key));
```

- [ ] **Step 2: Run tests and verify they fail**

```bash
npm run test:unit -- tests/connections/contact-card.test.ts
```

Expected: FAIL because contact-card utilities do not exist.

- [ ] **Step 3: Implement exact encrypted payload format**

Use Web Crypto `AES-GCM`, a fresh 12-byte IV, UTF-8 JSON payload, and associated data `builder-map-contact-card:v1:<userId>`. Store:

```text
v1.<base64url(iv)>.<base64url(ciphertext-and-tag)>
```

Validate `CONTACT_ENCRYPTION_KEY` decodes to exactly 32 bytes at process start; never log the key, plaintext card or decrypted value.

- [ ] **Step 4: Implement contact-card validation and API**

Allow WeChat 2–64 characters, email validated and normalized, other label 2–20, other value 2–100. Require at least one channel. `GET/PUT /api/me/contact-card` operates only on the current user. The response masks values for normal page loads until the user explicitly enters the contact-card settings page.

- [ ] **Step 5: Implement relationship-gated reads**

`getVisibleContactCard(viewerId, ownerId)` returns the owner's decrypted current card only when `viewerId === ownerId` or an accepted request exists in either direction and no block exists in either direction. It never reads a copied value from `connectionRequests`.

- [ ] **Step 6: Run tests and build**

```bash
npm run test:unit -- tests/connections/contact-card.test.ts
npm run build
```

Expected: PASS; blocking after acceptance immediately makes the other card unavailable.

- [ ] **Step 7: Commit**

```bash
git add features/connections/contact-card.ts lib/db/repositories/contact-cards.ts app/api/me/contact-card components/connections/ContactCardEditor.tsx app/me/contact-card tests/connections/contact-card.test.ts
git commit -m "feat: protect contact cards behind mutual consent"
```

---

### Task 4: 建设成员资料连接入口和站内收件箱

**Files:**
- Create: `app/api/connections/route.ts`
- Create: `app/api/connections/[id]/route.ts`
- Create: `app/me/connections/page.tsx`
- Create: `components/connections/ConnectButton.tsx`
- Create: `components/connections/ConnectionRequestDialog.tsx`
- Create: `components/connections/ConnectionInbox.tsx`
- Create: `components/connections/ConnectionCard.tsx`
- Modify: `components/directory/MemberProfile.tsx`
- Create: `tests/connections/routes.test.ts`

**Interfaces:**
- Consumes: connection service, `requireSession`, contact-card authorization
- Produces: `POST /api/connections`, `GET /api/connections?box=received|sent|accepted`, `PATCH /api/connections/:id`

- [ ] **Step 1: Write failing route authorization tests**

Test anonymous `401`, visitor/non-approved `403`, forged `senderId` ignored, invalid target `404`, valid create `201`, duplicate `409`, rate limit `429`, recipient accept `200`, sender withdraw `200`, and forbidden cross-user resolve `403`.

```ts
const response = await POST(authenticatedRequest({ recipientId: "u2", senderId: "forged", message, topic }));
assert.equal(response.status, 201);
assert.equal(repository.inserted.senderId, "session-user");
```

- [ ] **Step 2: Run tests and verify they fail**

```bash
npm run test:unit -- tests/connections/routes.test.ts
```

Expected: FAIL because routes do not exist.

- [ ] **Step 3: Implement route contracts**

Use request bodies:

```ts
type CreateConnectionBody = { recipientId: string; topic: string; message: string };
type ResolveConnectionBody = { action: "accept" | "decline" | "withdraw" };
```

Return `{ request, unlockedContactCard? }` only after an accepted request and authorization check. Map domain errors to stable HTTP codes and Chinese user messages without revealing whether a hidden/deleted profile exists.

- [ ] **Step 4: Implement member profile CTA**

Render rules:

- Visitor: disabled button “审核成员可发起连接”，link to `/apply`.
- Viewing own profile: link “编辑我的资料”.
- Eligible member: active “想认识 TA”.
- Pending pair: disabled “等待对方回应”.
- Accepted pair: “查看已交换的联系方式”.
- Blocked/unavailable: no connection button.

The dialog contains topic, 20–500 character introduction, privacy reminder, remaining daily count and submit confirmation. Do not render contact inputs.

- [ ] **Step 5: Implement inbox/outbox UI**

Tabs are `收到的`, `发出的`, `已连接`. Received pending cards expose accept/decline; sent pending cards expose withdraw; accepted cards reveal the authorized current contact card. Use buttons with text labels and server-confirmed states; optimistic UI may disable during submission but must reconcile with the response.

- [ ] **Step 6: Run tests and build**

```bash
npm run test:unit -- tests/connections/routes.test.ts
npm run build
```

Expected: PASS; server-rendered pages never include contact-card plaintext for unauthorized viewers.

- [ ] **Step 7: Commit**

```bash
git add app/api/connections app/me/connections components/connections components/directory/MemberProfile.tsx tests/connections/routes.test.ts
git commit -m "feat: add member connection inbox"
```

---

### Task 5: 增加连接站内通知和邮件提醒

**Files:**
- Create: `features/notifications/connection-events.ts`
- Modify: `features/notifications/types.ts`
- Modify: `features/notifications/resend.ts`
- Modify: `features/connections/service.ts`
- Create: `tests/notifications/connection-events.test.ts`

**Interfaces:**
- Produces notification events `connection_received`, `connection_accepted`, `connection_declined`, `connection_withdrawn`
- Consumes `NotificationSender` from phase one

- [ ] **Step 1: Write failing event-content tests**

Assert each recipient, subject, route and privacy boundary:

```ts
assert.deepEqual(toNotification(event), {
  userId: "recipient-1",
  type: "connection_received",
  title: "你收到一条新的连接请求",
  body: "林同学想和你聊聊：AI 产品共创",
  href: "/me/connections?box=received",
});
assert.doesNotMatch(email.text, /wechat|contactCard|微信号/);
```

- [ ] **Step 2: Run tests and verify they fail**

```bash
npm run test:unit -- tests/notifications/connection-events.test.ts
```

Expected: FAIL because connection event mapping does not exist.

- [ ] **Step 3: Implement exact event mapping**

Create one in-app notification in the same D1 batch as request creation/resolution. After commit, enqueue email delivery through the existing adapter. Do not email private contact values; accepted emails link users back to the authenticated site to view current contact cards.

- [ ] **Step 4: Add duplicate and failure protection**

Use deduplication key `connection:<requestId>:<status>` in `notifications`. A duplicate status action must not send another email. Record `pending | sent | failed`; email failure never changes the request status.

- [ ] **Step 5: Run tests and build**

```bash
npm run test:unit -- tests/notifications/*.test.ts tests/connections/service.test.ts
npm run build
```

Expected: PASS, including simulated Resend `429` and permanent `400` responses.

- [ ] **Step 6: Commit**

```bash
git add features/notifications features/connections/service.ts tests/notifications
git commit -m "feat: notify members about connection requests"
```

---

### Task 6: 实现拉黑、举报与运营安全处理

**Files:**
- Create: `features/safety/types.ts`
- Create: `features/safety/service.ts`
- Modify: `features/identity/account-deletion.ts`
- Create: `lib/db/repositories/safety.ts`
- Create: `app/api/me/blocks/route.ts`
- Create: `app/api/reports/route.ts`
- Create: `app/api/admin/reports/[id]/route.ts`
- Create: `app/me/blocked/page.tsx`
- Create: `app/admin/reports/page.tsx`
- Create: `components/safety/BlockButton.tsx`
- Create: `components/safety/ReportDialog.tsx`
- Create: `components/admin/ReportReviewPanel.tsx`
- Create: `tests/safety/service.test.ts`
- Create: `tests/safety/admin.test.ts`

**Interfaces:**
- Produces: `blockUser(blockerId, blockedId, now)`, `unblockUser`, `submitReport`, `resolveReport`
- Consumes: connection repository, admin authorization, audit repository

- [ ] **Step 1: Write failing safety tests**

Cover self-block rejection, idempotent block, cancelling both-direction pending requests, hiding contact cards after block, report validation, reporter-only ownership, admin-only resolution, audited member sanctions, and deletion of connection-era private data.

```ts
await service.blockUser("u1", "u2", now);
assert.equal(await connections.status("pending-u1-u2"), "cancelled_by_block");
assert.equal(await connections.status("pending-u2-u1"), "cancelled_by_block");
assert.equal(await contacts.canView("u1", "u2"), false);
```

- [ ] **Step 2: Run tests and verify they fail**

```bash
npm run test:unit -- tests/safety/*.test.ts
```

Expected: FAIL because safety modules do not exist.

- [ ] **Step 3: Implement block behavior atomically**

Insert the block and update all pairwise `pending` requests to `cancelled_by_block` in one batch. Unblocking does not restore cancelled requests or prior contact visibility; members must create a new request, still subject to limits.

- [ ] **Step 4: Implement report validation and privacy**

Allow categories `harassment`, `spam`, `false_identity`, `privacy`, `other`; require 20–1,000 characters. A reporter can see only their own report status and generic resolution summary. The reported member cannot see reporter identity through any user route.

- [ ] **Step 5: Implement admin resolution actions**

Allowed resolutions are `dismiss`, `warn`, `suspend_connections`, `hide_profile`, `suspend_account`. Every action writes an audit row. Account/profile actions reuse existing member status services instead of updating tables directly from the route.

- [ ] **Step 6: Extend account deletion for connection data**

Extend the phase-one `deleteOwnAccount` batch to delete the user's encrypted contact card, change every pairwise `pending` request to `cancelled_by_block`, revoke contact access by setting the user to `deleted`, and remove blocks created by the deleted account. Retain only minimized request/report/audit rows needed to explain prior moderation actions; user-facing queries must replace the deleted profile with “已注销成员” and return no avatar, biography or contact value.

- [ ] **Step 7: Build member and admin safety UI**

Place report and block actions behind an overflow menu on profile and request cards. Require a confirmation for block. The admin report screen shows only the minimum contextual request/profile data needed to decide, plus resolution history.

- [ ] **Step 8: Run tests and build**

```bash
npm run test:unit -- tests/safety/*.test.ts tests/connections/*.test.ts
npm run build
```

Expected: PASS; block state immediately removes contact access and prevents new requests.

- [ ] **Step 9: Commit**

```bash
git add features/safety features/identity/account-deletion.ts lib/db/repositories/safety.ts app/api/me/blocks app/api/reports app/api/admin/reports app/me/blocked app/admin/reports components/safety components/admin/ReportReviewPanel.tsx tests/safety
git commit -m "feat: add connection safety controls"
```

---

### Task 7: 完成全流程验证、上线配置和 Sites 发布

**Files:**
- Create: `tests/connections/permission-matrix.test.ts`
- Create: `tests/connections/full-flow.test.ts`
- Modify: `tests/rendered-html.test.mjs`
- Modify: `README.md`

**Interfaces:**
- Consumes: every phase-one and phase-two service/API
- Produces: verified production build and hosted Sites URL

- [ ] **Step 1: Write the permission-matrix test**

Use table-driven cases for `visitor`, `pending applicant`, `active member`, `connection_suspended`, `hidden`, `suspended`, `admin`, and `blocked pair`. Assert create/read/accept/contact/report/admin permissions explicitly:

```ts
const cases = [
  { actor: "visitor", create: 401, readInbox: 401, readContact: 401 },
  { actor: "active-member", create: 201, readInbox: 200, readContact: 403 },
  { actor: "connection-suspended", create: 403, readInbox: 200, readContact: 403 },
];
```

- [ ] **Step 2: Write the full-flow test**

Build a service-level integration test that executes:

```text
approved sender -> save contact card -> send request -> recipient receives notification
-> recipient accepts -> both can read current contact cards -> sender changes card
-> recipient sees updated card -> recipient blocks sender -> neither can read cards
-> sender cannot send again -> recipient reports -> admin resolves with connection suspension
```

Assert each state and audit/notification count.

- [ ] **Step 3: Run the focused verification and fix failures**

```bash
npm run test:unit -- tests/connections/*.test.ts tests/safety/*.test.ts tests/notifications/*.test.ts
```

Expected: PASS with no skipped cases.

- [ ] **Step 4: Run complete project verification**

```bash
npm run test:unit
npm run lint
npm run build
node --test tests/rendered-html.test.mjs
```

Expected: all commands PASS. Inspect the generated D1 migration and run `PRAGMA optimize` after applying indexes in the hosted database.

- [ ] **Step 5: Verify production configuration without exposing secrets**

Confirm all of these are configured in Sites hosting: `NEXT_PUBLIC_AMAP_JS_KEY`, `AMAP_SECURITY_JS_CODE`, `RESEND_API_KEY`, `EMAIL_FROM`, `SESSION_SIGNING_KEY`, `CONTACT_ENCRYPTION_KEY`, `ADMIN_EMAILS`, `APP_ORIGIN`, D1 `DB`, and R2 `AVATARS`. Confirm `CONTACT_ENCRYPTION_KEY` is base64 for exactly 32 bytes and `SESSION_SIGNING_KEY` is at least 32 random bytes.

- [ ] **Step 6: Update the operations guide**

Document first-admin access, application review, school coordinate confirmation, contribution confirmation, connection suspension, report resolution, key rotation procedure, email failure inspection, and account deletion. Include no real member data or secrets.

- [ ] **Step 7: Publish with Sites hosting**

Invoke the `sites-hosting` skill after the successful build. Deploy the complete project, apply the D1 migrations through the supported Sites workflow, bind R2 and environment values, verify the returned public URL is healthy using the hosting workflow's permitted checks, then stop the retained development server.

- [ ] **Step 8: Commit**

```bash
git add tests README.md
git commit -m "test: verify member connection system"
```

## Final Completion Gate

The complete first version is ready only when:

- An anonymous visitor can browse only public map/profile data.
- A pending or non-active member cannot send a request.
- A valid member can send at most five requests per rolling 24 hours.
- A recipient can accept or decline directly without administrator handling.
- No contact value is returned before acceptance.
- Accepted users read the current encrypted contact cards, not copied plaintext.
- Blocking immediately cancels pending requests and removes contact access.
- Reports can be resolved only by admins and every sanction is audited.
- Email failure leaves the business state and in-app notification intact.
- Complete tests, lint and build pass, and Sites returns a deployed URL.
