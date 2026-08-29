import assert from "node:assert/strict";
import test from "node:test";

async function renderHomePage() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request("http://localhost/", { headers: { accept: "text/html" } }),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

test("home page contains the approved brand and primary action", async () => {
  const response = await renderHomePage();
  assert.equal(response.status, 200);
  const html = await response.text();

  assert.match(html, /广州AI共创社/);
  assert.match(html, /让广东每一所高校/);
  assert.match(html, /申请点亮我的头像/);
  assert.doesNotMatch(html, /codex-preview/);
});
