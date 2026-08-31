import assert from "node:assert/strict";
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
});

test("fallback keeps a real campus exploration board visible when AMap is unavailable", () => {
  const html = renderToStaticMarkup(createElement(CampusMapFallback, {
    cities,
    level: "city",
    activeCity: "广州",
    onRetry: () => undefined,
  }));

  assert.match(html, /aria-label="广州校园探索板块"/);
  assert.match(html, /中山大学/);
  assert.match(html, />7位</);
  assert.match(html, /华南理工大学/);
  assert.match(html, /重新连接精确地图/);
});
