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
  assert.match(mapSource, /retry\?\.\(\)/);
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
