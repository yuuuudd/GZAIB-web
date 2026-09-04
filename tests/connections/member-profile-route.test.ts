import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("map member profile API returns the server-derived connection CTA", async () => {
  const route = await readFile(new URL("../../app/api/members/[slug]/route.ts", import.meta.url), "utf8");
  assert.match(route, /resolveConnectionCtaState/);
  assert.match(route, /Response\.json\(\{ profile, connection \}/);
});
