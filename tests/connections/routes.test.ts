import assert from "node:assert/strict";
import test from "node:test";
import { ConnectionServiceError } from "../../features/connections/service";
import { createConnectionRouteHandlers } from "../../features/connections/route-handlers";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { ConnectButton } from "../../components/connections/ConnectButton";
import { ConnectionInbox } from "../../components/connections/ConnectionInbox";

const now = 1_700_000_000_000;
const request = (url: string, body?: unknown) => new Request(`https://demo.local${url}`, {
  method: body === undefined ? "GET" : "POST",
  headers: body === undefined ? undefined : { "content-type": "application/json" },
  body: body === undefined ? undefined : JSON.stringify(body),
});

function deps(overrides: Partial<Parameters<typeof createConnectionRouteHandlers>[0]> = {}) {
  const calls: { senderId?: string; recipientId?: string; action?: string } = {};
  return {
    calls,
    dependencies: {
      requireActiveSession: async () => ({ identity: { id: "demo-member", role: "member" } }),
      createService: () => ({
        createRequest: async (senderId: string, input: { recipientId: string }) => {
          calls.senderId = senderId;
          calls.recipientId = input.recipientId;
          return { id: "connection-1", senderId, recipientId: input.recipientId, topic: "AI", message: "我想聊聊校园 AI 共建的实践与想法。", status: "pending", createdAt: now, updatedAt: now };
        },
        resolveRequest: async (_actorId: string, _id: string, action: string) => {
          calls.action = action;
          return { id: "connection-1", senderId: "demo-member", recipientId: "demo-peer", topic: "AI", message: "我想聊聊校园 AI 共建的实践与想法。", status: action === "accept" ? "accepted" : "withdrawn", createdAt: now, updatedAt: now };
        },
        listInbox: async () => ({ items: [], nextCursor: undefined }),
      }),
      resolveRecipientId: async (slug: string) => slug === "peer" ? "demo-peer" : undefined,
      getVisibleContactCard: async () => undefined,
      now: () => now,
      ...overrides,
    },
  };
}

test("connection routes require an active session and keep all responses private", async () => {
  const route = createConnectionRouteHandlers(deps({ requireActiveSession: async () => { throw new Error("anonymous"); } }).dependencies);
  const response = await route.POST(request("/api/connections", { recipientId: "peer", topic: "AI", message: "我想聊聊校园 AI 共建的实践与想法。" }));
  assert.equal(response.status, 401);
  assert.equal(response.headers.get("Cache-Control"), "private, no-store");
});

test("create ignores forged senderId and resolves the public recipient slug server-side", async () => {
  const store = deps();
  const route = createConnectionRouteHandlers(store.dependencies);
  const response = await route.POST(request("/api/connections", {
    recipientId: "peer", senderId: "demo-admin", topic: "AI", message: "我想聊聊校园 AI 共建的实践与想法。",
  }));
  assert.equal(response.status, 201);
  assert.equal(store.calls.senderId, "demo-member");
  assert.equal(store.calls.recipientId, "demo-peer");
});

test("production-style asynchronous service factories are awaited before a connection action", async () => {
  const store = deps();
  const route = createConnectionRouteHandlers({ ...store.dependencies, createService: async () => store.dependencies.createService() } as never);
  const response = await route.POST(request("/api/connections", { recipientId: "peer", topic: "AI", message: "我想聊聊校园 AI 共建的实践与想法。" }));
  assert.equal(response.status, 201);
});

test("create makes unavailable recipients indistinguishable and maps service policy errors", async () => {
  const unavailable = deps();
  const unavailableRoute = createConnectionRouteHandlers(unavailable.dependencies);
  const missing = await unavailableRoute.POST(request("/api/connections", { recipientId: "hidden", topic: "AI", message: "我想聊聊校园 AI 共建的实践与想法。" }));
  assert.equal(missing.status, 404);
  assert.doesNotMatch(await missing.text(), /hidden|exist/i);

  for (const [code, expected] of [["sender_ineligible", 403], ["duplicate_pending", 409], ["daily_limit", 429]] as const) {
    const route = createConnectionRouteHandlers(deps({ createService: () => ({ createRequest: async () => { throw new ConnectionServiceError(code); }, resolveRequest: async () => { throw new Error("unused"); }, listInbox: async () => ({ items: [], nextCursor: undefined }) }) }).dependencies);
    const response = await route.POST(request("/api/connections", { recipientId: "peer", topic: "AI", message: "我想聊聊校园 AI 共建的实践与想法。" }));
    assert.equal(response.status, expected);
  }
});

test("list accepts only a validated box and cursor and never returns an unauthorized contact card", async () => {
  const route = createConnectionRouteHandlers(deps().dependencies);
  assert.equal((await route.GET(request("/api/connections?box=other"))).status, 400);
  assert.equal((await route.GET(request("/api/connections?box=received&cursor=not-a-cursor"))).status, 400);
  const response = await route.GET(request("/api/connections?box=accepted"));
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("Cache-Control"), "private, no-store");
});

