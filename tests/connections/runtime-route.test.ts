import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { createRuntimeConnectionRouteAdapter } from "../../features/connections/runtime-route";

const request = (url: string, init: RequestInit = {}) => new Request(`https://demo.local${url}`, init);
const pending = { id: "connection-1", senderId: "demo-member", recipientId: "demo-peer", topic: "AI", message: "我想聊聊校园 AI 共建的实践与想法。", status: "pending" as const, createdAt: 1, updatedAt: 1 };

function adapter(overrides: Partial<Parameters<typeof createRuntimeConnectionRouteAdapter>[0]> = {}) {
  const calls: string[] = [];
  return {
    calls,
    route: createRuntimeConnectionRouteAdapter({
      requireActiveSession: async () => ({ identity: { id: "demo-member", role: "member" } }),
      createRuntimeService: async () => ({
        createRequest: async () => { calls.push("create"); return pending; },
        listInbox: async () => { calls.push("list"); return { items: [pending], nextCursor: undefined }; },
        resolveRequest: async () => { calls.push("resolve"); return pending; },
      }),
      resolveRecipientId: async () => "demo-peer",
      createLiveContactService: () => ({ getVisibleContactCard: async () => undefined }),
      now: () => 1,
      ...overrides,
    }),
  };
}

test("runtime adapter composes create, list, and resolve through the actual route delegate", async () => {
  const store = adapter();
  assert.equal((await store.route.POST(request("/api/connections", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ recipientId: "peer", topic: "AI", message: pending.message }) }))).status, 201);
  assert.equal((await store.route.GET(request("/api/connections?box=sent"))).status, 200);
  assert.equal((await store.route.PATCH(request("/api/connections/connection-1", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "withdraw" }) }))).status, 200);
  assert.deepEqual(store.calls, ["create", "list", "resolve"]);
});

test("runtime adapter preserves forbidden cross-user resolution from the composed service", async () => {
  const store = adapter({ createRuntimeService: async () => ({ createRequest: async () => pending, listInbox: async () => ({ items: [], nextCursor: undefined }), resolveRequest: async () => { const { ConnectionServiceError } = await import("../../features/connections/service"); throw new ConnectionServiceError("forbidden"); } }) });
  const response = await store.route.PATCH(request("/api/connections/connection-1", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "accept" }) }));
  assert.equal(response.status, 403);
});

test("actual Next route exports defer the production factory instead of importing D1 bindings at module scope", () => {
  for (const path of [join(process.cwd(), "app/api/connections/route.ts"), join(process.cwd(), "app/api/connections/[id]/route.ts")]) {
    const source = readFileSync(path, "utf8");
    assert.match(source, /createDefaultRuntimeConnectionRouteAdapter/);
    assert.match(source, /await import\(/);
    assert.doesNotMatch(source, /from .*\.\.\/\.\.\/\.\.\/db/);
  }
});
