# 广东高校共建者地图 Demo

广州AI共创社的第一阶段共建者地图：成员提交资料并逐项选择公开范围，运营员审核后才会进入公开目录；学校坐标按校区聚合，系统不采集个人实时位置。

## 运行要求

- Node.js `>=22.13.0`
- Cloudflare D1、R2 和 Images 能力（头像流程缺一不可）
- 高德开放平台 Web JS API 2.0 与 Web 服务 API 凭证

安装、验证和本地启动：

```powershell
npm.cmd install
npm.cmd run test:unit
npm.cmd run lint
npm.cmd run build
npm.cmd run dev
```

## 环境变量

从 `.env.example` 复制为本地 `.env`，只在本机或托管平台的密钥设置中填写值，不要把密钥提交到 Git。

| 名称 | 是否公开 | 用途 |
| --- | --- | --- |
| `DEMO_MODE` | 否 | 仅当值严格等于 `true` 时启用固定 Demo 身份与后台入口。 |
| `DEMO_SESSION_SECRET` | 否 | 签名 8 小时 HttpOnly Demo 会话；至少 32 个字符。 |
| `NEXT_PUBLIC_AMAP_JS_KEY` | 是 | 高德 Web JS API 2.0 浏览器 Key；必须限制允许访问的域名。 |
| `AMAP_SECURITY_JS_CODE` | 否 | 高德 JS API 安全密钥；只由 `/api/amap` 服务端代理追加，不能进入浏览器代码。 |
| `AMAP_WEB_SERVICE_KEY` | 否 | 后台新增学校时调用高德地理编码服务。 |

代码没有读取 `RESEND_API_KEY`、邮件发件人、联系名片加密密钥或真实认证变量；这些属于后续连接/公众号阶段，不应为本 Demo 虚构配置。

## Cloudflare 绑定与迁移

`.openai/hosting.json` 声明两个由 Sites 配置的逻辑绑定：

- D1 `DB`：用户、申请、审核、公开资料、贡献、审计与站内通知。
- R2 `AVATARS`：不可变、按用户命名空间保存的 WebP 头像。

Worker 还需要平台提供的 `ASSETS` 静态资源绑定和名为 `IMAGES` 的 Cloudflare Images 转换绑定。头像上传只有在 `AVATARS` 与 `IMAGES` 同时可用时才会成功；不要用 D1 保存图片字节。

当前完整基线迁移是 `drizzle/0000_builder_map_core.sql`。修改 `db/schema.ts` 后先生成并检查新迁移：

```powershell
npm.cmd run db:generate
```

对本地 Wrangler D1 应用基线：

```powershell
npx.cmd wrangler d1 execute site-creator-d1 --local --file=drizzle/0000_builder_map_core.sql --persist-to=.wrangler/state/v3
```

Sites 创建真实 D1 后，在已连接该资源的 Cloudflare 环境中把 `<SITE_D1_DATABASE_NAME>` 替换为控制台显示的数据库名，再执行：

```powershell
npx.cmd wrangler d1 execute <SITE_D1_DATABASE_NAME> --remote --file=drizzle/0000_builder_map_core.sql
```

不要把 `vite.config.ts` 中仅供本地模拟的占位 database ID 当成远端资源，也不要在未确认目标数据库时运行远端迁移。

## Demo 身份与种子流程

1. 设置 `DEMO_MODE=true` 和一个至少 32 字符的 `DEMO_SESSION_SECRET`，完成 D1 迁移后启动站点。
2. 页面顶部会明确显示“演示模式：此处不是真实账户”。选择“以运营员体验”，服务端只会签发固定 `demo-admin` 身份。
3. 进入 `/admin`，点击“初始化 Demo 数据”。它调用 `POST /api/admin/demo-seed`，只允许已签名的固定运营员执行，并以确定性 ID 幂等写入完全虚构的广东学校、申请、资料和贡献数据。
4. 切换为“以共建者体验”得到固定 `demo-member` 身份；可提交申请、查看状态、编辑公开设置、隐藏资料和执行自助删除。
5. 再切回运营员，在后台审核申请、确认学校坐标与贡献；通过后的合格资料会自动发布，不需要手工改数据库。

