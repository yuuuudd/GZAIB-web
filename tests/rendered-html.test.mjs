import assert from "node:assert/strict";
import test from "node:test";

async function renderRoute(pathname, extraHeaders = {}) {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request(`http://localhost${pathname}`, { headers: { accept: "text/html", ...extraHeaders } }),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

const renderHomePage = (extraHeaders = {}) => renderRoute("/", extraHeaders);

test("home page renders the clean hero with final punctuation and no duplicate header CTA", async () => {
  const response = await renderHomePage({ host: "localhost" });
  assert.equal(response.status, 200);
  const html = await response.text();

  assert.match(html, /<html[^>]+lang="zh-CN"/);
  assert.match(html, /<title>广州 AI 共创社｜共建者与 AI 社群地图<\/title>/);
  assert.match(html, /<meta[^>]+name="description"[^>]+content="看见广东高校共建者，发现正在行动的 AI 社群与共创网络。"/);
  assert.match(html, /<meta[^>]+property="og:title"[^>]+content="广州 AI 共创社｜共建者与 AI 社群地图"/);
  assert.match(html, /<meta[^>]+property="og:description"[^>]+content="看见广东高校共建者，发现正在行动的 AI 社群与共创网络。"/);
  assert.match(html, /<meta[^>]+property="og:image"[^>]+content="http:\/\/localhost\/og\.png"/);
  assert.match(html, /<meta[^>]+name="twitter:card"[^>]+content="summary_large_image"/);
  assert.match(html, /广州AI共创社/);
  assert.match(html, /让广东每一所高校/);
  assert.match(html, /申请点亮我的头像/);
  assert.match(html, /共建的光<\/span>。<\/span><\/h1>/);
  assert.equal((html.match(/class="hero-title-line"/g) ?? []).length, 2);
  assert.doesNotMatch(html, /class="brand-header-action" href="\/apply"/);
  assert.doesNotMatch(html, /仅展示审核通过且本人选择公开的信息，不采集个人实时位置/);
  assert.match(html, /探索高校能量，发现同频伙伴/);
  assert.match(html, /像逛校园一样探索广东高校圈/);
  assert.match(html, /aria-label="共建地图层级"/);
  assert.match(html, />广州<\/button>/);
  assert.match(html, />广东<\/button>/);
  assert.match(html, /<button[^>]*disabled[^>]*>全国<small>筹备中<\/small><\/button>/);
  assert.match(html, /class="map-overview-row"[\s\S]*aria-label="目录统计"[\s\S]*class="map-stage/);
  assert.doesNotMatch(html, /aria-label="筛选共建者"|搜索学校、昵称或方向|仅看认证共建者/);
  assert.doesNotMatch(html, /codex-preview/);
  assert.doesNotMatch(html, /site-creator-vinext-starter|vinext-starter|loading skeleton/i);
});

test("home page omits social URLs and images when the Host header is missing", async () => {
  const response = await renderHomePage({ host: "" });
  assert.equal(response.status, 200);
  const html = await response.text();

  assert.doesNotMatch(html, /property="og:url"/);
  assert.doesNotMatch(html, /property="og:image"/);
  assert.doesNotMatch(html, /name="twitter:image"/);
  assert.doesNotMatch(html, /localhost\/og\.png|builder-map\.invalid/);
});

test("home page omits social URLs and images for malformed forwarded Host input", async () => {
  const response = await renderHomePage({ "x-forwarded-host": "attacker.test/path", "x-forwarded-proto": "https" });
  assert.equal(response.status, 200);
  const html = await response.text();

  assert.doesNotMatch(html, /property="og:url"/);
  assert.doesNotMatch(html, /property="og:image"/);
  assert.doesNotMatch(html, /name="twitter:image"/);
  assert.doesNotMatch(html, /attacker\.test|builder-map\.invalid/);
});

test("home page ignores a syntactically valid hostile forwarded host and keeps direct loopback metadata local", async () => {
  const response = await renderHomePage({ host: "localhost", "x-forwarded-host": "attacker.test", "x-forwarded-proto": "https" });
  assert.equal(response.status, 200);
  const html = await response.text();

  assert.match(html, /property="og:image"[^>]+content="http:\/\/localhost\/og\.png"/);
  assert.doesNotMatch(html, /attacker\.test/);
});

test("connections inbox page renders its consent UI without server-rendering contact plaintext", async () => {
  const response = await renderRoute("/me/connections?box=accepted", { host: "localhost" });
  assert.equal(response.status, 200);
  const html = await response.text();

  assert.match(html, /已连接|已连接/);
  assert.match(html, /收到的|发出的/);
  assert.doesNotMatch(html, /member-a-v[12]|member-b@example\.test|CONTACT_ENCRYPTION_KEY|encryptedPayload/i);
  assert.doesNotMatch(html, /reviewNotes|reporterId|sessionId/i);
});

test("unauthenticated connection API responses remain private and reveal no contact or account data", async () => {
  const response = await renderRoute("/api/connections?box=accepted", { host: "localhost" });
  assert.equal(response.status, 401);
  assert.equal(response.headers.get("Cache-Control"), "private, no-store");
  const body = await response.text();

  assert.doesNotMatch(body, /wechat|email|contactCard|encryptedPayload|demo-admin|demo-member/i);
});
