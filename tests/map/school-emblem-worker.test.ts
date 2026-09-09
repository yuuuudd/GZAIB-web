import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { Miniflare, createFetchMock } from "miniflare";
import ts from "typescript";

test("automatic emblem lookup works inside the production Worker runtime", async () => {
  const fetchMock = createFetchMock();
  fetchMock.disableNetConnect();
  fetchMock.get("https://static-data.gaokao.cn")
    .intercept({ path: "/www/2.0/school/name.json" })
    .reply(200, { data: [{ name: "广州大学", school_id: "293" }] });
  const source = readFileSync(new URL("../../app/api/school-emblem/route.ts", import.meta.url), "utf8");
  const runtime = new Miniflare({
    modules: true,
    compatibilityDate: "2026-05-22",
    script: ts.transpile(source, { target: ts.ScriptTarget.ESNext, module: ts.ModuleKind.ESNext }) + "\nexport default { fetch: GET };",
    fetchMock,
  });
  try {
    const response = await runtime.dispatchFetch(`https://gzaibuilders.cn/api/school-emblem?name=${encodeURIComponent("广州大学")}`, { redirect: "manual" });
    assert.equal(response.status, 302);
    assert.equal(response.headers.get("location"), "https://static-data.gaokao.cn/upload/logo/293.jpg");
    fetchMock.assertNoPendingInterceptors();
  } finally {
    await runtime.dispose();
    await fetchMock.close();
  }
});
