import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const source = readFileSync(join(process.cwd(), "components", "map", "AmapLoader.tsx"), "utf8");
const mapSource = readFileSync(join(process.cwd(), "components", "map", "BuilderMap.tsx"), "utf8");

test("AMap loader can discard one failed script request and retry it", () => {
  assert.match(source, /function resetAmapLoad\(\)/);
  assert.match(source, /const retry = \(\) =>/);
  assert.match(mapSource, /onClick=\{retry\}/);
});
