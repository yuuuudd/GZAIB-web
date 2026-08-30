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

test("returns 404 for an unknown path even when the proxy is unconfigured", async () => {
  const response = await handleAmapRequest(
    new Request("https://site.test/api/amap/not-supported"),
    ["not-supported"],
    { securityCode: "", fetchImpl: fetch },
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

test("strips the local _AMapService prefix before forwarding to the fixed official host", async () => {
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
  assert.equal(upstream?.pathname, "/");
  assert.equal(upstream?.searchParams.get("jscode"), "server-secret");
  assert.equal(upstream?.searchParams.get("platform"), "JS");
});

test("rejects a declared AMap body over the hard ceiling before contacting upstream", async () => {
  let contacted = false;
  const response = await handleAmapRequest(
    new Request("https://site.test/api/amap/_AMapService", {
      method: "POST",
      headers: { "content-length": String(64 * 1024 + 1), "content-type": "application/x-www-form-urlencoded" },
      body: "x",
    }),
    ["_AMapService"],
    { securityCode: "secret", fetchImpl: async () => { contacted = true; return new Response(); } },
  );
  assert.equal(response.status, 413);
  assert.equal(contacted, false);
});

test("rejects a chunked AMap body over the hard ceiling before contacting upstream", async () => {
  let contacted = false;
  const stream = new ReadableStream({
    start(controller) { controller.enqueue(new Uint8Array(64 * 1024)); controller.enqueue(new Uint8Array([1])); controller.close(); },
  });
  const response = await handleAmapRequest(
    new Request("https://site.test/api/amap/_AMapService", { method: "POST", body: stream, duplex: "half" as never }),
    ["_AMapService"],
    { securityCode: "secret", fetchImpl: async () => { contacted = true; return new Response(); } },
  );
  assert.equal(response.status, 413);
  assert.equal(contacted, false);
});
