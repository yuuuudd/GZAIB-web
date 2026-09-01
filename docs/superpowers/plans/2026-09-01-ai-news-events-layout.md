# AI News and Events Layout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build and publish the approved `/news` editorial page and `/events` upcoming-activities page while preserving the existing map and community experience.

**Architecture:** Keep phase one read-only and local: typed example catalogs live in one feature module, pure filter functions provide deterministic behavior, and focused client components own category selection. Each route remains a thin page shell using the current brand header and stylesheet; no database, crawler, official-account API, or registration backend is added.

**Tech Stack:** TypeScript, React 19, Vinext App Router, Node test runner through `tsx --test`, React DOM server rendering, jsdom for mounted interaction tests, Sites hosting.

**Spec:** `docs/superpowers/specs/2026-09-01-ai-news-events-layout-design.md`

## Global Constraints

- Routes are exactly `/news` and `/events`.
- Phase one uses clearly identified local example content only.
- Do not add database tables, scheduled collection, official-account APIs, admin content forms, or in-site registration.
- News categories are exactly `全部`, `AI 应用`, `模型动态`, `产业观察`, `开源工具`, `教育实践`.
- Event types are exactly `全部`, `比赛赛事`, `黑客松`, `分享会`, `工作坊`, `展会`.
- Event locations are exactly `广州`, `广东`, `线上`, `全国`.
- Event groups are exactly `本周进行`, `即将开始`, `长期征集`.
- Every external source or registration link opens in a new tab with `rel="noreferrer noopener"`.
- The activity page must state `报名及结果通知由主办方负责`.
- Cross-route links to the home map use browser-native `<a href="/#map">` navigation.
- Preserve the existing white, pale blue-gray, deep navy, cobalt, and orange visual system.
- At widths below 760px, both pages use a single content column without horizontal page overflow.

---

### Task 1: Typed Example Catalogs and Pure Filters

**Files:**
- Create: `features/content-hub/catalog.ts`
- Test: `tests/content-hub/catalog.test.ts`

**Interfaces:**
- Produces: `NewsCategory`, `NewsItem`, `EventType`, `EventLocation`, `EventGroup`, `EventItem`.
- Produces: `NEWS_CATEGORIES`, `EVENT_TYPES`, `EVENT_LOCATIONS`, `newsItems`, `eventItems`.
- Produces: `filterNews(items, category)` and `filterEvents(items, type, location)`.
- Consumes: no project services or runtime bindings.

- [ ] **Step 1: Write the failing catalog and filter tests**

```ts
import assert from "node:assert/strict";
import test from "node:test";
import {
  EVENT_LOCATIONS,
  EVENT_TYPES,
  NEWS_CATEGORIES,
  eventItems,
  filterEvents,
  filterNews,
  newsItems,
} from "../../features/content-hub/catalog";

test("content hub exposes the approved filter vocabularies", () => {
  assert.deepEqual(NEWS_CATEGORIES, ["全部", "AI 应用", "模型动态", "产业观察", "开源工具", "教育实践"]);
  assert.deepEqual(EVENT_TYPES, ["全部", "比赛赛事", "黑客松", "分享会", "工作坊", "展会"]);
  assert.deepEqual(EVENT_LOCATIONS, ["广州", "广东", "线上", "全国"]);
});

test("news filters retain only the selected editorial category", () => {
  assert.ok(newsItems.length >= 6);
  assert.ok(filterNews(newsItems, "全部").length === newsItems.length);
  assert.ok(filterNews(newsItems, "开源工具").every((item) => item.category === "开源工具"));
});

test("event filters combine type and location without changing time groups", () => {
  assert.ok(eventItems.length >= 4);
  const filtered = filterEvents(eventItems, "工作坊", "广州");
  assert.ok(filtered.length > 0);
  assert.ok(filtered.every((item) => item.type === "工作坊" && item.locations.includes("广州")));
  assert.ok(filtered.every((item) => ["本周进行", "即将开始", "长期征集"].includes(item.group)));
});

test("all example links use safe https origins", () => {
  for (const item of [...newsItems, ...eventItems]) assert.equal(new URL(item.url).protocol, "https:");
});
```

- [ ] **Step 2: Run the test and verify RED**