test("inbox items include the public counterpart card needed by new friends and the friend list", async () => {
  const pending = { id: "connection-1", senderId: "demo-member", recipientId: "demo-peer", topic: "AI", message: "我想聊聊校园 AI 共建的实践与想法。", status: "pending" as const, createdAt: now, updatedAt: now };
  const route = createConnectionRouteHandlers({
    ...deps({ createService: () => ({ createRequest: async () => pending, resolveRequest: async () => pending, listInbox: async () => ({ items: [pending], nextCursor: undefined }) }) }).dependencies,
    resolvePublicMember: async () => ({ slug: "peer", nickname: "共建者 B", school: "中山大学", city: "广州", intro: "正在做校园 AI 项目", skills: ["AI应用"] }),
  } as never);
  const body = await (await route.GET(request("/api/connections?box=sent"))).json() as { items: Array<{ counterpart?: { nickname: string; slug: string } }> };
  assert.deepEqual(body.items[0]?.counterpart, { slug: "peer", nickname: "共建者 B", school: "中山大学", city: "广州", intro: "正在做校园 AI 项目", skills: ["AI应用"] });
});

test("recipient accepts, sender withdraws, and cross-user resolutions remain forbidden", async () => {
  const accepted = deps();
  const acceptRoute = createConnectionRouteHandlers(accepted.dependencies);
  const acceptedResponse = await acceptRoute.PATCH(new Request("https://demo.local/api/connections/connection-1", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "accept" }) }));
  assert.equal(acceptedResponse.status, 200);
  assert.equal(accepted.calls.action, "accept");

  const withdrawn = deps({ requireActiveSession: async () => ({ identity: { id: "demo-member", role: "member" } }) });
  const withdrawRoute = createConnectionRouteHandlers(withdrawn.dependencies);
  const withdrawResponse = await withdrawRoute.PATCH(new Request("https://demo.local/api/connections/connection-1", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "withdraw" }) }));
  assert.equal(withdrawResponse.status, 200);
  assert.equal(withdrawn.calls.action, "withdraw");

  const forbiddenRoute = createConnectionRouteHandlers(deps({ createService: () => ({ createRequest: async () => { throw new Error("unused"); }, listInbox: async () => ({ items: [], nextCursor: undefined }), resolveRequest: async () => { throw new ConnectionServiceError("forbidden"); } }) }).dependencies);
  const forbidden = await forbiddenRoute.PATCH(new Request("https://demo.local/api/connections/connection-1", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "accept" }) }));
  assert.equal(forbidden.status, 403);
});

test("resolution matrix enforces decline actors, conflict codes, and live contact reads only after acceptance", async () => {
  const acceptedRequest = { id: "connection-1", senderId: "demo-member", recipientId: "demo-peer", topic: "AI", message: "我想聊聊校园 AI 共建的实践与想法。", status: "accepted" as const, createdAt: now, updatedAt: now };
  const live = deps({
    requireActiveSession: async () => ({ identity: { id: "demo-peer", role: "member" } }),
    createService: () => ({
      createRequest: async () => { throw new Error("unused"); },
      resolveRequest: async () => acceptedRequest,
      listInbox: async () => ({ items: [acceptedRequest], nextCursor: undefined }),
    }),
    getVisibleContactCard: async (viewerId, ownerId) => viewerId === "demo-peer" && ownerId === "demo-member" ? { wechat: "live-current-card" } : undefined,
  });
  const route = createConnectionRouteHandlers(live.dependencies);
  const declined = await route.PATCH(new Request("https://demo.local/api/connections/connection-1", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "decline" }) }));
  assert.equal(declined.status, 200);
  assert.match(await declined.text(), /live-current-card/);
  const listed = await route.GET(request("/api/connections?box=accepted"));
  assert.match(await listed.text(), /live-current-card/);
  const denied = createConnectionRouteHandlers(deps({
    createService: () => ({ createRequest: async () => { throw new Error("unused"); }, resolveRequest: async () => acceptedRequest, listInbox: async () => ({ items: [acceptedRequest], nextCursor: undefined }) }),
    getVisibleContactCard: async () => undefined,
  }).dependencies);
  const deniedList = await denied.GET(request("/api/connections?box=accepted"));
  assert.doesNotMatch(await deniedList.text(), /live-current-card|wechat|email/i);

  for (const [code, expected] of [["blocked", 403], ["state_conflict", 409]] as const) {
    const failing = createConnectionRouteHandlers(deps({
      createService: () => ({ createRequest: async () => { throw new Error("unused"); }, listInbox: async () => ({ items: [], nextCursor: undefined }), resolveRequest: async () => { throw new ConnectionServiceError(code); } }),
    }).dependencies);
    const response = await failing.PATCH(new Request("https://demo.local/api/connections/connection-1", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "decline" }) }));
    assert.equal(response.status, expected);
  }
});

test("connection CTA and inbox keep contact plaintext out of unauthorized server rendering", () => {
  const visitor = renderToStaticMarkup(createElement(ConnectButton, { state: "visitor", recipientSlug: "peer", recipientName: "共建者 B", dailyRemaining: 5 }));
  const eligible = renderToStaticMarkup(createElement(ConnectButton, { state: "eligible", recipientSlug: "peer", recipientName: "共建者 B", dailyRemaining: 3 }));
  const blocked = renderToStaticMarkup(createElement(ConnectButton, { state: "unavailable", recipientSlug: "peer", recipientName: "共建者 B", dailyRemaining: 0 }));
  const inbox = renderToStaticMarkup(createElement(ConnectionInbox));
  assert.match(visitor, /审核成员可发起连接/);
  assert.match(visitor, /href="\/apply"/);
  assert.match(eligible, /想认识 TA/);
  assert.equal(blocked, "");
  assert.match(inbox, /新的朋友/);
  assert.match(inbox, /好友列表/);
  assert.doesNotMatch(inbox, /微信号|@example\.com|联系方式：/);
});
