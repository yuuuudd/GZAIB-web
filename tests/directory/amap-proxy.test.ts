import assert from "node:assert/strict";
import test from "node:test";
import { handleAmapRequest } from "../../app/api/amap/[...path]/route";

test("refuses client-supplied destinations and unknown proxy paths", async () => {
  const response = await handleAmapRequest(
    new Request("https://site.test/api/amap/https://evil.example"),
    ["https:", "evil.example"],
    { securityCode: "secret", fetchImpl: fetch },
  );
  assert.equal(response.status, 404);
});

test("refuses unsupported methods before contacting upstream", async () => {
  let contacted = false;
  const response = await handleAmapRequest(
    new Request("https://site.test/api/amap/_AMapService", { method: "DELETE" }),
    ["_AMapService"],
    { securityCode: "secret", fetchImpl: async () => { contacted = true; return new Response(); } },
  );
  assert.equal(response.status, 405);
  assert.equal(contacted, false);
});

test("maps the security service to the fixed official host and appends only server security code", async () => {
  let upstream: URL | undefined;
  const response = await handleAmapRequest(
    new Request("https://site.test/api/amap/_AMapService?platform=JS&logversion=2", { method: "GET" }),
    ["_AMapService"],
    {
      securityCode: "server-secret",
      fetchImpl: async (input) => {
        upstream = new URL(typeof input === "string" ? input : input instanceof URL ? input : input.url);
        return new Response("ok", { status: 200, headers: { "content-type": "text/plain" } });
      },
    },
  );
  assert.equal(response.status, 200);
  assert.equal(upstream?.origin, "https://restapi.amap.com");
  assert.equal(upstream?.pathname, "/_AMapService");
  assert.equal(upstream?.searchParams.get("jscode"), "server-secret");
  assert.equal(upstream?.searchParams.get("platform"), "JS");
});
