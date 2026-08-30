import assert from "node:assert/strict";
import test from "node:test";

test("loads the public AMap key at runtime when the static page has no key", async () => {
  const loader = await import("../../components/map/AmapLoader");
  const resolveAmapKey = (loader as Record<string, unknown>).resolveAmapKey;

  assert.equal(typeof resolveAmapKey, "function", "AmapLoader must resolve a missing build-time key at runtime");

  const key = await (resolveAmapKey as (
    staticKey: string | undefined,
    fetchImpl: typeof fetch,
  ) => Promise<string>)(undefined, async (input) => {
    assert.equal(input, "/api/amap/config");
    return Response.json({ key: "runtime-public-key" });
  });

  assert.equal(key, "runtime-public-key");
});
