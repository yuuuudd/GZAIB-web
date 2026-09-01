import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import test from "node:test";
import type { MapCitySummary } from "../../features/map/semantic-map";
import { CityDirectoryFallback } from "../../components/map/CityDirectoryFallback";

const cities: MapCitySummary[] = [
  {
    city: "广州",
    memberCount: 12,
    schoolCount: 2,
    center: { lng: 113.2644, lat: 23.1291 },
    schools: [
      { id: "sysu", name: "中山大学", campus: "广州校区南校园", city: "广州", lng: 113.298, lat: 23.096, memberCount: 7, previewMembers: [] },
      { id: "scut", name: "华南理工大学", campus: "五山校区", city: "广州", lng: 113.344, lat: 23.157, memberCount: 5, previewMembers: [] },
    ],
  },
  {
    city: "深圳",
    memberCount: 4,
    schoolCount: 1,
    center: { lng: 114.0579, lat: 22.5431 },
    schools: [],
  },
];

test("province fallback presents city totals as drill-down controls", () => {
  const html = renderToStaticMarkup(createElement(CityDirectoryFallback, {
    cities,
    activeCity: "广州",
    level: "province",
    onSelectCity: () => undefined,
    onBackToProvince: () => undefined,
    onSelectSchool: () => undefined,
  }));

  assert.match(html, /广东共建概览/);
  assert.match(html, /广州/);
  assert.match(html, /12 位共建者/);
  assert.match(html, /2 所学校/);
  assert.match(html, /深圳/);
});

test("country fallback presents the lit national city network", () => {
  const html = renderToStaticMarkup(createElement(CityDirectoryFallback, {
    cities,
    activeCity: "广州",
    level: "country",
    onSelectCity: () => undefined,
    onBackToProvince: () => undefined,
    onSelectSchool: () => undefined,
  }));

  assert.match(html, /全国城市网络/);
  assert.match(html, /全国共建概览/);
  assert.match(html, /广州/);
  assert.match(html, /深圳/);
});

test("city fallback keeps a Guangdong back control and presents full school names", () => {
  const html = renderToStaticMarkup(createElement(CityDirectoryFallback, {
    cities,
    activeCity: "广州",
    level: "city",
    selectedId: "sysu",
    onSelectCity: () => undefined,
    onBackToProvince: () => undefined,
    onSelectSchool: () => undefined,
  }));

  assert.match(html, />广东</);
  assert.match(html, /广州学校网络/);
  assert.match(html, /中山大学/);
  assert.match(html, /华南理工大学/);
  assert.match(html, /aria-pressed="true"/);
});

test("an explicitly selected city remains navigable when filtering leaves it empty", () => {
  const html = renderToStaticMarkup(createElement(CityDirectoryFallback, {
    cities,
    activeCity: "珠海",
    level: "city",
    onSelectCity: () => undefined,
    onBackToProvince: () => undefined,
    onSelectSchool: () => undefined,
  }));

  assert.match(html, /珠海学校网络/);
  assert.match(html, />广东</);
  assert.match(html, /当前筛选下暂无学校/);
});
