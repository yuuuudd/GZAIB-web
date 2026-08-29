import assert from "node:assert/strict";
import test from "node:test";
import { createContactCardService, type ContactCardRepository } from "../../features/connections/contact-card";
import { createConnectionRouteHandlers } from "../../features/connections/route-handlers";
import { createConnectionService, ConnectionServiceError } from "../../features/connections/service";
import type { ConnectionRepository, ConnectionRequest } from "../../features/connections/types";
import { createActiveAccountBoundary } from "../../features/identity/active-account";
import { createSafetyService, SafetyServiceError, type SafetyRepository } from "../../features/safety/service";

const now = 1_700_000_000_000;
const key = Buffer.alloc(32, 13).toString("base64");
const message = "我想交流校园 AI 共创活动的组织经验和实践想法。";

type Actor = "visitor" | "pending" | "active" | "connection_suspended" | "hidden" | "suspended" | "admin" | "blocked";
type Expected = { create: number; inbox: number; accept: number; contact: number; report: number; admin: number };

const cases: Array<{ actor: Actor; expected: Expected }> = [
  { actor: "visitor", expected: { create: 401, inbox: 401, accept: 401, contact: 401, report: 401, admin: 403 } },
  { actor: "pending", expected: { create: 403, inbox: 200, accept: 404, contact: 403, report: 201, admin: 403 } },
  { actor: "active", expected: { create: 201, inbox: 200, accept: 200, contact: 200, report: 201, admin: 403 } },
  { actor: "connection_suspended", expected: { create: 403, inbox: 200, accept: 200, contact: 403, report: 201, admin: 403 } },
  { actor: "hidden", expected: { create: 403, inbox: 200, accept: 404, contact: 403, report: 201, admin: 403 } },
  { actor: "suspended", expected: { create: 401, inbox: 401, accept: 401, contact: 401, report: 401, admin: 403 } },
  { actor: "admin", expected: { create: 403, inbox: 200, accept: 404, contact: 403, report: 201, admin: 200 } },
  { actor: "blocked", expected: { create: 403, inbox: 200, accept: 404, contact: 403, report: 201, admin: 403 } },
];

function accountStatus(actor: Actor) {
  if (actor === "suspended") return "suspended";
  if (actor === "hidden") return "hidden";
  if (actor === "connection_suspended") return "connection_suspended";
  return "active";
}

