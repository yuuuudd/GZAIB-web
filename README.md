# 广州 AI 共创社 · GZAIB

> 让广东高校的 AI 共建者被看见、相互连接，并把想法落到真实协作中。

[正式站](https://gzaibuilders.cn)

广州 AI 共创社是面向广东高校 AI 学习者、组织者与实践者的共建平台。平台将学校与成员、AI 社群、活动赛事和开放项目汇集在一起：先发现同路人，再在明确同意的前提下建立连接，最后把交流转化为可持续的共创。

## 平台能力

### 共建地图

- 浏览已公开的高校、校区与认证共建者，按地点发现身边的 AI 网络。
- 成员公开主页展示其自主选择公开的资料、技能、经历与作品；地图仅展示学校/校区聚合位置，不追踪个人实时位置。

### AI 社群与活动赛事

- 浏览高校 AI 社群及其组织信息，提交或认领社群资料。
- 发现比赛、黑客松、分享会、工作坊等活动；未登录用户会先引导登录，登录后可提交共建活动。

### 共创广场

- 浏览公开项目卡片并在弹窗查看完整介绍、参与方式、地点、活动起止时间、招募角色与截止时间。
- 以“申请加入”向项目发起人建立连接；联系方式仅在双方接受连接后读取。
- 共建者可直接发布项目，并在“我的项目”中查看、新建、编辑、下架或重新公开自己的项目。
- 发起表单按“基本信息、项目介绍、参与安排、招募需求”组织；支持线上、线下与混合协作，以及自定义地点和可选的开始/结束时间。

### 成员资料与连接

- 完善个人资料、联系方式与链接、资料展示和账号设置，并预览公开主页。
- 在资料页的统一浮窗中使用“连接中心”和“公开主页”两个标签，无需离开当前页面。
- 管理新的连接请求与好友列表；请求已处理后会明确显示“已同意”“已拒绝”或“已撤回”，不可重复操作。
- 只有双方接受、资料仍符合公开条件且没有任一方拉黑时，服务端才返回双方当前设置的联系方式。

### 运营与安全

- 提供成员申请、学校地点、活动、社群、贡献和举报的运营审核入口。
- 支持拉黑、举报、限制连接与自助注销；连接状态和联系方式读取权限会随状态变化即时收回。

## 技术栈

- React 19 + TypeScript
- Vinext / Vite（React Server Components）
- Drizzle ORM
- Cloudflare D1、R2 与 Wrangler 本地运行时
- Tailwind CSS 4

## 本地开发

需要 Node.js `>=22.13.0`。

```powershell
npm.cmd install
Copy-Item .env.example .env
```

在 `.env` 中填写本地开发所需变量，然后按顺序执行数据库迁移：

```powershell
$env:WRANGLER_LOG_PATH = ".wrangler/logs"
$env:MINIFLARE_REGISTRY_PATH = ".wrangler/registry"
Get-ChildItem drizzle\*.sql | Sort-Object Name | ForEach-Object {
  npx.cmd wrangler d1 execute site-creator-d1 --local --config wrangler.local.jsonc --file=$_.FullName --persist-to=.wrangler/state
}
npm.cmd run dev
```

默认本地地址为 `http://localhost:3000`。

## 环境变量

以 [`.env.example`](.env.example) 为准，常用配置如下：

| 变量 | 用途 |
| --- | --- |
| `DEMO_MODE` / `AUTH_MODE` | 本地演示或正式认证模式。 |
| `DEMO_SESSION_SECRET` | 会话签名密钥。 |
| `CONTACT_ENCRYPTION_KEY` | 联系方式的 AES-GCM 加密密钥，需为 32 字节 base64。 |
| `ADMIN_EMAILS` | 运营管理员邮箱列表。 |
| `APP_ORIGIN` | 站点根地址，用于安全链接与公开元数据。 |
| `RESEND_API_KEY`、`RESEND_FROM` | 可选的邮件通知配置。 |
| `NEXT_PUBLIC_AMAP_JS_KEY` | 高德地图 Web JS Key。 |
| `AMAP_SECURITY_JS_CODE`、`AMAP_WEB_SERVICE_KEY` | 服务端高德安全代理与地理编码配置，不应暴露到浏览器。 |

不要提交 `.env`、真实密钥、真实成员数据或生产凭据。

## 验证

```powershell
npm.cmd run test:unit
npm.cmd run lint
npm.cmd run build
node --test tests/rendered-html.test.mjs
git diff --check
```

## 部署

生产部署前应完成以下检查：

1. 在本地通过上述测试与构建。
2. 先备份生产数据库，再按版本顺序执行新增的 `drizzle/*.sql` 迁移。
3. 配置正式环境变量、D1/R2 绑定及高德地图密钥。
4. 更新应用代码，构建后重启运行进程，并验证首页、地图、登录、共创与连接流程。

当前正式站：<https://gzaibuilders.cn>

## 隐私与使用原则

- 公开资料由成员自主控制；联系方式默认不出现在地图、搜索、项目卡片或通知邮件中。
- 联系方式以加密形式保存，只有符合双向接受条件时才由服务器返回。
- 平台服务于真实、尊重边界的高校 AI 协作；请勿上传他人隐私、冒用身份或在公开内容中发布未经同意的联系方式。

## 许可证

本项目采用 [MIT License](LICENSE)。
