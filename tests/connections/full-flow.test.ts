import assert from "node:assert/strict";
import test from "node:test";
import { createContactCardService, type ContactCardRepository } from "../../features/connections/contact-card";
import { ConnectionServiceError, createConnectionService } from "../../features/connections/service";
import type { ConnectionNotificationPersistence, ConnectionRepository, ConnectionRequest } from "../../features/connections/types";
import { createSafetyService, type SafetyRepository } from "../../features/safety/service";

const now = 1_700_000_000_000;
const key = Buffer.alloc(32, 12).toString("base64");

function fixture() {
  const statuses = new Map([["member-a", "active"], ["member-b", "active"]]);
  const cards = new Map<string, { encryptedPayload: string; updatedAt: number }>();
  const requests: ConnectionRequest[] = [];
  const notifications: ConnectionNotificationPersistence[] = [];
  const blocks = new Set<string>();
  const reports = new Map<string, { id: string; reporterId: string; targetUserId: string; category: "spam"; description: string; requestId?: string; status: "open" | "resolved" | "dismissed"; resolution?: string }>();
  const audits: Array<{ auditId: string; action: string; targetUserId: string }> = [];

  const pairKey = (left: string, right: string) => [left, right].sort().join(":");
  const currentPairRequest = (left: string, right: string) => requests.find((request) => pairKey(request.senderId, request.recipientId) === pairKey(left, right));
  const canContact = (userId: string) => statuses.get(userId) === "active";

  const connectionRepository: ConnectionRepository = {
    getCreateContext: async (senderId, recipientId, input) => ({
      senderId, recipientId, senderStatus: statuses.get(senderId) ?? "missing",
      senderApproved: senderId === "member-a", senderPublished: senderId === "member-a",
      recipientPublished: recipientId === "member-b" && ["active", "connection_suspended"].includes(statuses.get(recipientId) ?? "missing"),
      blockedEitherDirection: blocks.has(pairKey(senderId, recipientId)),
      pendingEitherDirection: currentPairRequest(senderId, recipientId)?.status === "pending",
      requestsInLast24Hours: requests.filter((request) => request.senderId === senderId && request.createdAt >= now - 86_400_000).length,
      topic: input.topic, message: input.message,
    }),
    createRequestAtomic: async (input) => {
      if (currentPairRequest(input.request.senderId, input.request.recipientId)?.status === "pending") return { created: false };
      requests.push(input.request);
      notifications.push(...input.notifications);
      return { created: true };
    },
    getRequest: async (requestId) => requests.find((request) => request.id === requestId),
    resolveRequestAtomic: async (input) => {
      const request = requests.find((entry) => entry.id === input.requestId);
      const expectedActor = input.action === "withdraw" ? request?.senderId : request?.recipientId;
      if (!request || request.status !== "pending" || expectedActor !== input.actorId) return undefined;
      request.status = input.action === "accept" ? "accepted" : input.action === "decline" ? "declined" : "withdrawn";
      request.resolvedAt = input.now;
      request.updatedAt = input.now;
      notifications.push(...input.notifications);
      return { ...request };
    },
    listRequests: async () => ({ items: requests, nextCursor: undefined }),
    hasAcceptedRelationship: async (left, right) => currentPairRequest(left, right)?.status === "accepted",
    getNotificationTarget: async (userId) => userId === "member-a"
      ? { userId, displayName: "共建者 A" } : userId === "member-b" ? { userId, displayName: "共建者 B" } : undefined,
    updateNotificationDelivery: async () => undefined,
  };

  const contactRepository: ContactCardRepository = {
    save: async (userId, encryptedPayload, updatedAt) => { cards.set(userId, { encryptedPayload, updatedAt }); },
    get: async (userId) => cards.get(userId),
    getAccess: async (viewerId, ownerId) => ({
      accepted: currentPairRequest(viewerId, ownerId)?.status === "accepted",
      blocked: blocks.has(pairKey(viewerId, ownerId)),
      viewerCanAccessContacts: canContact(viewerId), ownerCanAccessContacts: canContact(ownerId),
    }),
  };

  const safetyRepository: SafetyRepository = {
    blockPairAtomic: async ({ blockerId, blockedId }) => {
      blocks.add(pairKey(blockerId, blockedId));
      for (const request of requests) {
        if (pairKey(request.senderId, request.recipientId) === pairKey(blockerId, blockedId) && request.status === "pending") request.status = "cancelled_by_block";
      }
      return { created: true };
    },
    unblock: async (blockerId, blockedId) => { blocks.delete(pairKey(blockerId, blockedId)); },
    listBlocks: async () => [], resolvePublicMemberId: async () => "member-a",
    targetExists: async (userId) => ["active", "connection_suspended"].includes(statuses.get(userId) ?? "missing"),
    requestBelongsToPair: async (requestId, reporterId, targetUserId) => {
      const request = requests.find((entry) => entry.id === requestId);
      return Boolean(request && pairKey(request.senderId, request.recipientId) === pairKey(reporterId, targetUserId));
    },
    createReport: async (report) => {
      reports.set(report.id, { ...report, status: "open" });
      return reports.get(report.id)!;
    },
    getReportForReporter: async (id, reporterId) => reports.get(id)?.reporterId === reporterId ? reports.get(id) : undefined,
    getReportForAdmin: async (id) => reports.get(id), listReportsForAdmin: async () => [...reports.values()],
    resolveReportAtomic: async ({ reportId, resolution, auditId }) => {
      const report = reports.get(reportId);
      if (!report || report.status !== "open") return undefined;
      report.status = resolution === "dismiss" ? "dismissed" : "resolved";
      report.resolution = resolution;
      audits.push({ auditId, action: resolution, targetUserId: report.targetUserId });
      if (resolution === "suspend_connections") statuses.set(report.targetUserId, "connection_suspended");
      return report;
    },
  };

  return { connectionRepository, contactRepository, safetyRepository, requests, notifications, audits, statuses };
}

