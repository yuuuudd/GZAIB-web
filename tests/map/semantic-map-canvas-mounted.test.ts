import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import test from "node:test";
import { SemanticMapCanvas } from "../../components/map/SemanticMapCanvas";
import type { AmapNamespace, AmapOverlay } from "../../components/map/AmapLoader";
import { groupSchoolsByProvince, type MapCitySummary } from "../../features/map/semantic-map";

const school = { id: "sysu", name: "中山大学", campus: "南校园", province: "广东", city: "广州", lng: 113.298, lat: 23.096, memberCount: 3, previewMembers: [] };
const cities: MapCitySummary[] = [{ province: "广东", city: "广州", memberCount: 3, schoolCount: 1, center: { lng: 113.298, lat: 23.096 }, schools: [school] }];

async function renderMap(level: "country" | "province" | "city", mapCities = cities) {
  const dom = new JSDOM("<!doctype html><html><body><div id=\"root\"></div></body></html>");
  Object.assign(globalThis, { window: dom.window, document: dom.window.document, HTMLElement: dom.window.HTMLElement, IS_REACT_ACT_ENVIRONMENT: true });
  const added: AmapOverlay[][] = [];
  const districtQueries: string[] = [];
  const districtOptions: Record<string, unknown>[] = [];
  const selectedProvinces: string[] = [];
  const selectedCities: string[] = [];
  const selectedSchools: string[] = [];
  const views: Array<{ zoom: number; center: [number, number] }> = [];
  let mapInstances = 0;
  let mapOptions: Record<string, unknown> | undefined;
  class Map { constructor(_container: HTMLElement, options: Record<string, unknown>) { mapInstances += 1; mapOptions = options; } add(overlays: AmapOverlay[]) { added.push(overlays); } remove() {} destroy() {} getZoom() { return level === "country" ? 4 : level === "province" ? 7 : 10; } setZoomAndCenter(zoom: number, center: [number, number]) { views.push({ zoom, center }); } on() {} off() {} setFitView() {} }
  class Marker { click?: () => void; constructor(readonly options: Record<string, unknown>) {} on(_event: "click", handler: () => void) { this.click = handler; } setMap() {} }
  class Circle { constructor(readonly options: Record<string, unknown>) {} setMap() {} }
  class Polyline { constructor(readonly options: Record<string, unknown>) {} setMap() {} }
  class Polygon { constructor(readonly options: Record<string, unknown>) {} setMap() {} }
  class DistrictSearch {
    constructor(options: Record<string, unknown>) { districtOptions.push(options); }
    search(keyword: string, callback: (status: string, result: { districtList?: Array<{ boundaries?: unknown[][] }> }) => void) {
      districtQueries.push(keyword);
      callback("complete", { districtList: [{ boundaries: [[[1, 2], [3, 4]]] }] });
    }
  }
  const amap = { Map, Marker, Circle, Polyline, Polygon, DistrictSearch } as unknown as AmapNamespace;
  const root = createRoot(dom.window.document.querySelector("#root")!);
  const onLevelChange = () => undefined;
  const onSelectCity = (city: string) => selectedCities.push(city);
  const onSelectSchool = (selectedSchool: typeof school) => selectedSchools.push(selectedSchool.id);
  const provinces = groupSchoolsByProvince(mapCities.flatMap((city) => city.schools));
  const rerender = async (selectedId?: string, onFailure = () => undefined) => {
    await act(async () => { root.render(createElement(SemanticMapCanvas, { amap, provinces, level, activeProvince: mapCities[0]?.province ?? "广东", activeCity: mapCities[0]?.city ?? "广州", selectedId, onLevelChange, onSelectProvince: (province: string) => selectedProvinces.push(province), onSelectCity, onSelectSchool, onFailure })); });
  };
  await rerender();
  return { added, districtQueries, districtOptions, selectedProvinces, selectedCities, selectedSchools, views, mapOptions, get mapInstances() { return mapInstances; }, rerender, cleanup: async () => { await act(async () => root.unmount()); dom.window.close(); } };
}

test("country view shows Guangdong and Hubei as separate province data", async () => {
  const wuhanSchool = { ...school, id: "whu", name: "武汉大学", province: "湖北", city: "武汉", lng: 114.365, lat: 30.536, memberCount: 2 };
  const mounted = await renderMap("country", [...cities, { province: "湖北", city: "武汉", memberCount: 2, schoolCount: 1, center: { lng: 114.365, lat: 30.536 }, schools: [wuhanSchool] }]);
  try {
    const markers = mounted.added.flat().filter((overlay) => overlay.constructor.name === "Marker") as Array<{ options: Record<string, unknown> }>;
    assert.equal(markers.length, 2);
    assert.ok(markers.some(({ options }) => String(options.content).includes("广东")));
    const hubei = markers.find(({ options }) => String(options.content).includes("湖北")) as { click?: () => void } | undefined;
    assert.ok(hubei);
    hubei.click?.();
    assert.deepEqual(mounted.selectedProvinces, ["湖北"]);
    assert.ok(!mounted.added.flat().some((overlay) => overlay.constructor.name === "Polyline"));
    assert.deepEqual(mounted.districtQueries, ["广东", "湖北"]);
    assert.deepEqual(mounted.districtOptions.map(({ level }) => level), ["province", "province"]);
    assert.ok(mounted.added.flat().filter((overlay) => overlay.constructor.name === "Polygon").length >= 2);
    assert.deepEqual(mounted.views.at(-1), { zoom: 4.3, center: [104.1954, 35.8617] });
  } finally { await mounted.cleanup(); }
});