Run: `npx tsx --test tests/content-hub/catalog.test.ts`

Expected: FAIL because `features/content-hub/catalog.ts` does not exist.

- [ ] **Step 3: Implement the typed catalogs and pure filters**

```ts
export const NEWS_CATEGORIES = ["全部", "AI 应用", "模型动态", "产业观察", "开源工具", "教育实践"] as const;
export type NewsCategory = Exclude<(typeof NEWS_CATEGORIES)[number], "全部">;

export type NewsItem = {
  id: string;
  category: NewsCategory;
  title: string;
  summary: string;
  source: string;
  publishedLabel: string;
  url: string;
  featured?: "lead" | "secondary";
};

export const EVENT_TYPES = ["全部", "比赛赛事", "黑客松", "分享会", "工作坊", "展会"] as const;
export const EVENT_LOCATIONS = ["广州", "广东", "线上", "全国"] as const;
export type EventType = Exclude<(typeof EVENT_TYPES)[number], "全部">;
export type EventLocation = (typeof EVENT_LOCATIONS)[number];
export type EventGroup = "本周进行" | "即将开始" | "长期征集";

export type EventItem = {
  id: string;
  type: EventType;
  title: string;
  summary: string;
  locations: EventLocation[];
  venue: string;
  organizer: string;
  dateLabel: string;
  deadlineLabel: string;
  group: EventGroup;
  url: string;
  featured?: boolean;
};

export function filterNews(items: NewsItem[], category: (typeof NEWS_CATEGORIES)[number]) {
  return category === "全部" ? items : items.filter((item) => item.category === category);
}

export function filterEvents(items: EventItem[], type: (typeof EVENT_TYPES)[number], location: EventLocation) {
  return items.filter((item) => (type === "全部" || item.type === type) && item.locations.includes(location));
}
```

Add at least six clearly fictional news examples and four clearly fictional events. Use `https://example.com/` URLs and a visible `示例内容` label in the UI tasks; do not present examples as current facts.

- [ ] **Step 4: Run the focused test and verify GREEN**

Run: `npx tsx --test tests/content-hub/catalog.test.ts`

Expected: 4 tests pass, 0 fail.

- [ ] **Step 5: Commit the catalog task**

```bash
git add features/content-hub/catalog.ts tests/content-hub/catalog.test.ts
git commit -m "feat: add example news and event catalogs"
```

---

### Task 2: AI News Editorial Page

**Files:**
- Create: `components/content-hub/ContentHubHeader.tsx`
- Create: `components/content-hub/NewsEditorial.tsx`
- Create: `app/news/page.tsx`
- Test: `tests/content-hub/news-editorial.test.ts`

**Interfaces:**
- Consumes: `NewsItem`, `NEWS_CATEGORIES`, `filterNews`, and `newsItems` from `features/content-hub/catalog.ts`.
- Produces: `ContentHubHeader({ active }: { active: "news" | "events" })` for the two new routes.
- Produces: `NewsEditorial({ items }: { items: NewsItem[] })`.
- Produces: public route `/news`.

- [ ] **Step 1: Write the failing mounted interaction test**

```ts
import assert from "node:assert/strict";
import test from "node:test";
import { JSDOM } from "jsdom";
import { createElement } from "react";
import { createRoot } from "react-dom/client";
import { act } from "react";
import { NewsEditorial } from "../../components/content-hub/NewsEditorial";
import { newsItems } from "../../features/content-hub/catalog";

test("news category buttons filter the real editorial list", async () => {
  const dom = new JSDOM('<div id="root"></div>', { url: "https://example.test/news" });
  Object.assign(globalThis, { window: dom.window, document: dom.window.document, navigator: dom.window.navigator });
  const root = createRoot(document.querySelector("#root")!);
  await act(async () => root.render(createElement(NewsEditorial, { items: newsItems })));
  const button = [...document.querySelectorAll("button")].find((node) => node.textContent === "开源工具") as HTMLButtonElement;
  await act(async () => button.click());
  const cards = [...document.querySelectorAll("[data-news-category]")];
  assert.ok(cards.length > 0);
  assert.ok(cards.every((card) => card.getAttribute("data-news-category") === "开源工具"));
  root.unmount();
  dom.window.close();
});
```