function request(path: string, body?: unknown) {
  return new Request(`https://demo.local${path}`, {
    method: body === undefined ? "GET" : "POST",
    headers: body === undefined ? undefined : { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

function fixture(actor: Actor) {
  const actorId = actor === "admin" ? "demo-admin" : actor;
  const status = new Map<string, string>([[actorId, accountStatus(actor)], ["recipient", "active"], ["sender", "active"]]);
  const approved = new Set(["active", "connection_suspended", "blocked", "recipient", "sender"]);
  const published = new Set(["active", "connection_suspended", "blocked", "recipient", "sender"]);
  const blocked = actor === "blocked";
  const requests: ConnectionRequest[] = [];
  const notifications: unknown[] = [];
  let cardPayload: string | undefined;
  let reportOpen = true;

  const connectionRepository: ConnectionRepository = {
    getCreateContext: async (senderId, recipientId, input) => ({
      senderId, recipientId, senderStatus: status.get(senderId) ?? "missing",
      senderApproved: approved.has(senderId), senderPublished: published.has(senderId),
      recipientPublished: published.has(recipientId), blockedEitherDirection: blocked,
      pendingEitherDirection: requests.some((item) => item.status === "pending" && ((item.senderId === senderId && item.recipientId === recipientId) || (item.senderId === recipientId && item.recipientId === senderId))),
      requestsInLast24Hours: 0, topic: input.topic, message: input.message,
    }),
    createRequestAtomic: async (input) => { requests.push(input.request); notifications.push(...input.notifications); return { created: true }; },
    getRequest: async (id) => requests.find((item) => item.id === id),
    resolveRequestAtomic: async (input) => {
      const current = requests.find((item) => item.id === input.requestId);
      if (!current || current.status !== "pending") return undefined;
      const permitted = input.action === "withdraw" ? current.senderId === input.actorId : current.recipientId === input.actorId;
      if (!permitted) return undefined;
      current.status = input.action === "accept" ? "accepted" : input.action === "decline" ? "declined" : "withdrawn";
      current.resolvedAt = input.now; current.updatedAt = input.now; notifications.push(...input.notifications);
      return { ...current };
    },
    listRequests: async () => ({ items: requests, nextCursor: undefined }),
    hasAcceptedRelationship: async (left, right) => requests.some((item) => item.status === "accepted" && ((item.senderId === left && item.recipientId === right) || (item.senderId === right && item.recipientId === left))),
    getNotificationTarget: async (userId) => status.has(userId) ? { userId, displayName: userId } : undefined,
    updateNotificationDelivery: async () => undefined,
  };
  const service = createConnectionService(connectionRepository, () => "created-request", { createNotificationId: () => "notification" });
  const contacts = createContactCardService({
    save: async (_owner, payload) => { cardPayload = payload; },
    get: async () => cardPayload ? { encryptedPayload: cardPayload, updatedAt: now } : undefined,
    getAccess: async (viewerId, ownerId) => ({
      accepted: requests.some((item) => item.status === "accepted" && ((item.senderId === viewerId && item.recipientId === ownerId) || (item.senderId === ownerId && item.recipientId === viewerId))),
      blocked, viewerCanAccessContacts: status.get(viewerId) === "active" && approved.has(viewerId) && published.has(viewerId),
      ownerCanAccessContacts: status.get(ownerId) === "active" && approved.has(ownerId) && published.has(ownerId),
    }),
  } satisfies ContactCardRepository, key);
  const safety = createSafetyService({
    blockPairAtomic: async () => ({ created: true }), unblock: async () => undefined, listBlocks: async () => [],
    resolvePublicMemberId: async () => "recipient", targetExists: async () => true, requestBelongsToPair: async () => true,
    createReport: async (input) => ({ ...input, status: "open" }), getReportForReporter: async () => undefined,
    getReportForAdmin: async () => undefined, listReportsForAdmin: async () => [],
    resolveReportAtomic: async (input) => {
      if (!reportOpen) return undefined;
      reportOpen = false;
      return { id: input.reportId, reporterId: "reporter", targetUserId: "recipient", category: "spam", description: "这是足够长的举报说明，用于验证生产服务边界。", status: "resolved", resolution: input.resolution };
    },
  } satisfies SafetyRepository, () => "report-1");
  const session = createActiveAccountBoundary({
    requireSignedSession: async () => {
      if (actor === "visitor") throw new Error("anonymous");
      return { identity: { id: actorId, role: actor === "admin" ? "admin" : "member", displayName: actor }, expiresAt: now + 1 };
    },
    getAccountStatus: async () => status.get(actorId),
  });
  const route = createConnectionRouteHandlers({
    requireActiveSession: session, createService: () => service,
    resolveRecipientId: async (slug) => slug === "recipient" ? "recipient" : undefined,
    getVisibleContactCard: (viewerId, ownerId) => contacts.getVisibleContactCard(viewerId, ownerId), now: () => now,
  });
  return { actorId, requests, route, contacts, safety, service, session };
}

async function statusOf(operation: () => Promise<Response>) { return (await operation()).status; }

test("permission matrix calls production route and service boundaries, including recipient acceptance", async () => {
  for (const item of cases) {
    const store = fixture(item.actor);
    const create = await statusOf(() => store.route.POST(request("/api/connections", { recipientId: "recipient", topic: "校园 AI 共创", message })));
    const inbox = await statusOf(() => store.route.GET(request("/api/connections?box=received")));

    if (item.actor === "active" || item.actor === "connection_suspended") {
      store.requests.push({ id: "incoming", senderId: "sender", recipientId: store.actorId, topic: "校园 AI 共创", message, status: "pending", createdAt: now, updatedAt: now });
    }
    const accept = await statusOf(() => store.route.PATCH(new Request("https://demo.local/api/connections/incoming", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "accept" }) })));

    await store.contacts.saveOwnCard("recipient", { wechat: "recipient-card" }, now);
    if (item.actor === "active") store.requests.push({ id: "accepted", senderId: store.actorId, recipientId: "recipient", topic: "校园 AI 共创", message, status: "accepted", createdAt: now, updatedAt: now });
    const contact = await store.session(request("/me/connections")).then(async () => await store.contacts.getVisibleContactCard(store.actorId, "recipient") ? 200 : 403).catch(() => 401);

    const report = await store.session(request("/api/reports")).then(async () => {
      await store.safety.submitReport(store.actorId, { targetUserId: "recipient", category: "spam", description: "这是足够长的举报说明，用于验证生产服务边界。" }, now);
      return 201;
    }).catch(() => 401);
    const admin = await store.safety.resolveReport(item.actor === "admin" ? "demo-admin" : store.actorId, "report-1", "warn", now)
      .then(() => 200).catch((error: unknown) => error instanceof SafetyServiceError ? 403 : 500);

    assert.deepEqual({ create, inbox, accept, contact, report, admin }, item.expected, item.actor);
  }
});

test("connection suspension keeps recipient acceptance but returns sender_ineligible for new requests", async () => {
  const store = fixture("connection_suspended");
  await assert.rejects(
    () => store.service.createRequest("connection_suspended", { recipientId: "recipient", topic: "校园 AI 共创", message }, now),
    (error: unknown) => error instanceof ConnectionServiceError && error.code === "sender_ineligible",
  );
});

test("recipient decline is resolved through the production PATCH boundary", async () => {
  const store = fixture("active");
  store.requests.push({ id: "incoming-decline", senderId: "sender", recipientId: store.actorId, topic: "校园 AI 共创", message, status: "pending", createdAt: now, updatedAt: now });

  const response = await store.route.PATCH(new Request("https://demo.local/api/connections/incoming-decline", {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ action: "decline" }),
  }));

  assert.equal(response.status, 200);
  assert.equal(store.requests.find((item) => item.id === "incoming-decline")?.status, "declined");
});
