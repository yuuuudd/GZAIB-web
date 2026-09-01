import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import test from "node:test";
import { SemanticMapCanvas } from "../../components/map/SemanticMapCanvas";
import type { AmapNamespace, AmapOverlay } from "../../components/map/AmapLoader";
import type { MapCitySummary } from "../../features/map/semantic-map";

const school = { id: "sysu", name: "中山大学", campus: "南校园", city: "广州", lng: 113.298, lat: 23.096, memberCount: 3, previewMembers: [] };
const cities: MapCitySummary[] = [{ city: "广州", memberCount: 3, schoolCount: 1, center: { lng: 113.298, lat: 23.096 }, schools: [school] }];

async function renderMap(level: "province" | "city") {
  const dom = new JSDOM("<!doctype html><html><body><div id=\"root\"></div></body></html>");
  Object.assign(globalThis, { window: dom.window, document: dom.window.document, HTMLElement: dom.window.HTMLElement, IS_REACT_ACT_ENVIRONMENT: true });
  const added: AmapOverlay[][] = [];
  class Map { add(overlays: AmapOverlay[]) { added.push(overlays); } remove() {} destroy() {} getZoom() { return level === "province" ? 7 : 10; } setZoomAndCenter() {} on() {} off() {} setFitView() {} }
  class Marker { constructor(readonly options: Record<string, unknown>) {} on() {} setMap() {} }
  class Circle { constructor(readonly options: Record<string, unknown>) {} setMap() {} }
  class Polyline { constructor(readonly options: Record<string, unknown>) {} setMap() {} }
  class Polygon { constructor(readonly options: Record<string, unknown>) {} setMap() {} }
  class DistrictSearch { search() {} }
  const amap = { Map, Marker, Circle, Polyline, Polygon, DistrictSearch } as unknown as AmapNamespace;
  const root = createRoot(dom.window.document.querySelector("#root")!);
  await act(async () => { root.render(createElement(SemanticMapCanvas, { amap, cities, level, activeCity: "广州", onLevelChange: () => undefined, onSelectCity: () => undefined, onSelectSchool: () => undefined, onFailure: () => undefined })); });
  return { added, cleanup: async () => { await act(async () => root.unmount()); dom.window.close(); } };
}

test("province city pins render before any district boundary request completes", async () => {
  const mounted = await renderMap("province");
  try {
    assert.ok(mounted.added.flat().some((overlay) => overlay.constructor.name === "Marker"));
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