- [ ] **Step 2: Run the test and verify RED**

Run: `npx tsx --test tests/content-hub/news-editorial.test.ts`

Expected: FAIL because `NewsEditorial` does not exist.

- [ ] **Step 3: Implement the editorial client component**

Create a client component that:

```tsx
"use client";

export function NewsEditorial({ items }: { items: NewsItem[] }) {
  const [category, setCategory] = useState<(typeof NEWS_CATEGORIES)[number]>("全部");
  const lead = items.find((item) => item.featured === "lead");
  const secondary = items.filter((item) => item.featured === "secondary").slice(0, 2);
  const latest = filterNews(items.filter((item) => !item.featured), category);

  return <section className="news-directory" aria-labelledby="news-title">
    <p className="content-preview-note">页面设计预览 · 以下为示例内容</p>
    <header className="content-hub-heading"><p className="community-kicker">AI 资讯</p><h1 id="news-title">值得关注的 AI 新进展</h1><p>少一点噪音，多一点真正值得了解的变化。</p></header>
    <div className="news-feature-grid">
      {lead ? <article className="news-lead-card"><div className="news-card-art" aria-hidden="true" /><div><span>{lead.category}</span><h2>{lead.title}</h2><p>{lead.summary}</p><small>{lead.source} · {lead.publishedLabel}</small></div></article> : null}
      <div className="news-secondary-stack">{secondary.map((item) => <article key={item.id}><span>{item.category}</span><h2>{item.title}</h2><p>{item.summary}</p><small>{item.source} · {item.publishedLabel}</small></article>)}</div>
    </div>
    <nav className="content-filter-pills" aria-label="资讯分类">{NEWS_CATEGORIES.map((value) => <button key={value} type="button" aria-pressed={category === value} onClick={() => setCategory(value)}>{value}</button>)}</nav>
    <div className="news-latest-list">{latest.map((item) => <article key={item.id} data-news-category={item.category}><span>{item.category}</span><h2>{item.title}</h2><p>{item.summary}</p><small>{item.source} · {item.publishedLabel}</small><a href={item.url} target="_blank" rel="noreferrer noopener">阅读原文 →</a></article>)}</div>
  </section>;
}
```

Use real buttons with `aria-pressed={category === value}`. Add `data-news-category={item.category}` to every latest row. Every `阅读原文` link must use `target="_blank" rel="noreferrer noopener"`.

- [ ] **Step 4: Implement the shared header and thin `/news` route**

Create `ContentHubHeader.tsx`:

```tsx
/* eslint-disable @next/next/no-html-link-for-pages -- The map fragment needs browser-native cross-route navigation. */
import Image from "next/image";
import Link from "next/link";

export function ContentHubHeader({ active }: { active: "news" | "events" }) {
  return <header className="brand-header content-hub-header">
    <Link className="brand-mark" href="/" aria-label="广州AI共创社首页"><Image src="/logo.png" alt="广州AI共创社" width={44} height={44} priority /><span>广州AI共创社</span></Link>
    <nav className="brand-nav" aria-label="主导航"><a href="/#map">共建地图</a><Link href="/communities">AI 社群</Link><Link className={active === "news" ? "brand-nav-active" : undefined} href="/news">AI 资讯</Link><Link className={active === "events" ? "brand-nav-active" : undefined} href="/events">活动赛事</Link></nav>
    <Link className="brand-header-action" href="/apply">申请加入</Link>
  </header>;
}
```

Create `app/news/page.tsx`:

```tsx
import { ContentHubHeader } from "../../components/content-hub/ContentHubHeader";
import { NewsEditorial } from "../../components/content-hub/NewsEditorial";
import { newsItems } from "../../features/content-hub/catalog";

export default function NewsPage() {
  return <main className="content-hub-shell">
    <ContentHubHeader active="news" />
    <NewsEditorial items={newsItems} />
  </main>;
}
```

- [ ] **Step 5: Run the focused test and verify GREEN**

Run: `npx tsx --test tests/content-hub/news-editorial.test.ts`

Expected: 1 test passes, 0 fail.

- [ ] **Step 6: Commit the news page**

```bash
git add components/content-hub/ContentHubHeader.tsx components/content-hub/NewsEditorial.tsx app/news/page.tsx tests/content-hub/news-editorial.test.ts
git commit -m "feat: add curated AI news page"
```

