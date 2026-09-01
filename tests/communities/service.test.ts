import assert from "node:assert/strict";
import test from "node:test";
import {
  createCommunityDirectoryService,
  type CommunityDirectoryRepository,
  type CommunityRecord,
  type CommunityUpdateRecord,
} from "../../features/communities/service";

function community(overrides: Partial<CommunityRecord> = {}): CommunityRecord {
  return {
    id: "visible-id", slug: "visible", name: "广州 AI 共创社", summary: "一起把 AI 做进真实的社区协作。",
    primaryCity: "广州市", locationMode: "hybrid", focusTagsJson: '["AI","产品"]',
    officialUrl: "https://visible.example", sourceUrl: "https://source.example", sourceLabel: "公开来源",
    publishStatus: "published", publishedAt: 100, createdAt: 100, updatedAt: 200,
    ...overrides,
  };
}

function update(overrides: Partial<CommunityUpdateRecord> = {}): CommunityUpdateRecord {
  return {
    id: "update-1", communityId: "visible-id", submitterUserId: "manager-1", title: "公开活动", summary: "面向社区的公开活动记录。",
    occurredAt: 300, sourceUrl: "https://update.example", status: "published", submittedAt: 300,
    reviewedAt: 301, reviewedBy: "admin-1", reviewReason: null, createdAt: 300, updatedAt: 300,
    ...overrides,
  };
}

function repository(
  communities: CommunityRecord[] = [community()],
  updates: CommunityUpdateRecord[] = [],
  options: { claimed?: string[]; contacts?: { communityId: string; memberSlug: string }[]; followed?: string[] } = {},
): CommunityDirectoryRepository {
  return {
    listPublished: async () => communities,
    findPublishedBySlug: async (slug) => communities.find((item) => item.slug === slug),
    listPublishedUpdates: async (ids) => updates.filter((item) => ids.includes(item.communityId)),
    listManagerContacts: async (ids) => (options.contacts ?? []).filter((item) => ids.includes(item.communityId)),
    listClaimedCommunityIds: async (ids) => (options.claimed ?? []).filter((id) => ids.includes(id)),
    listFollowedCommunityIds: async (_viewerId, ids) => (options.followed ?? []).filter((id) => ids.includes(id)),
  };
}

test("public directory excludes non-published communities and non-published updates", async () => {
  const service = createCommunityDirectoryService(repository([
    community({ slug: "visible", publishStatus: "published" }),
    community({ id: "draft-id", slug: "draft", publishStatus: "draft" }),
  ], [
    update({ communityId: "visible-id", status: "published" }),
    update({ id: "secret-update", communityId: "visible-id", status: "pending", title: "secret" }),
  ]));

  const result = await service.list({});

  assert.deepEqual(result.items.map((item) => item.slug), ["visible"]);
  assert.equal(JSON.stringify(result).includes("secret"), false);
});

test("online communities never enter city summaries", async () => {
  const result = await createCommunityDirectoryService(repository([
    community({ id: "gz", primaryCity: "广州市", locationMode: "hybrid" }),
    community({ id: "online", slug: "online", primaryCity: null, locationMode: "online" }),
  ])).list({});

  assert.deepEqual(result.citySummaries, [{ city: "广州", communityCount: 1 }]);
});

test("directory normalizes NFKC search and city filters, focus and location mode", async () => {
  const service = createCommunityDirectoryService(repository([
    community({ id: "one", slug: "one", name: "ＡＩ　学习社", primaryCity: "广州市", focusTagsJson: '["学习","大模型"]', locationMode: "city" }),
    community({ id: "two", slug: "two", name: "深圳产品会", primaryCity: "深圳市", focusTagsJson: '["产品"]', locationMode: "hybrid" }),
    community({ id: "three", slug: "three", name: "线上开源社", primaryCity: null, focusTagsJson: '["学习"]', locationMode: "online" }),
  ]));

  assert.deepEqual((await service.list({ q: "ai 学习", city: "广州", focus: "学习", locationMode: "city" })).items.map((item) => item.slug), ["one"]);
  assert.deepEqual((await service.list({ locationMode: "online" })).items.map((item) => item.slug), ["three"]);
});

test("directory projects claims, one public manager, eight tags, three updates, and viewer follow state", async () => {
  const result = await createCommunityDirectoryService(repository([
    community({ focusTagsJson: JSON.stringify(["1", "2", "3", "4", "5", "6", "7", "8", "9"]) }),
  ], [
    update({ id: "old", occurredAt: 10 }), update({ id: "too-old", occurredAt: 1 }), update({ id: "new", occurredAt: 30 }), update({ id: "middle", occurredAt: 20 }),
  ], {
    claimed: ["visible-id"], contacts: [{ communityId: "visible-id", memberSlug: "owner" }], followed: ["visible-id"],
  })).list({}, "viewer-1");

  assert.deepEqual(result.items[0], {
    id: "visible-id", slug: "visible", name: "广州 AI 共创社", summary: "一起把 AI 做进真实的社区协作。",
    primaryCity: "广州市", locationMode: "hybrid", focusTags: ["1", "2", "3", "4", "5", "6", "7", "8"],
    officialUrl: "https://visible.example", sourceUrl: "https://source.example", sourceLabel: "公开来源", updatedAt: 200,
    claimed: true, contactSlug: "owner", followed: true,
    updates: [
      { id: "new", title: "公开活动", summary: "面向社区的公开活动记录。", occurredAt: 30, sourceUrl: "https://update.example" },
      { id: "middle", title: "公开活动", summary: "面向社区的公开活动记录。", occurredAt: 20, sourceUrl: "https://update.example" },
      { id: "old", title: "公开活动", summary: "面向社区的公开活动记录。", occurredAt: 10, sourceUrl: "https://update.example" },
    ],
  });
});

test("detail rejects invalid slugs and hides draft records even when a repository returns them", async () => {
  const hidden = community({ publishStatus: "draft" });
  const service = createCommunityDirectoryService(repository([hidden]));

  assert.equal(await service.getBySlug("not valid"), undefined);
  assert.equal(await service.getBySlug("visible"), undefined);
});

test("directory uses community profile updatedAt before name for deterministic ordering", async () => {
  const result = await createCommunityDirectoryService(repository([
    community({ id: "first", slug: "first", name: "乙社", updatedAt: 20 }),
    community({ id: "second", slug: "second", name: "甲社", updatedAt: 20 }),
    community({ id: "third", slug: "third", name: "丙社", updatedAt: 10 }),
  ], [update({ communityId: "third", occurredAt: 9_999 })])).list({});

  assert.deepEqual(result.items.map((item) => item.slug), ["second", "first", "third"]);
});