test("approved members exchange only live encrypted cards, and block/report/suspension close the consent path", async () => {
  const store = fixture();
  let sequence = 0;
  const connections = createConnectionService(store.connectionRepository, () => "connection-1", { createNotificationId: () => `notification-${++sequence}` });
  const cards = createContactCardService(store.contactRepository, key);
  const safety = createSafetyService(store.safetyRepository, (() => { let id = 0; return () => `audit-or-report-${++id}`; })());

  await cards.saveOwnCard("member-a", { wechat: "member-a-v1" }, now);
  await cards.saveOwnCard("member-b", { email: "member-b@example.test" }, now);
  const request = await connections.createRequest("member-a", {
    recipientId: "member-b", topic: "校园 AI 共创", message: "我想交流校园 AI 共创活动的组织经验和实践想法。",
  }, now);
  assert.equal(request.status, "pending");
  assert.deepEqual(store.notifications.map((item) => [item.type, item.userId]), [["connection_received", "member-b"]]);

  await connections.resolveRequest("member-b", request.id, "accept", now + 1);
  assert.deepEqual(store.notifications.map((item) => [item.type, item.userId]), [["connection_received", "member-b"], ["connection_accepted", "member-a"]]);
  assert.deepEqual(await cards.getVisibleContactCard("member-a", "member-b"), { email: "member-b@example.test" });
  assert.deepEqual(await cards.getVisibleContactCard("member-b", "member-a"), { wechat: "member-a-v1" });

  await cards.saveOwnCard("member-a", { wechat: "member-a-v2" }, now + 2);
  assert.deepEqual(await cards.getVisibleContactCard("member-b", "member-a"), { wechat: "member-a-v2" }, "accepted peers read the current encrypted card, never a copied request value");

  await safety.blockUser("member-b", "member-a", now + 3);
  assert.equal(await cards.getVisibleContactCard("member-a", "member-b"), undefined);
  assert.equal(await cards.getVisibleContactCard("member-b", "member-a"), undefined);
  await assert.rejects(
    () => connections.createRequest("member-a", { recipientId: "member-b", topic: "校园 AI 共创", message: "我想交流校园 AI 共创活动的组织经验和实践想法。" }, now + 4),
    (error: unknown) => error instanceof ConnectionServiceError && error.code === "blocked",
  );

  const report = await safety.submitReport("member-b", {
    targetUserId: "member-a", category: "spam", requestId: request.id,
    description: "这是足够长的举报说明，用于验证拉黑后仍可提交安全举报并进入管理员处理流程。",
  }, now + 5);
  const resolved = await safety.resolveReport("demo-admin", report.id, "suspend_connections", now + 6);
  assert.equal(resolved.status, "resolved");
  assert.equal(store.statuses.get("member-a"), "connection_suspended");
  assert.deepEqual(store.audits, [{ auditId: "audit-or-report-2", action: "suspend_connections", targetUserId: "member-a" }]);
  await safety.unblockUser("member-b", "member-a");
  await assert.rejects(
    () => connections.createRequest("member-a", { recipientId: "member-b", topic: "校园 AI 共创", message: "我想交流校园 AI 共创活动的组织经验和实践想法。" }, now + 7),
    (error: unknown) => error instanceof ConnectionServiceError && error.code === "sender_ineligible",
    "the post-resolution refusal must be caused by the connection suspension, not the earlier block",
  );
});