> **发布警告：Demo 固定身份不是生产认证。** 任何能访问已公开站点的人都能点击身份切换器成为 `demo-member` 或 `demo-admin`。只可部署到受访问策略保护的私有演示环境；不得把 `DEMO_MODE=true` 的版本公开发布、收集真实个人资料或用于正式运营。生产上线前必须以真实认证适配器替换 Demo 会话并关闭固定运营员入口。

## 高德地图配置

1. 在高德开放平台创建应用和“Web 端（JS API）”Key，启用 JS API 2.0，并把本地/私测域名加入白名单；填入 `NEXT_PUBLIC_AMAP_JS_KEY`。这是浏览器 Key，不是安全密钥。
2. 为同一 Web JS API Key 创建安全密钥，填入服务端 `AMAP_SECURITY_JS_CODE`。前端固定将 `window._AMapSecurityConfig.serviceHost` 指向同源 `/api/amap`，代理只允许高德安全服务路径并由服务端附加密钥。
3. 创建“Web 服务”Key，限制可用 API/IP，并填入 `AMAP_WEB_SERVICE_KEY`，供运营后台地理编码学校地址。
4. 若 JS API、代理或 Key 不可用，首页必须自动保留学校列表；列表与地图使用同一组筛选结果。

## 通知边界

第一阶段只有 D1 站内通知，事件为 `application_submitted`、`application_approved`、`application_changes_requested`、`application_rejected` 和 `contribution_confirmed`。适配器只保存成员可见的标题、正文、站内链接与投递状态，不保存内部审核备注。通知写入发生在申请/审核/贡献的原子业务变更之后；即使投递失败，业务状态也不会回滚。

业务服务只依赖 `NotificationSender`。未来公众号服务通知应实现同一端口并复用领域事件，不修改申请、审核或贡献状态机；也不得把邮箱、联系方式、审核记录或会话标识加入通知正文。

## 10–20 人私测清单

- [ ] 用 Sites/Cloudflare 访问策略把站点限制在受邀成员范围，确认公网匿名访问被拒绝。
- [ ] 在空白测试 D1 上应用并核对基线迁移，确认绑定名严格为 `DB`。
- [ ] 核对 `AVATARS`、`IMAGES` 和 `ASSETS` 绑定；上传、替换、读取一张非敏感测试头像。
- [ ] 为高德 Web JS、JS 安全密钥和 Web 服务 Key 设置最小域名/IP/API 权限，不共用其他项目的 Key。
- [ ] 以运营员初始化 Demo 数据两次，确认第二次不重复生成记录。
- [ ] 以成员完整提交一次申请，确认同意版本、公开字段和待审核状态正确。
- [ ] 分别演练通过、退回修改和拒绝；确认申请人只看到成员文案，看不到内部审核资料。
- [ ] 通过一份符合公开条件的申请，确认目录/地图自动出现且无需手工更新数据库。
- [ ] 把必要字段改为私密或隐藏整个资料，确认立即从公开目录移除；恢复后重新核对。
- [ ] 确认一条待审核贡献，确认认证共建者徽章只由已确认记录确定性更新。
- [ ] 人为断开高德或移除浏览器 Key，确认学校列表仍可用且搜索、城市、技能、角色、认证筛选与地图一致。
- [ ] 抽查公开目录/资料响应，确认没有 `email`、`contactCard`、`reviewNotes`、`reportHistory` 或 `sessionId`。
- [ ] 模拟站内通知写入失败，确认业务状态成功且投递结果记录为 `failed` 或安全返回失败。
- [ ] 请 10–20 位受邀成员逐项确认昵称、学校、头像、简介和标签的公开边界，再提交真实资料。
- [ ] 记录问题时去除邮箱、联系方式、会话 Cookie 和内部审核内容；发布前再次关闭 Demo 模式并复核运营入口。

## 项目验证

完整阶段一门禁：

```powershell
npm.cmd run test:unit
npm.cmd run lint
npm.cmd run build
node --test tests/rendered-html.test.mjs
```

通过门禁意味着：公开目录只返回已批准、活跃、已发布且本人允许公开的数据；地图失败有等价列表；Demo 申请、审核、发布、隐私控制和贡献徽章流程可在无手工数据库修改的情况下完成。
