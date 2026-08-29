import assert from "node:assert/strict";
import test from "node:test";
import { authorizeAdminRoute, requireAdmin } from "../../features/admin/authorization";
import { createApplicationReviewService, parseReviewDecision, type ApplicationReviewRepository } from "../../features/applications/review";
import { DEFAULT_APPLICATION_VISIBILITY, getMapEligibility } from "../../features/applications/validation";
import type { ApplicationRecord } from "../../features/applications/types";
import type { Session } from "../../features/identity/types";

const adminSession: Session = {
  identity: { id: "demo-admin", role: "admin", displayName: "演示运营员" },
  expiresAt: 9_999,
};
const memberSession: Session = {
  identity: { id: "demo-member", role: "member", displayName: "演示共建者" },
  expiresAt: 9_999,
};

function application(overrides: Partial<ApplicationRecord> = {}): ApplicationRecord {
  const visibility = { ...DEFAULT_APPLICATION_VISIBILITY };
  return {
    id: "a1", userId: "applicant-1", status: "pending", nickname: "演示申请者",
    schoolId: "school-1", intro: "这是完全虚构的演示申请资料，不对应任何现实人物。",
    skills: ["AI应用"], interests: ["校园共建"], roles: ["活动共建者"], workLinks: [],
    visibility, consentVersion: "builder-map-2026-08-29", consentAcceptedAt: 1,
    submittedAt: 1, createdAt: 1, updatedAt: 1, mapEligibility: getMapEligibility(visibility),
    ...overrides,
  };
}

function repository(options: { record?: ApplicationRecord; coordinateStatus?: "suggested" | "confirmed" } = {}) {
  const atomicReviews: Parameters<ApplicationReviewRepository["applyReviewAtomic"]>[0][] = [];
  const decisions: Parameters<ApplicationReviewRepository["recordDecisionAtomic"]>[0][] = [];
  const repo: ApplicationReviewRepository = {
    getReviewContext: async () => ({
      application: options.record ?? application(),
      schoolCoordinateStatus: options.coordinateStatus ?? "confirmed",
    }),
    applyReviewAtomic: async (input) => { atomicReviews.push(input); },
    recordDecisionAtomic: async (input) => { decisions.push(input); },
  };
  return { repo, atomicReviews, decisions };
}

test("requires the signed fixed demo-admin identity and rejects role/id lookalikes", () => {
  assert.throws(() => requireAdmin(memberSession), /forbidden/i);
  assert.throws(() => requireAdmin({ identity: { id: "demo-admin", role: "member" } }), /forbidden/i);
  assert.throws(() => requireAdmin({ identity: { id: "someone-else", role: "admin" } }), /forbidden/i);
  assert.equal(requireAdmin(adminSession), "demo-admin");
});

test("admin route boundary is Demo-only and returns 403 for a non-admin signed session", async () => {
  const request = new Request("https://example.test/api/admin/applications/a1", { method: "POST" });
  const hidden = await authorizeAdminRoute(request, { isDemoMode: () => false, requireSession: async () => adminSession });
  const forbidden = await authorizeAdminRoute(request, { isDemoMode: () => true, requireSession: async () => memberSession });
  const allowed = await authorizeAdminRoute(request, { isDemoMode: () => true, requireSession: async () => adminSession });

  assert.equal(hidden.ok, false);
  if (!hidden.ok) assert.equal(hidden.response.status, 404);
  assert.equal(forbidden.ok, false);
  if (!forbidden.ok) assert.equal(forbidden.response.status, 403);
  assert.deepEqual(allowed, { ok: true, adminId: "demo-admin" });
});

test("review parser accepts only exact decisions and never accepts identity claims", () => {
  assert.deepEqual(parseReviewDecision({ decision: "approved" }), { decision: "approved" });
  assert.throws(() => parseReviewDecision({ decision: "approved", role: "admin" }), /invalid/i);
  assert.throws(() => parseReviewDecision({ decision: "approved", userId: "demo-admin" }), /invalid/i);
  assert.throws(() => parseReviewDecision({ decision: "delete" }), /invalid/i);
});

test("publishes an eligible application through one atomic review payload and audit action", async () => {
  const store = repository();
  const service = createApplicationReviewService(store.repo, () => "profile-1", () => "audit-1");
  const result = await service.reviewApplication(requireAdmin(adminSession), "a1", { decision: "approved" }, 1_000);

  assert.equal(result.profile?.publishStatus, "published");
  assert.equal(store.atomicReviews.length, 1);
  assert.equal(store.atomicReviews[0]?.application.status, "approved");
  assert.equal(store.atomicReviews[0]?.audit.action, "application.approved");
  assert.equal(store.atomicReviews[0]?.visibility.length, Object.keys(DEFAULT_APPLICATION_VISIBILITY).length);
});

test("never lets the applicant approve their own application", async () => {
  const store = repository({ record: application({ userId: "demo-admin" }) });
  const service = createApplicationReviewService(store.repo);
  await assert.rejects(() => service.reviewApplication("demo-admin", "a1", { decision: "approved" }, 1_000), /own application/i);
  assert.equal(store.atomicReviews.length, 0);
});

test("rejects approval while the school coordinate is unconfirmed and leaves the profile off-map", async () => {
  const store = repository({ coordinateStatus: "suggested" });
  const service = createApplicationReviewService(store.repo);
  await assert.rejects(() => service.reviewApplication("demo-admin", "a1", { decision: "approved" }, 1_000), /coordinate/i);
  assert.equal(store.atomicReviews.length, 0);
});

test("approves but keeps a profile unpublished when a required map field is not public", async () => {
  const visibility = { ...DEFAULT_APPLICATION_VISIBILITY, skills: "private" as const };
  const store = repository({ record: application({ visibility, mapEligibility: getMapEligibility(visibility) }) });
  const service = createApplicationReviewService(store.repo, () => "profile-1", () => "audit-1");
  const result = await service.reviewApplication("demo-admin", "a1", { decision: "approved" }, 1_000);

  assert.equal(result.profile?.publishStatus, "unpublished");
  assert.equal(store.atomicReviews[0]?.profile.publishStatus, "unpublished");
});

test("changes-requested and rejected decisions require a 10-500 character reason and never update profiles", async () => {
  const store = repository();
  const service = createApplicationReviewService(store.repo, undefined, () => "audit-1");
  await assert.rejects(() => service.reviewApplication("demo-admin", "a1", { decision: "rejected", reason: "太短" }, 1_000), /reason/i);

  await service.reviewApplication("demo-admin", "a1", { decision: "changes_requested", reason: "请补充能够核验的校园共建经历说明。" }, 1_001);
  await service.reviewApplication("demo-admin", "a1", { decision: "rejected", reason: "现有资料无法确认申请人与所选学校的关联。" }, 1_002);

  assert.equal(store.atomicReviews.length, 0);
  assert.deepEqual(store.decisions.map((row) => row.audit.action), ["application.changes_requested", "application.rejected"]);
});
