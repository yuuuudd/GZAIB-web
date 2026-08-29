import assert from "node:assert/strict";
import test from "node:test";
import { createDirectoryService, loadVisibilityRulesInBatches, type DirectoryCandidate } from "../../features/directory/service";

const publicVisibility = {
  nickname: "public", avatarUrl: "public", school: "public", city: "public", intro: "public",
  skills: "public", roles: "public", verifiedBuilder: "public", contributions: "public",
} as const;

function candidate(overrides: Partial<DirectoryCandidate> = {}): DirectoryCandidate {
  return {
    approvalStatus: "approved",
    accountStatus: "active",
    publishStatus: "published",
    school: {
      id: "sysu", name: "中山大学", campus: "广州校区南校园", city: "广州",
      longitude: 113295120, latitude: 23102140, coordinateStatus: "confirmed",
    },
    profile: {
      id: "p1", userId: "u1", slug: "lin", nickname: "林同学", avatarUrl: "/avatar/lin.webp",
      school: "中山大学", city: "广州", intro: "把 AI 做成校园里的真实工具",
      skills: ["AI应用", "产品设计"], roles: ["项目发起人"], verifiedBuilder: true, contributions: [],
    },
    visibility: publicVisibility,
    ...overrides,
  };
}

test("excludes unapproved, inactive, unpublished, private and unconfirmed candidates", async () => {
  const hiddenVisibility = { ...publicVisibility, nickname: "private" as const };
  const repository = {
    listCandidates: async () => [
      candidate(),
      candidate({ profile: { ...candidate().profile, id: "p2", slug: "pending" }, approvalStatus: "pending" }),
      candidate({ profile: { ...candidate().profile, id: "p3", slug: "hidden" }, accountStatus: "hidden" }),
      candidate({ profile: { ...candidate().profile, id: "p4", slug: "draft" }, publishStatus: "unpublished" }),
      candidate({ profile: { ...candidate().profile, id: "p5", slug: "private" }, visibility: hiddenVisibility }),
      candidate({ profile: { ...candidate().profile, id: "p6", slug: "suggested" }, school: { ...candidate().school, coordinateStatus: "suggested" } }),
    ],
  };

  const result = await createDirectoryService(repository).list({});

  assert.equal(result.length, 1);
  assert.equal(result[0]?.memberCount, 1);
  assert.equal(result[0]?.previewMembers[0]?.slug, "lin");
});

test("connection-suspended members remain in the public school directory", async () => {
  const service = createDirectoryService({
    listCandidates: async () => [candidate({ accountStatus: "connection_suspended" })],
  });

  const result = await service.list({});

  assert.equal(result[0]?.memberCount, 1);
  assert.equal(result[0]?.previewMembers[0]?.slug, "lin");
});

test("combines city, skill, role, verified and normalized search filters with AND semantics", async () => {
  const repository = {
    listCandidates: async () => [
      candidate(),
      candidate({
        school: { ...candidate().school, id: "scut", name: "华南理工大学" },
        profile: { ...candidate().profile, id: "p2", slug: "chen", nickname: "陈同学", school: "华南理工大学", skills: ["前端开发"] },
      }),
    ],
  };

  const result = await createDirectoryService(repository).list({
    city: "广州", skills: ["AI应用"], roles: ["项目发起人"], verified: true, q: "  中山大学  ",
  });

  assert.deepEqual(result.map((school) => school.id), ["sysu"]);
});

test("converts confirmed integer microdegrees and limits previews to four", async () => {
  const repository = {
    listCandidates: async () => Array.from({ length: 6 }, (_, index) => candidate({
      profile: { ...candidate().profile, id: `p${index}`, slug: `member-${index}`, nickname: `成员${index}` },
    })),
  };

  const [school] = await createDirectoryService(repository).list({});

  assert.equal(school?.lng, 113.29512);
  assert.equal(school?.lat, 23.10214);
  assert.equal(school?.memberCount, 6);
  assert.equal(school?.previewMembers.length, 4);
});

test("list mode paginates projected profiles with an opaque stable cursor", async () => {
  const repository = {
    listCandidates: async () => ["a", "b", "c"].map((slug) => candidate({
      profile: { ...candidate().profile, id: `p-${slug}`, slug, nickname: `成员${slug}` },
    })),
  };
  const service = createDirectoryService(repository);

  const first = await service.listMembers({}, { limit: 2 });
  const second = await service.listMembers({}, { limit: 2, cursor: first.nextCursor });

  assert.deepEqual(first.items.map((item) => item.slug), ["a", "b"]);
  assert.deepEqual(second.items.map((item) => item.slug), ["c"]);
  assert.equal(second.nextCursor, undefined);
});

test("cursor pagination resumes after the exact mixed-case and non-ASCII slug", async () => {
  const slugs = ["a", "B", "á", "中", "Z"];
  const service = createDirectoryService({
    listCandidates: async () => slugs.map((slug) => candidate({
      profile: { ...candidate().profile, id: `p-${slug}`, slug, nickname: `成员${slug}` },
    })),
  });
  const seen: string[] = [];
  let cursor: string | undefined;
  do {
    const page = await service.listMembers({}, { limit: 2, cursor });
    seen.push(...page.items.map((item) => item.slug));
    cursor = page.nextCursor;
  } while (cursor && seen.length < 20);

  assert.equal(seen.length, slugs.length);
  assert.deepEqual(new Set(seen), new Set(slugs));
});

test("loads visibility rules in D1-safe batches of at most 100 parameters", async () => {
  const profileIds = Array.from({ length: 901 }, (_, index) => `p-${index}`);
  const batchSizes: number[] = [];
  const rules = await loadVisibilityRulesInBatches(profileIds, async (batch) => {
    batchSizes.push(batch.length);
    return batch.map((profileId) => ({ profileId, fieldName: "nickname", visibility: "public" }));
  });

  assert.equal(batchSizes.length, 10);
  assert.equal(batchSizes.every((size) => size <= 100), true);
  assert.equal(rules.size, 901);
  assert.deepEqual(rules.get("p-0"), { nickname: "public" });
  assert.deepEqual(rules.get("p-900"), { nickname: "public" });
});
