import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { buildAmapScriptUrl } from "../components/map/AmapLoader";

const source = readFileSync(join(process.cwd(), "components", "map", "AmapLoader.tsx"), "utf8");
const mapSource = readFileSync(join(process.cwd(), "components", "map", "BuilderMap.tsx"), "utf8");

test("AMap loader can discard one failed script request and retry it", () => {
  assert.match(source, /function resetAmapLoad\(\)/);
  assert.match(source, /const retry = \(\) =>/);
});

test("public builder map exposes the national standard map without the illustrated switcher", () => {
  assert.doesNotMatch(mapSource, /彩绘版|筹备中/);
  assert.match(mapSource, /aria-pressed=\{level === "country"\}/);
});

test("AMap security proxy uses the mandatory _AMapService path", () => {
  assert.match(source, /serviceHost: "\/api\/amap\/_AMapService"/);
});

test("AMap script requests the administrative-boundary service needed by semantic layers", () => {
  const url = new URL(buildAmapScriptUrl("test key"));

  assert.equal(url.origin, "https://webapi.amap.com");
  assert.equal(url.searchParams.get("v"), "2.0");
  assert.equal(url.searchParams.get("key"), "test key");
  assert.deepEqual(url.searchParams.get("plugin")?.split(","), [
    "AMap.MarkerCluster",
    "AMap.PlaceSearch",
    "AMap.DistrictSearch",
  ]);
});

test("school search accepts AMap results from anywhere in China", async () => {
  const amapModule = await import("../components/map/AmapLoader");
  const options = (amapModule as Record<string, unknown>).NATIONWIDE_PLACE_SEARCH_OPTIONS;
  const parse = (amapModule as Record<string, unknown>).parseAmapLocation;

  assert.deepEqual(options, { extensions: "all" });
  assert.equal(typeof parse, "function");
  if (typeof parse !== "function") return;
  assert.equal(parse({ name: "韩山师范学院", adcode: 445102, adname: "湘桥区", location: { lng: 116.61, lat: 23.65 } }).city, "潮州");
  assert.equal(parse({ name: "北京大学", cityname: "北京市", adcode: "110108", location: { lng: 116.31, lat: 39.9928 } }).city, "北京市");
});
