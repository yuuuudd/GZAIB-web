import assert from "node:assert/strict";
import test from "node:test";
import {
  createContributionService,
  parseContributionInput,
  type ContributionRecord,
  type ContributionRepository,
} from "../../features/contributions/service";
import { createDirectoryService } from "../../features/directory/service";

const storedPending: ContributionRecord = {
  id: "contribution-1", profileId: "profile-1", activityKey: "demo-build-night", title: "演示跨校共创夜",
  activityDate: 1_700_000_000_000, role: "活动共建者", outcome: "完成演示原型",
  publicSummary: "两所演示学校共同完成了一个虚构的校园工具原型。",
  visibility: "public", status: "pending", createdAt: 500, updatedAt: 500,
};

function contributionRepository(initial: ContributionRecord[] = [storedPending]) {
  const rows = new Map(initial.map((row) => [row.id, row]));
  const audits: string[] = [];
  const repository: ContributionRepository = {
    confirmPendingAtomic: async (input) => {
      const current = rows.get(input.contributionId);
      if (!current || current.status !== "pending") return { transitioned: false };
      const contribution = { ...current, status: "confirmed" as const, confirmedBy: input.confirmedBy, confirmedAt: input.confirmedAt, updatedAt: input.confirmedAt };
      rows.set(current.id, contribution);
      audits.push(input.audit.action);
      return {
        transitioned: true,
        contribution,
        verifiedBuilder: [...rows.values()].some((row) => row.profileId === current.profileId && row.status === "confirmed"),
        recipientUserId: "demo-member",
      };
    },
  };
  return { repository, rows, audits };
}

test("confirms the exact stored pending row without deriving or inserting another id", async () => {
  const store = contributionRepository();
  const service = createContributionService(store.repository, () => "audit-1");
  const result = await service.confirmContribution("demo-admin", { id: "contribution-1", status: "confirmed" }, 1_000);

  assert.equal(result.contribution.id, "contribution-1");
  assert.equal(result.contribution.createdAt, 500);
  assert.equal(result.verifiedBuilder, true);
  assert.equal(store.rows.size, 1);
  assert.equal(store.rows.get("contribution-1")?.status, "confirmed");
  assert.deepEqual(store.audits, ["contribution.confirmed"]);
});

test("contribution parser exposes only exact confirmation and rejects unaudited status mutations", () => {
  assert.deepEqual(parseContributionInput({ id: "contribution-1", status: "confirmed" }), { id: "contribution-1", status: "confirmed" });
  assert.throws(() => parseContributionInput({ id: "contribution-1", status: "pending" }), /invalid/i);
  assert.throws(() => parseContributionInput({ id: "contribution-1", status: "rejected" }), /invalid/i);
  assert.throws(() => parseContributionInput({ id: "contribution-1", status: "confirmed", userId: "demo-admin" }), /invalid/i);
});

test("rejects a concurrent or repeated confirmation without adding a second audit", async () => {
  const store = contributionRepository([{ ...storedPending, status: "confirmed" }]);
  const service = createContributionService(store.repository, () => "audit-1");

  await assert.rejects(() => service.confirmContribution("demo-admin", { id: "contribution-1", status: "confirmed" }, 1_000), /pending contribution/i);
  assert.equal(store.rows.size, 1);
  assert.deepEqual(store.audits, []);
});

test("returns one aggregate link only for confirmed public cross-school contributions", async () => {
  const service = createDirectoryService({
    listCandidates: async () => [],
    listPublicCollaborations: async () => [
      { activityKey: "shared-1", title: "跨校演示活动", activityDate: 300, schoolId: "school-a", status: "confirmed", visibility: "public" },
      { activityKey: "shared-1", title: "跨校演示活动", activityDate: 300, schoolId: "school-b", status: "confirmed", visibility: "public" },
      { activityKey: "pending", title: "待确认活动", activityDate: 200, schoolId: "school-a", status: "pending", visibility: "public" },
      { activityKey: "pending", title: "待确认活动", activityDate: 200, schoolId: "school-c", status: "confirmed", visibility: "public" },
      { activityKey: "private", title: "私密活动", activityDate: 100, schoolId: "school-a", status: "confirmed", visibility: "private" },
      { activityKey: "private", title: "私密活动", activityDate: 100, schoolId: "school-c", status: "confirmed", visibility: "private" },
    ],
  });

  assert.deepEqual(await service.listCollaborationLinks(), [{
    activityKey: "shared-1", title: "跨校演示活动", activityDate: 300, schoolIds: ["school-a", "school-b"],
  }]);
});
