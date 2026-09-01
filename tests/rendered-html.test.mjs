import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
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

function assertChannelLink(document, href, text) {
  const link = [...document.querySelectorAll("a")]
    .find((candidate) => candidate.getAttribute("href") === href && candidate.textContent?.trim() === text);
  assert.ok(link, `Expected ${text} link to ${href}`);
  return link;
}

test("non-home navigation uses the current horizontal brand logo", async () => {
  const responses = await Promise.all([
    renderRoute("/communities", { host: "localhost" }),
    renderRoute("/news", { host: "localhost" }),
  ]);

  for (const response of responses) {
    assert.equal(response.status, 200);
    const dom = new JSDOM(await response.text());
    try {
      assert.ok(dom.window.document.querySelector('a.brand-mark[href="/"] img[src="/brand/gzaib-horizontal.png"]'));
    } finally {
      dom.window.close();
    }
  }
});

test("public home and community routes link to the live news and events channels", async () => {
  const [homeResponse, communitiesResponse] = await Promise.all([
    renderRoute("/", { host: "localhost" }),
    renderRoute("/communities", { host: "localhost" }),
  ]);
  assert.equal(homeResponse.status, 200);
  assert.equal(communitiesResponse.status, 200);

  for (const [response, homeCurrent] of [
    [homeResponse, "page"],
    [communitiesResponse, null],
  ]) {
    const dom = new JSDOM(await response.text());
    try {
      assert.equal(assertChannelLink(dom.window.document, "/", "首页").getAttribute("aria-current"), homeCurrent);
      assert.equal(assertChannelLink(dom.window.document, "/#map", "共建地图").getAttribute("aria-current"), null);
      assertChannelLink(dom.window.document, "/communities", "AI 社群");
      assertChannelLink(dom.window.document, "/news", "AI 资讯");
      assertChannelLink(dom.window.document, "/events", "活动赛事");
    } finally {
      dom.window.close();
    }
  }
});

test("news route renders its editorial hierarchy and links to events", async () => {
  const response = await renderRoute("/news", { host: "localhost" });
  assert.equal(response.status, 200);
  const dom = new JSDOM(await response.text());
  try {
    const document = dom.window.document;
    assert.match(document.body.textContent ?? "", /值得关注的 AI 新进展/);
    assert.match(document.body.textContent ?? "", /最后核验于 2026-09-01/);
    assert.doesNotMatch(document.body.textContent ?? "", /页面设计预览|示例内容/);
    assert.equal(document.querySelectorAll(".news-lead-card").length, 1);
    assert.equal(assertChannelLink(document, "/news", "AI 资讯").getAttribute("aria-current"), "page");
    assertChannelLink(document, "/events", "活动赛事");
    assert.ok(document.querySelector('nav[aria-label="资讯分类"]'));
  } finally {
    dom.window.close();
  }
});

test("events route renders its responsibility boundary and links to news", async () => {
  const response = await renderRoute("/events", { host: "localhost" });
  assert.equal(response.status, 200);
  const dom = new JSDOM(await response.text());
  try {
    const document = dom.window.document;
    assert.match(document.body.textContent ?? "", /找到下一场值得参加的 AI 活动/);
    assert.match(document.body.textContent ?? "", /报名及结果通知由主办方负责/);
    assertChannelLink(document, "/news", "AI 资讯");
    assert.equal(assertChannelLink(document, "/events", "活动赛事").getAttribute("aria-current"), "page");
  } finally {
    dom.window.close();
  }
});

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
  assert.match(html, /青年共建 · 连接创造力/);
  assert.match(html, /让愿意分享的人被看见，让想做的事找到同行者，让高校里的创造力彼此连接/);
  assert.match(html, /高校共建者 · 行动连接地图/);
  assert.match(html, /每一枚图钉，不只是一个地点，也是一份愿意分享、愿意行动的共建回应/);
  assert.match(html, /看见彼此，连接行动/);
  assert.match(html, /aria-label="共建地图层级"/);
  assert.doesNotMatch(html, /aria-label="切换地图风格"|>彩绘版<\/button>|>标准版<\/button>/);
  assert.match(html, />广州<\/button>/);
  assert.match(html, />广东<\/button>/);
  assert.match(html, /<button[^>]*aria-pressed="false"[^>]*>全国<\/button>/);
  assert.match(html, /class="map-overview-row"[\s\S]*aria-label="目录统计"[\s\S]*class="map-stage/);
  assert.doesNotMatch(html, /aria-label="筛选共建者"|搜索学校、昵称或方向|仅看认证共建者/);
  assert.doesNotMatch(html, /codex-preview/);
  assert.doesNotMatch(html, /site-creator-vinext-starter|vinext-starter|loading skeleton/i);
});