---

### Task 3: AI Activities and Events Page

**Files:**
- Create: `components/content-hub/EventDirectory.tsx`
- Create: `app/events/page.tsx`
- Test: `tests/content-hub/event-directory.test.ts`

**Interfaces:**
- Consumes: `EventItem`, `EVENT_TYPES`, `EVENT_LOCATIONS`, `filterEvents`, and `eventItems` from `features/content-hub/catalog.ts`.
- Produces: `EventDirectory({ items }: { items: EventItem[] })`.
- Produces: public route `/events`.

- [ ] **Step 1: Write the failing mounted filter and grouping test**

```ts
import assert from "node:assert/strict";
import test from "node:test";
import { JSDOM } from "jsdom";
import { createElement } from "react";
import { createRoot } from "react-dom/client";
import { act } from "react";
import { EventDirectory } from "../../components/content-hub/EventDirectory";
import { eventItems } from "../../features/content-hub/catalog";

test("event controls combine type and location and retain approved timeline groups", async () => {
  const dom = new JSDOM('<div id="root"></div>', { url: "https://example.test/events" });
  Object.assign(globalThis, { window: dom.window, document: dom.window.document, navigator: dom.window.navigator });
  const root = createRoot(document.querySelector("#root")!);
  await act(async () => root.render(createElement(EventDirectory, { items: eventItems })));
  const click = async (label: string) => {
    const button = [...document.querySelectorAll("button")].find((node) => node.textContent === label) as HTMLButtonElement;
    await act(async () => button.click());
  };
  await click("工作坊");
  await click("广州");
  const cards = [...document.querySelectorAll("[data-event-type]")];
  assert.ok(cards.length > 0);
  assert.ok(cards.every((card) => card.getAttribute("data-event-type") === "工作坊"));
  assert.match(document.body.textContent ?? "", /本周进行|即将开始|长期征集/);
  assert.match(document.body.textContent ?? "", /报名及结果通知由主办方负责/);
  root.unmount();
  dom.window.close();
});
```

- [ ] **Step 2: Run the test and verify RED**

Run: `npx tsx --test tests/content-hub/event-directory.test.ts`

Expected: FAIL because `EventDirectory` does not exist.

- [ ] **Step 3: Implement the event discovery component**

Create a client component that keeps two independent selections:

```tsx
"use client";

const EVENT_GROUPS: EventGroup[] = ["本周进行", "即将开始", "长期征集"];

export function EventDirectory({ items }: { items: EventItem[] }) {
  const [type, setType] = useState<(typeof EVENT_TYPES)[number]>("全部");
  const [location, setLocation] = useState<EventLocation>("广州");
  const filtered = filterEvents(items, type, location);
  const featured = filtered.find((item) => item.featured) ?? filtered[0];
  return <section className="event-directory" aria-labelledby="events-title">
    <p className="content-preview-note">页面设计预览 · 以下为示例内容</p>
    <header className="content-hub-heading"><p className="community-kicker">AI 活动与赛事</p><h1 id="events-title">找到下一场值得参加的 AI 活动</h1><p>比赛、黑客松、分享会与工作坊，从近期时间开始发现。</p></header>
    <div className="event-filter-bar"><div aria-label="活动类型">{EVENT_TYPES.map((value) => <button key={value} type="button" aria-pressed={type === value} onClick={() => setType(value)}>{value}</button>)}</div><div aria-label="活动地区">{EVENT_LOCATIONS.map((value) => <button key={value} type="button" aria-pressed={location === value} onClick={() => setLocation(value)}>{value}</button>)}</div></div>
    <div className="event-content-grid">
      <div>{featured ? <article className="event-feature-card" data-event-type={featured.type}><span>{featured.dateLabel}</span><div><small>{featured.type}</small><h2>{featured.title}</h2><p>{featured.venue} · {featured.organizer}</p><p>{featured.summary}</p><a href={featured.url} target="_blank" rel="noreferrer noopener">前往官网报名 ↗</a></div></article> : null}{EVENT_GROUPS.map((group) => { const groupItems = filtered.filter((item) => item.group === group); return groupItems.length ? <section className="event-timeline-group" key={group}><h2>{group}</h2>{groupItems.map((item) => <article key={item.id} data-event-type={item.type}><time>{item.dateLabel}</time><span>{item.type}</span><h3>{item.title}</h3><p>{item.venue}</p><small>报名截止：{item.deadlineLabel}</small><a href={item.url} target="_blank" rel="noreferrer noopener">前往官网报名 ↗</a></article>)}</section> : null; })}{filtered.length === 0 ? <p className="content-hub-empty">暂时没有匹配的活动，试试其他类型或地区。</p> : null}</div>
      <aside className="event-sidebar"><section aria-labelledby="schedule-title"><h2 id="schedule-title">近期日程</h2><ul>{filtered.slice(0, 4).map((item) => <li key={item.id}><time>{item.dateLabel}</time><span>{item.title}</span></li>)}</ul></section><p className="event-responsibility-note">报名及结果通知由主办方负责</p></aside>
    </div>
  </section>;
}
```

