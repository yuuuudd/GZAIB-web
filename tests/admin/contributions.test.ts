import assert from "node:assert/strict";
import test from "node:test";
import { createContributionService, parseContributionInput, type ContributionRepository } from "../../features/contributions/service";
import { createDirectoryService } from "../../features/directory/service";

function contributionRepository() {
  const confirmed = new Map<string, Set<string>>();
  const changes: Parameters<ContributionRepository["applyStatusAtomic"]>[0][] = [];
  const repository: ContributionRepository = {
    applyStatusAtomic: async (input) => {
      changes.push(input);
      const ids = confirmed.get(input.profileId) ?? new Set<string>();
      if (input.contribution.status === "confirmed") ids.add(input.contribution.id);
      else ids.delete(input.contribution.id);
      confirmed.set(input.profileId, ids);
      return { verifiedBuilder: ids.size > 0 };
    },
  };
  return { repository, changes };
}

const contribution = {
  profileId: "profile-1", activityKey: "demo-build-night", title: "演示跨校共创夜",
  activityDate: 1_700_000_000_000, role: "活动共建者", outcome: "完成演示原型",
  publicSummary: "两所演示学校共同完成了一个虚构的校园工具原型。",
  visibility: "public" as const, status: "confirmed" as const,
};

test("confirms a contribution, writes the explicit audit action, and recalculates the badge", async () => {
  const store = contributionRepository();
  const service = createContributionService(store.repository, () => "contribution-1", () => "audit-1");
  const result = await service.confirmContribution("demo-admin", contribution, 1_000);

  assert.equal(result.verifiedBuilder, true);
  assert.equal(store.changes[0]?.audit?.action, "contribution.confirmed");
  assert.equal(store.changes[0]?.contribution.activityKey, "demo-build-night");
});

test("contribution parser allowlists fields and rejects identity claims", () => {
  assert.deepEqual(parseContributionInput(contribution), contribution);
  assert.throws(() => parseContributionInput({ ...contribution, roleClaim: "admin" }), /invalid/i);
  assert.throws(() => parseContributionInput({ ...contribution, userId: "demo-admin" }), /invalid/i);
});

test("recalculates rather than preserving an irreversible badge after a status change", async () => {
  const store = contributionRepository();
  const service = createContributionService(store.repository, () => "contribution-1", () => "audit-1");
  await service.confirmContribution("demo-admin", contribution, 1_000);
  const result = await service.confirmContribution("demo-admin", { ...contribution, status: "rejected" }, 2_000);

  assert.equal(result.verifiedBuilder, false);
  assert.equal(store.changes[1]?.audit, undefined);
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
