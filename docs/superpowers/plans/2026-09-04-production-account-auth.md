# 生产环境账号认证实施计划

> **执行要求：** 使用 `superpowers:executing-plans` 在独立分支逐项实施；每个行为先写失败测试，再写最小实现。

**目标：** 为现有 Vinext 应用增加邮箱密码自助注册、数据库会话和数据库管理员权限，并部署到腾讯云服务器。

**架构：** 复用现有 `users`、`sessions`、D1 身份边界和管理端路由。新增一张不可逆密码凭证表、一个小型认证模块、三个认证接口及两个页面；ChatGPT Sites 请求头路径继续保留，VPS 入口由 Nginx 清除伪造请求头。

**技术栈：** TypeScript 5.9、Vinext、React 19、Web Crypto、Drizzle ORM、Cloudflare D1/R2、Node 24、PM2、Nginx。

**规格：** `docs/superpowers/specs/2026-09-04-production-account-auth-design.md`

## 全局约束

- 正式环境使用 `DEMO_MODE=false`，不展示 Demo 身份切换器。
- VPS 使用 `AUTH_MODE=local`；缺省值保留 ChatGPT Sites 登录行为。
- 不增加第三方依赖；密码使用 Web Crypto PBKDF2-HMAC-SHA-256。
- 注册接口只能创建 `member`；管理员必须由本地 D1 操作提升。
- Cookie 只包含不透明令牌，数据库只存令牌 SHA-256 哈希。
- 微信、邮件验证和自动找回密码不在本轮实现。

---

### 任务 1：密码凭证与迁移

**文件：**
- 修改：`db/schema.ts`
- 新建：`drizzle/0009_password_credentials.sql`
- 新建：`features/identity/password.ts`
- 新建：`tests/identity/password.test.ts`
- 修改：`tests/schema.test.ts`

**接口：**
- `normalizeLoginEmail(value: unknown): string`
- `validatePassword(value: unknown): string`
- `hashPassword(password: string, salt?: Uint8Array, iterations?: number): Promise<PasswordDigest>`
- `verifyPassword(password: string, digest: PasswordDigest): Promise<boolean>`

- [ ] 先写密码测试，使用固定盐并断言同一密码可验证、错误密码失败、邮箱转小写、非法邮箱及 12～128 字符边界被拒。
- [ ] 运行 `npx tsx --test tests/identity/password.test.ts`，确认因模块不存在而失败。
- [ ] 实现最小 Web Crypto 逻辑：

```ts
export type PasswordDigest = { salt: string; hash: string; iterations: number };
const DEFAULT_ITERATIONS = 600_000;

export async function hashPassword(password: string, salt = crypto.getRandomValues(new Uint8Array(16)), iterations = DEFAULT_ITERATIONS): Promise<PasswordDigest> {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(validatePassword(password)), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt, iterations }, key, 256);
  return { salt: toBase64(salt), hash: toBase64(new Uint8Array(bits)), iterations };
}
```

- [ ] 在 schema 和 `0009` 中新增 `password_credentials(user_id PRIMARY KEY, password_hash, salt, iterations, updated_at)`，外键关联 `users(id)` 并级联删除。
- [ ] 运行密码和 schema 测试，确认通过。

### 任务 2：数据库会话与统一身份边界

**文件：**
- 新建：`features/identity/database-session.ts`
- 新建：`lib/db/repositories/password-auth.ts`
- 修改：`features/identity/request-user.ts`
- 修改：`features/identity/account-deletion.ts`
- 修改：`app/api/auth/logout/route.ts`
- 新建：`tests/identity/database-session.test.ts`
- 修改：`tests/identity/request-user.test.ts`
- 修改：`tests/identity/account-deletion.test.ts`

**接口：**
- `createDatabaseSession(userId: string, now?: number): Promise<{ token: string; record: SessionRecord }>`
- `sessionTokenHash(token: string): Promise<string>`
- `serializeDatabaseSessionCookie(token: string, options?): string`
- `resolveRuntimeDatabaseSession(request: Request): Promise<{ identity: { id: string; role: "member" | "admin" } } | null>`
- `revokeRuntimeDatabaseSession(request: Request): Promise<void>`

- [ ] 先写失败测试，证明令牌与数据库哈希不同、Cookie 属性正确、过期/撤销/停用账号返回匿名、有效账号返回数据库角色。
- [ ] 运行聚焦测试并确认因新接口缺失而失败。
- [ ] 实现 32 字节随机令牌、SHA-256 哈希和 30 天 Cookie；仓库查询必须同时检查 `revoked_at IS NULL`、`expires_at > now` 及用户状态。
- [ ] 扩展 `resolveRequestUserId`：非 Demo 时先解析数据库 Cookie，再回退到 ChatGPT Sites 请求头。
- [ ] 退出登录先撤销数据库会话，再清除 `gzaib_session`；账号注销同时清除两类 Cookie。
- [ ] 运行三个身份测试文件，确认通过。