Buttons use `aria-pressed`. Timeline cards use `data-event-type={item.type}` and stay in `EVENT_GROUPS` order. If no items match, show `暂时没有匹配的活动，试试其他类型或地区。`. Registration links use `target="_blank" rel="noreferrer noopener"` and the visible label `前往官网报名 ↗`.

- [ ] **Step 4: Implement the thin `/events` route**

```tsx
import { ContentHubHeader } from "../../components/content-hub/ContentHubHeader";
import { EventDirectory } from "../../components/content-hub/EventDirectory";
import { eventItems } from "../../features/content-hub/catalog";

export default function EventsPage() {
  return <main className="content-hub-shell">
    <ContentHubHeader active="events" />
    <EventDirectory items={eventItems} />
  </main>;
}
```

- [ ] **Step 5: Run the focused test and verify GREEN**

Run: `npx tsx --test tests/content-hub/event-directory.test.ts`

Expected: 1 test passes, 0 fail.

- [ ] **Step 6: Commit the events page**

```bash
git add components/content-hub/EventDirectory.tsx app/events/page.tsx tests/content-hub/event-directory.test.ts
git commit -m "feat: add upcoming AI events page"
```

---

### Task 4: Navigation Integration and Responsive Visual System

**Files:**
- Modify: `app/page.tsx`
- Modify: `app/communities/page.tsx`
- Modify: `app/communities/[slug]/page.tsx`
- Modify: `app/communities/submit/page.tsx`
- Modify: `app/globals.css`
- Modify: `tests/rendered-html.test.mjs`

**Interfaces:**
- Consumes: routes `/news` and `/events` created in Tasks 2 and 3.
- Produces: clickable public navigation on the home and community surfaces.
- Produces: CSS classes used by `NewsEditorial` and `EventDirectory`.

- [ ] **Step 1: Write the failing rendered-navigation assertions**

Add to `tests/rendered-html.test.mjs`, using its existing `renderRoute` helper:

```js
test("home and community pages expose the two content channels", async () => {
  for (const route of ["/", "/communities"]) {
    const response = await renderRoute(route, { host: "localhost" });
    const html = await response.text();
    assert.equal(response.status, 200);
    assert.match(html, /href="\/news"[^>]*>AI 资讯<\/a>/);
    assert.match(html, /href="\/events"[^>]*>活动赛事<\/a>/);
  }
});
```

- [ ] **Step 2: Run the test and verify RED**

Run: `npm run test:render`

Expected: FAIL in `home and community pages expose the two content channels` because the current community shell still renders disabled coming-soon labels.

- [ ] **Step 3: Wire the navigation links**

Replace the community header placeholders with clickable links:

```tsx
<Link href="/news">AI 资讯</Link>
<Link href="/events">活动赛事</Link>
```

Add the same two routes to the home header. Preserve native `<a href="/#map">` for cross-route map navigation. Use active classes only for the current page.

- [ ] **Step 4: Add the approved shared styles**

Append a focused `/* AI content hub */` section to `app/globals.css` covering:

- `.content-hub-shell`, `.content-hub-header`, `.news-directory`, `.event-directory`.
- A compact heading block with the approved deep navy type and orange kicker.
- News feature grid: `grid-template-columns: minmax(0, 1.7fr) minmax(280px, .9fr)`.
- News category pills and horizontal latest rows.
- Event layout: `grid-template-columns: minmax(0, 1fr) 300px`.
- Featured orange date block, chronological border line, date sidebar, and responsibility notice.
- `@media (max-width: 760px)` single-column layouts, wrapping filter bars, and no fixed minimum widths.
- `:focus-visible` outlines matching the existing cobalt focus treatment.
- `prefers-reduced-motion` compatibility if hover transitions are added.

- [ ] **Step 5: Extend rendered route checks**

Add to `tests/rendered-html.test.mjs`:

```js
test("news and events pages render their approved first viewport contracts", async () => {
  const news = await renderRoute("/news", { host: "localhost" });
  const newsHtml = await news.text();
  assert.equal(news.status, 200);
  assert.match(newsHtml, /值得关注的 AI 新进展/);
  assert.match(newsHtml, /页面设计预览 · 以下为示例内容/);

  const events = await renderRoute("/events", { host: "localhost" });
  const eventsHtml = await events.text();
  assert.equal(events.status, 200);
  assert.match(eventsHtml, /找到下一场值得参加的 AI 活动/);
  assert.match(eventsHtml, /报名及结果通知由主办方负责/);
});
```

- [ ] **Step 6: Run the integration checks**

Run: `npm run test:unit`

Expected: all unit tests pass, including the new catalog and mounted interaction tests.

Run: `npm run test:render`

Expected: build succeeds and all rendered HTML tests pass.

- [ ] **Step 7: Commit navigation and visual integration**

```bash
git add app/page.tsx app/communities app/news app/events app/globals.css tests/content-hub tests/rendered-html.test.mjs
git commit -m "feat: integrate AI news and events navigation"
```

---

### Task 5: Browser Acceptance and Production Publish

**Files:**
- Verify only: `.openai/hosting.json`
- Generated and removed after upload: `.openai/site-build.tar.gz`

**Interfaces:**
- Consumes: successful build and the current Sites project ID from `.openai/hosting.json`.
- Produces: one new saved Sites version and one production deployment at the existing public URL.

- [ ] **Step 1: Start or reuse the Vinext development server**

Run: `npm run dev`

Expected: the existing project serves a local URL without a blocking compile error.

- [ ] **Step 2: Perform browser acceptance on `/news`**

Using the existing in-app Site tab:

1. Navigate to `/news`.
2. Confirm one lead feature and two secondary features are visible.
3. Click `开源工具` and confirm only matching latest rows remain.
4. Confirm `AI 资讯` is active and `活动赛事` is clickable.

- [ ] **Step 3: Perform browser acceptance on `/events`**

1. Navigate to `/events`.
2. Click `工作坊`, then `广州`.
3. Confirm every remaining event card is a Guangzhou workshop.
4. Confirm at least one approved timeline group remains visible.
5. Confirm `报名及结果通知由主办方负责` is visible.
6. Confirm a registration link exposes an HTTPS destination without completing any external registration.

- [ ] **Step 4: Verify cross-page navigation**

From both new routes, click `共建地图` and confirm the final URL ends in `/#map` and the paper map heading is visible. Navigate back and confirm `/communities`, `/news`, and `/events` all load.

- [ ] **Step 5: Run final verification**

Run: `npm run test`

Expected: unit tests, production build, and rendered HTML tests all pass with exit code 0.

Run: `npx eslint app/news app/events components/content-hub features/content-hub tests/content-hub`

Expected: 0 errors.

Run: `git diff --check && git status --short`

Expected: no whitespace errors; only intentional tracked changes remain before the final commit.

- [ ] **Step 6: Push, package, save, and publish**

1. Commit any final test-only adjustments.
2. Push the exact current HEAD to the existing Sites `main` branch without force.
3. Build the archive with the Sites `scripts/package-site.sh` helper.
4. Save one Sites version using the pushed HEAD SHA and exact build archive.
5. Deploy that saved version with the site's existing public access.
6. Poll deployment status until `succeeded` or `failed`.

- [ ] **Step 7: Verify production and clean generated files**

On the exact production URL, repeat the navigation and one filter interaction on each new route. Remove `.openai/site-build.tar.gz`, stop the local development server, and confirm `git status --short` is clean.