test("home hero exposes the approved brand and all four visual channels in the first surface", async () => {
  const response = await renderHomePage({ host: "localhost" });
  assert.equal(response.status, 200);
  const dom = new JSDOM(await response.text());
  try {
    const document = dom.window.document;
    const hero = document.querySelector(".brand-home-hero");
    assert.ok(hero);
    assert.match(hero.textContent ?? "", /让广东每一所高校，都亮起一束共建的光。/);

    const lockup = document.querySelector('.brand-mark img[src="/brand/gzaib-horizontal.png"]');
    assert.ok(lockup);

    const channels = [...hero.querySelectorAll("a.hero-channel-card")].map((card) => ({
      href: card.getAttribute("href"),
      title: card.querySelector("h2")?.textContent?.trim(),
      artwork: card.querySelector("img")?.getAttribute("src"),
    }));
    assert.deepEqual(channels, [
      { href: "#map", title: "共建地图", artwork: "/brand/home-map.webp" },
      { href: "/communities", title: "AI 社区", artwork: "/brand/home-community.webp" },
      { href: "/news", title: "AI 资讯", artwork: "/brand/home-news.webp" },
      { href: "/events", title: "活动赛事", artwork: "/brand/home-events.webp" },
    ]);
  } finally {
    dom.window.close();
  }
});

test("home page presents the five-stage community action loop as one closed path", async () => {
  const response = await renderHomePage({ host: "localhost" });
  assert.equal(response.status, 200);
  const dom = new JSDOM(await response.text());
  try {
    const document = dom.window.document;
    const loop = document.querySelector(".community-loop");
    assert.ok(loop);
    assert.match(loop.textContent ?? "", /从连接，到创造/);
    assert.match(loop.textContent ?? "", /让议题找到同行，让行动沉淀成果。/);
    assert.deepEqual(
      [...loop.querySelectorAll(".community-loop-step strong")].map((node) => node.textContent?.trim()),
      ["发现", "连接", "共创", "落地", "沉淀"],
    );
    assert.equal(loop.querySelectorAll(".community-loop-step").length, 5);
    assert.ok(loop.querySelector("svg.community-loop-path path.community-loop-path-line"));
    assert.equal(loop.querySelector(".community-loop-return"), null);
    assert.doesNotMatch(loop.textContent ?? "", /进入下一轮发现/);
    assert.equal(loop.querySelector('a[href="/events"]')?.textContent?.trim(), "发现");
    assert.equal(loop.querySelector('a[href="/#map"]')?.textContent?.trim(), "连接");
    assert.equal(loop.querySelector('a[href="/apply"]')?.textContent?.trim(), "共创");
    assert.doesNotMatch(loop.textContent ?? "", /真实、本人选择、经过审核|一束光如何亮起/);
  } finally {
    dom.window.close();
  }
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

test("home and community pages expose the two live content channels", async () => {
  for (const route of ["/", "/communities"]) {
    const response = await renderRoute(route, { host: "localhost" });
    const html = await response.text();
    assert.equal(response.status, 200);
    assert.match(html, /href="\/news"[^>]*>AI 资讯<\/a>/);
    assert.match(html, /href="\/events"[^>]*>活动赛事<\/a>/);
  }
});

test("news and events pages render sourced content without preview labels", async () => {
  const news = await renderRoute("/news", { host: "localhost" });
  const newsHtml = await news.text();
  assert.equal(news.status, 200);
  assert.match(newsHtml, /值得关注的 AI 新进展/);
  assert.match(newsHtml, /GPT-5\.6 正式上线/);
  assert.doesNotMatch(newsHtml, /示例内容|深客松|肇客松|莞客松/);

  const events = await renderRoute("/events", { host: "localhost" });
  const eventsHtml = await events.text();
  assert.equal(events.status, 200);
  assert.match(eventsHtml, /找到下一场值得参加的 AI 活动/);
  assert.match(eventsHtml, /AIx Origin 黑客松/);
  assert.match(eventsHtml, /报名及结果通知由主办方负责/);
  assert.doesNotMatch(eventsHtml, /示例内容|深客松|肇客松|莞客松/);
});
