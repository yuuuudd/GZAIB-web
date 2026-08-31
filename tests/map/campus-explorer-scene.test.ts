import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import test from "node:test";
import { CampusExplorerScene, CampusMapFallback } from "../../components/map/CampusExplorerScene";
import type { MapCitySummary } from "../../features/map/semantic-map";

const cities: MapCitySummary[] = [
  {
    city: "广州",
    memberCount: 12,
    schoolCount: 2,
    center: { lng: 113.2644, lat: 23.1291 },
    schools: [
      { id: "sysu", name: "中山大学", campus: "南校园", city: "广州", lng: 113.298, lat: 23.096, memberCount: 7, previewMembers: [] },
      { id: "scut", name: "华南理工大学", campus: "五山校区", city: "广州", lng: 113.344, lat: 23.157, memberCount: 5, previewMembers: [] },
    ],
  },
  {
    city: "深圳",
    memberCount: 5,
    schoolCount: 1,
    center: { lng: 114.0579, lat: 22.5431 },
    schools: [],
  },
];

const globalCss = readFileSync(join(process.cwd(), "app", "globals.css"), "utf8");

test("city explorer scene turns live directory totals into a playful accessible energy card", () => {
  const html = renderToStaticMarkup(createElement(CampusExplorerScene, {
    cities,
    level: "city",
    activeCity: "广州",
  }));

  assert.match(html, /campus-explorer-art/);
  assert.match(html, /aria-label="共建能量"/);
  assert.match(html, /广州已有12位伙伴点亮2所学校/);
  assert.match(html, /点击学校图钉，发现同校伙伴与项目/);
  assert.doesNotMatch(html, /本周/);
});

test("province explorer scene summarizes the current public Guangdong directory", () => {
  const html = renderToStaticMarkup(createElement(CampusExplorerScene, {
    cities,
    level: "province",
    activeCity: "广州",
  }));

  assert.match(html, /广东已有17位伙伴点亮3所学校/);
  assert.match(html, /探索城市，看看高校能量在哪里汇聚/);
  assert.match(html, /\/map-art\/guangdong-paper-clay-cutout-v1\.png/);
  assert.match(html, /珠三角城市建筑贴纸/);
  assert.match(html, /\/map-art\/landmark-guangzhou\.webp/);
  assert.match(html, /aria-label="进入广州学校网络，12位共建者"/);
  assert.match(html, /data-layout="red-frame"/);
  assert.doesNotMatch(html, /\/map-art\/landmark-shenzhen\.webp/);
  assert.doesNotMatch(html, /explorer-cloud|explorer-star|explorer-plane/);
});

test("province paper map keeps the Guangzhou city entry clickable", () => {
  const html = renderToStaticMarkup(createElement(CampusMapFallback, {
    cities,
    level: "province",
    activeCity: "广州",
    onSelectCity: () => undefined,
    onSelectSchool: () => undefined,
  }));

  assert.match(html, /aria-label="广东校园探索板块"/);
  assert.match(html, /aria-label="进入广州学校网络，12位共建者"/);
  assert.match(html, /class="paper-art-map/);
  assert.doesNotMatch(html, /amap-canvas/);
});

test("Guangzhou uses the dedicated university-town artwork and keeps school pins", () => {
  const guangzhou = renderToStaticMarkup(createElement(CampusMapFallback, {
    cities,
    level: "city",
    activeCity: "广州",
    onSelectCity: () => undefined,
    onSelectSchool: () => undefined,
  } as Parameters<typeof CampusMapFallback>[0]));

  assert.match(guangzhou, /guangzhou-university-regions-cutout-v1\.png/);
  assert.match(guangzhou, /aria-label="广州高校片区纸雕地图"/);
  assert.match(guangzhou, /中山大学/);
  assert.match(guangzhou, /华南理工大学/);
  assert.match(guangzhou, /style="left:46%;top:56%"[^>]*title="中山大学/);
  assert.match(guangzhou, /style="left:68%;top:31%"[^>]*title="华南理工大学/);
  assert.doesNotMatch(guangzhou, /amap-canvas|guangdong-paper-clay\.webp|landmark-guangzhou\.webp/);
});

test("paper maps float directly on the page without a framed canvas", () => {
  assert.match(globalCss, /\.map-stage \{[^}]*border:0;[^}]*border-radius:0;[^}]*background:transparent;[^}]*box-shadow:none;/);
  assert.match(globalCss, /\.map-live \{[^}]*background:transparent;/);
  assert.match(globalCss, /\.campus-fallback-map \{[^}]*background:transparent;/);
  assert.match(globalCss, /\.guangzhou-region-art \{[^}]*background:transparent;/);
});

test("city fallback uses the generated blue and orange marker artwork", () => {
  const html = renderToStaticMarkup(createElement(CampusMapFallback, {
    cities,
    level: "city",
    activeCity: "广州",
    onSelectCity: () => undefined,
    onSelectSchool: () => undefined,
  }));

  assert.match(html, /\/map-art\/school-pin-orange-v1\.png/);
  assert.match(html, /\/map-art\/school-pin-blue-v1\.png/);
});