### 任务 3：注册与登录 HTTP 流程

**文件：**
- 新建：`features/identity/password-auth.ts`
- 新建：`app/api/auth/register/route.ts`
- 新建：`app/api/auth/login/route.ts`
- 新建：`tests/identity/password-auth.test.ts`

**接口：**
- `handleRegistration(request: Request, dependencies): Promise<Response>`
- `handlePasswordLogin(request: Request, dependencies): Promise<Response>`
- `createRuntimePasswordAccount(email: string, digest: PasswordDigest, now: number): Promise<string>`
- `loadRuntimePasswordAccount(email: string): Promise<PasswordAccount | null>`

- [ ] 先写失败测试，覆盖表单与 JSON 输入、正文上限、规范化邮箱、重复邮箱、强制 `member`、通用登录失败、限速和安全跳转。
- [ ] 运行 `npx tsx --test tests/identity/password-auth.test.ts`，确认因处理器不存在而失败。
- [ ] 使用现有 `readBoundedRequestBody` 读取最多 8 KiB，只接受 `email`、`password`、`returnTo`；安全返回地址必须是站内单斜杠路径。
- [ ] 注册时在一个 D1 batch 中插入随机 `local:<uuid>` 用户与密码凭证；登录校验后插入会话；成功均返回 `303` 并设置 Cookie。
- [ ] 添加每 IP、15 分钟最多 5 次失败尝试的进程内限速 Map，并在访问时顺手清理过期项。
- [ ] 运行聚焦测试，确认通过。

### 任务 4：登录页面、账号跳转与管理员权限

**文件：**
- 新建：`app/login/page.tsx`
- 新建：`app/register/page.tsx`
- 修改：`app/globals.css`
- 修改：`app/chatgpt-auth.ts`
- 修改：`app/me/page.tsx` 及其余 `app/me/**/page.tsx`
- 修改：`features/admin/authorization.ts`
- 修改：`app/admin/admin-session.ts`
- 修改：`tests/admin/review.test.ts`
- 修改：`tests/rendered-html.test.mjs`

**接口：**
- `accountSignInPath(returnTo: string, authMode?: string): string`
- `authorizeAdminRoute` 在非 Demo 模式下优先接受数据库会话中的 `role=admin`，再兼容 ChatGPT 白名单身份。

- [ ] 先写失败测试，证明登录/注册链接可渲染、非法 `return_to` 被收敛为 `/`、普通数据库会员收到 `403`、数据库管理员可访问。
- [ ] 运行管理与渲染测试，确认新行为尚不存在而失败。
- [ ] 添加无客户端脚本的登录/注册表单，使用现有颜色、按钮和焦点样式；不显示微信或邮件找回占位功能。
- [ ] 将账号页面匿名跳转改为 `accountSignInPath`；ChatGPT Sites 环境仍可使用现有专属登录地址。
- [ ] 管理页面和 API 共用数据库角色判断，删除对本地生产环境可伪造请求头的依赖。
- [ ] 运行管理、身份和渲染测试，确认通过。

### 任务 5：全量验证、服务器部署与首个管理员

**文件：**
- 修改：服务器 `/home/ubuntu/apps/GZAIB-web/.env`
- 新建：服务器 PM2 进程配置或等价最小启动命令
- 新建：服务器 `/etc/nginx/sites-available/gzaibuilders.cn`

**接口：**
- 应用只监听 `127.0.0.1` 的实际端口。
- Nginx 对外提供 HTTP，域名解析后补 TLS。

- [ ] 在本地运行 `npm ci`、`npm run test:unit`、`npm run lint`、`npm run build`、`node --test tests/rendered-html.test.mjs` 和 `git diff --check`。
- [ ] 将验证过的提交同步到服务器目标仓库，不覆盖 `.env` 或持久化 D1/R2 状态。
- [ ] 在服务器写入权限为 `600` 的 `.env`：`DEMO_MODE=false`、`AUTH_MODE=local`、随机 `CONTACT_ENCRYPTION_KEY`、`APP_ORIGIN=https://gzaibuilders.cn`；邮件和高德变量留空。
- [ ] 执行 `npm ci` 和生产构建，将 `0000`～`0009` 按顺序应用到同一持久化目录。
- [ ] 仅在 localhost 启动应用，注册首个管理员账号并用 D1 语句将其角色提升为 `admin`；公开注册始终保持会员角色。
- [ ] 使用 PM2 启动一个实例并保存进程列表，执行 `pm2 startup` 生成并启用 systemd 自启。
- [ ] 配置 Nginx 反代、清除 `oai-authenticated-user-*` 请求头、运行 `nginx -t` 后 reload。
- [ ] 通过 localhost 和公网 IP 冒烟验证首页、注册、登录、`/me`、会员拒绝访问 `/admin`、管理员访问、退出登录；检查 PM2、Nginx 和端口状态。