test("province city pins render before any district boundary request completes", async () => {
  const mounted = await renderMap("province");
  try {
    assert.ok(mounted.added.flat().some((overlay) => overlay.constructor.name === "Marker"));
    assert.deepEqual(mounted.districtQueries, ["广州"]);
    assert.equal(mounted.districtOptions[0]?.level, "city");
  } finally { await mounted.cleanup(); }
});

test("province view lights every city with a school instead of only the stale active city", async () => {
  const chaozhouSchool = { ...school, id: "hanshan", name: "韩山师范学院", city: "潮州", lng: 116.63, lat: 23.68, memberCount: 1 };
  const mounted = await renderMap("province", [
    ...cities,
    { province: "广东", city: "潮州", memberCount: 1, schoolCount: 1, center: { lng: 116.63, lat: 23.68 }, schools: [chaozhouSchool] },
  ]);
  try {
    const markers = mounted.added.flat().filter((overlay) => overlay.constructor.name === "Marker") as Array<{ options: Record<string, unknown> }>;
    assert.equal(markers.length, 2);
    assert.ok(markers.every(({ options }) => String(options.content).includes("school-pin-orange-v1.png")));
  } finally { await mounted.cleanup(); }
});

test("each school pin receives a campus highlight without waiting for the city boundary", async () => {
  const mounted = await renderMap("city");
  try {
    const overlays = mounted.added.flat();
    assert.ok(overlays.some((overlay) => overlay.constructor.name === "Marker"));
    assert.ok(overlays.some((overlay) => overlay.constructor.name === "Circle"));
  } finally { await mounted.cleanup(); }
});

test("standard map leaves the page wheel scroll available", async () => {
  const mounted = await renderMap("city");
  try {
    assert.equal(mounted.mapOptions?.scrollWheel, false);
  } finally { await mounted.cleanup(); }
});

test("Hubei drills into Wuhan and clicking Wuhan University highlights it without rebuilding the map", async () => {
  const wuhanSchool = { ...school, id: "whu", name: "武汉大学", province: "湖北", city: "武汉", lng: 114.365, lat: 30.536, memberCount: 2 };
  const wuhanCities: MapCitySummary[] = [{ province: "湖北", city: "武汉", memberCount: 2, schoolCount: 1, center: { lng: 114.365, lat: 30.536 }, schools: [wuhanSchool] }];
  const province = await renderMap("province", wuhanCities);
  try {
    const marker = province.added.flat().find((overlay) => overlay.constructor.name === "Marker") as { click?: () => void; options?: Record<string, unknown> } | undefined;
    assert.match(String(marker?.options?.content), /武汉/);
    marker?.click?.();
    assert.deepEqual(province.selectedCities, ["武汉"]);
  } finally { await province.cleanup(); }

  const city = await renderMap("city", wuhanCities);
  try {
    const marker = city.added.flat().find((overlay) => overlay.constructor.name === "Marker") as { click?: () => void } | undefined;
    marker?.click?.();
    assert.deepEqual(city.selectedSchools, ["whu"]);
    await city.rerender("whu");
    const markers = city.added.flat().filter((overlay) => overlay.constructor.name === "Marker") as Array<{ options: Record<string, unknown> }>;
    assert.equal(city.mapInstances, 1);
    assert.match(String(markers.at(-1)?.options.content), /school-pin-orange-v1\.png/);
  } finally { await city.cleanup(); }
});

test("selecting a Shenzhen school keeps the map instance and highlights its pin", async () => {
  const shenzhenSchool = { ...school, id: "szu", name: "深圳大学", city: "深圳", lng: 113.93, lat: 22.53 };
  const mounted = await renderMap("city", [{ province: "广东", city: "深圳", memberCount: 3, schoolCount: 1, center: { lng: 113.93, lat: 22.53 }, schools: [shenzhenSchool] }]);
  try {
    const marker = mounted.added.flat().find((overlay) => overlay.constructor.name === "Marker") as { click?: () => void } | undefined;
    marker?.click?.();
    assert.deepEqual(mounted.selectedSchools, ["szu"]);
    await mounted.rerender("szu");
    const markers = mounted.added.flat().filter((overlay) => overlay.constructor.name === "Marker") as Array<{ options: Record<string, unknown> }>;
    assert.equal(mounted.mapInstances, 1);
    assert.match(String(markers.at(-1)?.options.content), /school-pin-orange-v1\.png/);
  } finally { await mounted.cleanup(); }
});
