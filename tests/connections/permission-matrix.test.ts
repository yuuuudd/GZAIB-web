import assert from "node:assert/strict";
import test from "node:test";
import { createContactCardService, type ContactCardRepository } from "../../features/connections/contact-card";
import { canCreate } from "../../features/connections/policy";
import { createSafetyService, type SafetyRepository } from "../../features/safety/service";
import { InactiveAccountError, createActiveAccountBoundary } from "../../features/identity/active-account";
import type { ConnectionPolicyContext } from "../../features/connections/types";

const key = Buffer.alloc(32, 11).toString("base64");
const now = 1_700_000_000_000;

type Actor = "visitor" | "pending" | "active" | "connection_suspended" | "hidden" | "suspended" | "admin" | "blocked";

type MatrixCase = {
  actor: Actor;
  create: 201 | 401 | 403;
  inbox: 200 | 401;
  contact: 200 | 401 | 403;
  report: 201 | 401;
  admin: 200 | 403;
};

const cases: MatrixCase[] = [
  { actor: "visitor", create: 401, inbox: 401, contact: 401, report: 401, admin: 403 },
  { actor: "pending", create: 403, inbox: 200, contact: 403, report: 201, admin: 403 },
  { actor: "active", create: 201, inbox: 200, contact: 200, report: 201, admin: 403 },
  { actor: "connection_suspended", create: 403, inbox: 200, contact: 403, report: 201, admin: 403 },
  { actor: "hidden", create: 403, inbox: 200, contact: 403, report: 201, admin: 403 },
  { actor: "suspended", create: 401, inbox: 401, contact: 401, report: 401, admin: 403 },
  { actor: "admin", create: 403, inbox: 200, contact: 403, report: 201, admin: 200 },
  { actor: "blocked", create: 403, inbox: 200, contact: 403, report: 201, admin: 403 },
];

function statusFor(actor: Actor) {
  return actor === "suspended" ? "suspended" : actor === "hidden" ? "hidden"
    : actor === "connection_suspended" ? "connection_suspended" : "active";
}

function policyFor(actor: Actor): ConnectionPolicyContext {
  return {
    senderId: actor, recipientId: "recipient", senderStatus: statusFor(actor),
    senderApproved: actor === "active" || actor === "connection_suspended" || actor === "blocked",
    senderPublished: actor === "active" || actor === "connection_suspended" || actor === "blocked",
    recipientPublished: true, blockedEitherDirection: actor === "blocked", pendingEitherDirection: false,
    requestsInLast24Hours: 0, topic: "AI 共创", message: "我想交流校园 AI 共创活动的组织经验和实践想法。",
  };
}

async function authenticated(actor: Actor) {
  if (actor === "visitor") return false;
  const boundary = createActiveAccountBoundary({
    requireSignedSession: async () => ({ identity: { id: actor === "admin" ? "demo-admin" : actor, role: actor === "admin" ? "admin" : "member", displayName: actor }, expiresAt: now + 1 }),
    getAccountStatus: async () => statusFor(actor),
  });
  try {
    await boundary(new Request("https://demo.local/me/connections"));
    return true;
  } catch (error) {
    assert.ok(error instanceof InactiveAccountError);
    return false;
  }
}

function contactRepository(actor: Actor): ContactCardRepository {
  let payload: string | undefined;
  return {
    save: async (_userId, value) => { payload = value; },
    get: async () => payload ? { encryptedPayload: payload, updatedAt: now } : undefined,
    getAccess: async () => ({
      accepted: actor === "active",
      blocked: actor === "blocked",
      viewerCanAccessContacts: actor === "active",
      ownerCanAccessContacts: true,
    }),
  };
}

function safetyRepository(): SafetyRepository {
  let reportOpen = true;
  return {
    blockPairAtomic: async () => ({ created: true }), unblock: async () => undefined, listBlocks: async () => [],
    resolvePublicMemberId: async () => "recipient", targetExists: async () => true,
    requestBelongsToPair: async () => true,
    createReport: async (report) => ({ ...report, status: "open" }),
    getReportForReporter: async () => undefined, getReportForAdmin: async () => undefined, listReportsForAdmin: async () => [],
    resolveReportAtomic: async (input) => {
      if (!reportOpen) return undefined;
      reportOpen = false;
      return { id: input.reportId, reporterId: "reporter", targetUserId: "recipient", category: "spam", description: "这是足够长的举报说明，用于验证权限边界。", status: "resolved", resolution: input.resolution };
    },
  };
}

test("permission matrix keeps authenticated access separate from connection eligibility and consent", async () => {
  for (const item of cases) {
    const signedIn = await authenticated(item.actor);
    const create = !signedIn ? 401 : canCreate(policyFor(item.actor)).ok ? 201 : 403;
    const inbox = signedIn ? 200 : 401;

    const contacts = createContactCardService(contactRepository(item.actor), key);
    await contacts.saveOwnCard("owner", { wechat: "owner-id" }, now);
    const contact = !signedIn ? 401 : await contacts.getVisibleContactCard(item.actor, "owner") ? 200 : 403;

    const safety = createSafetyService(safetyRepository(), () => "report-1");
    const report = !signedIn ? 401 : (await safety.submitReport(item.actor, {
      targetUserId: "recipient", category: "spam", description: "这是足够长的举报说明，用于验证权限边界。",
    }, now), 201);

    const admin = await safety.resolveReport(item.actor === "admin" ? "demo-admin" : item.actor, "report-1", "warn", now)
      .then(() => 200 as const)
      .catch(() => 403 as const);

    assert.deepEqual({ create, inbox, contact, report, admin }, {
      create: item.create, inbox: item.inbox, contact: item.contact, report: item.report, admin: item.admin,
    }, item.actor);
  }
});
