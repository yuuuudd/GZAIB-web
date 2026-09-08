import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import test from "node:test";
import type { MapCitySummary, MapProvinceSummary } from "../../features/map/semantic-map";
import { CityDirectoryFallback } from "../../components/map/CityDirectoryFallback";

const cities: MapCitySummary[] = [
  {
    province: "广东",
    city: "广州",
    memberCount: 12,
    schoolCount: 2,
    center: { lng: 113.2644, lat: 23.1291 },
    schools: [
      { id: "sysu", name: "中山大学", campus: "广州校区南校园", province: "广东", city: "广州", lng: 113.298, lat: 23.096, memberCount: 7, previewMembers: [] },
      { id: "scut", name: "华南理工大学", campus: "五山校区", province: "广东", city: "广州", lng: 113.344, lat: 23.157, memberCount: 5, previewMembers: [] },
    ],
  },
  {
    province: "广东",
    city: "深圳",
    memberCount: 4,
    schoolCount: 1,
    center: { lng: 114.0579, lat: 22.5431 },
    schools: [],
  },
];

const wuhanSchool = { id: "whu", name: "武汉大学", campus: "主校区", province: "湖北", city: "武汉", lng: 114.365, lat: 30.536, memberCount: 2, previewMembers: [] };
const provinces: MapProvinceSummary[] = [
  { province: "广东", memberCount: 16, schoolCount: 3, cityCount: 2, center: { lng: 113.46, lat: 23 }, cities },
  { province: "湖北", memberCount: 2, schoolCount: 1, cityCount: 1, center: { lng: 114.365, lat: 30.536 }, cities: [{ province: "湖北", city: "武汉", memberCount: 2, schoolCount: 1, center: { lng: 114.365, lat: 30.536 }, schools: [wuhanSchool] }] },
];

test("province fallback presents city totals as drill-down controls", () => {
  const html = renderToStaticMarkup(createElement(CityDirectoryFallback, {
    provinces,
    activeProvince: "广东",
    activeCity: "广州",
    level: "province",
    onSelectCity: () => undefined,
    onSelectProvince: () => undefined,
    onBackToProvince: () => undefined,
    onSelectSchool: () => undefined,
  }));

  assert.match(html, /广东共建概览/);
  assert.match(html, /广州/);
  assert.match(html, /12 位共建者/);
  assert.match(html, /2 所学校/);
  assert.match(html, /深圳/);
});

test("country fallback presents every populated province", () => {
  const html = renderToStaticMarkup(createElement(CityDirectoryFallback, {
    provinces,
    activeProvince: "广东",
    activeCity: "广州",
    level: "country",
    onSelectCity: () => undefined,
    onSelectProvince: () => undefined,
    onBackToProvince: () => undefined,
    onSelectSchool: () => undefined,
  }));

  assert.match(html, /全国省份网络/);
  assert.match(html, /全国共建概览/);
  assert.match(html, /广东/);
  assert.match(html, /湖北/);
  assert.match(html, /16 位共建者 · 3 所学校 · 2 座城市/);
  assert.doesNotMatch(html, />广州<|>深圳</);
});

test("city fallback keeps a Guangdong back control and presents full school names", () => {
  const html = renderToStaticMarkup(createElement(CityDirectoryFallback, {
    provinces,
    activeProvince: "广东",
    activeCity: "广州",
    level: "city",
    selectedId: "sysu",
    onSelectCity: () => undefined,
    onSelectProvince: () => undefined,
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
    provinces,
    activeProvince: "广东",
    activeCity: "珠海",
    level: "city",
    onSelectCity: () => undefined,
    onSelectProvince: () => undefined,
    onBackToProvince: () => undefined,
    onSelectSchool: () => undefined,
  }));

  assert.match(html, /珠海学校网络/);
  assert.match(html, />广东</);
  assert.match(html, /当前筛选下暂无学校/);
});

test("Hubei province fallback contains Wuhan University and no Guangdong city", () => {
  const provinceHtml = renderToStaticMarkup(createElement(CityDirectoryFallback, {
    provinces,
    activeProvince: "湖北",
    activeCity: "武汉",
    level: "province",
    onSelectProvince: () => undefined,
    onSelectCity: () => undefined,
    onBackToProvince: () => undefined,
    onSelectSchool: () => undefined,
  }));

  const cityHtml = renderToStaticMarkup(createElement(CityDirectoryFallback, {
    provinces,
    activeProvince: "湖北",
    activeCity: "武汉",
    level: "city",
    onSelectProvince: () => undefined,
    onSelectCity: () => undefined,
    onBackToProvince: () => undefined,
    onSelectSchool: () => undefined,
  }));

  assert.match(provinceHtml, /湖北共建概览/);
  assert.match(provinceHtml, /武汉/);
  assert.doesNotMatch(provinceHtml, />广州<|>深圳</);
  assert.match(cityHtml, /武汉大学/);
  assert.doesNotMatch(cityHtml, /中山大学|华南理工大学/);
});
