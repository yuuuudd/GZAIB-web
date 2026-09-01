import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import { drizzle } from "drizzle-orm/sqlite-proxy";
import {
  CommunityMutationError,
  createCommunityMutationService,
  type CommunityClaimRecord,
  type CommunityMutationRepository,
  type CommunityProfileSubmissionRecord,
  type CommunityUpdateRecord,
} from "../../features/communities/service";
import { createCommunityRepository } from "../../lib/db/repositories/communities";

const NOW = 1_780_000_000_000;

function validProfile(overrides: Record<string, unknown> = {}) {
  return {
    name: "广州 AI 产品社群",
    summary: "面向广州创作者的 AI 产品交流与实践社群。",
    primaryCity: "广州",
    locationMode: "city",
    focusTags: ["Agent", "产品"],
    officialUrl: "https://example.com/community",
    sourceUrl: "https://example.com/source",
    sourceLabel: "官方社区页面",
    ...overrides,
  };
}

function validClaim(overrides: Record<string, unknown> = {}) {
  return {
    communityId: "published",
    evidence: "这是足够长的证明材料，用于说明申请人与社群的真实关系。",
    evidenceUrl: "https://example.com/evidence",
    ...overrides,
  };
}

function validUpdate(overrides: Record<string, unknown> = {}) {
  return {
    communityId: "published",
    title: "社群共创活动",
    summary: "这是一段符合要求的社群动态摘要内容。",
    occurredAt: NOW - 10_000,
    sourceUrl: "https://example.com/update",
    ...overrides,
  };
}

function mutationStore() {
  const profiles: CommunityProfileSubmissionRecord[] = [];
  const claims: CommunityClaimRecord[] = [];
  const updates: CommunityUpdateRecord[] = [];
  const follows = new Map<string, { userId: string; communityId: string; createdAt: number }>();
  const published = new Set(["published"]);
  const managers = new Set(["manager:published"]);
  const repository: CommunityMutationRepository = {
    isPublishedCommunity: async (id) => published.has(id),
    isManager: async (userId, communityId) => managers.has(`${userId}:${communityId}`),
    hasPendingClaim: async (userId, communityId) => claims.some((claim) => claim.applicantUserId === userId && claim.communityId === communityId && claim.status === "pending"),
    saveProfileSubmission: async (record) => { profiles.push(record); },
    saveClaim: async (record) => { claims.push(record); return true; },
    saveUpdate: async (record) => { updates.push(record); },
    setFollow: async ({ userId, communityId, following, createdAt }) => {
      const key = `${userId}:${communityId}`;
      if (following) {
        if (!follows.has(key)) follows.set(key, { userId, communityId, createdAt });
      } else {
        follows.delete(key);
      }
    },
    listManagedCommunities: async (userId) => userId === "manager" ? [{ id: "published", slug: "published", name: "广州 AI 产品社群", publishStatus: "published" }] : [],
  };
  return { profiles, claims, updates, follows, published, managers, repository };
}

test("server-generated profile submissions are pending and client-owned review fields are rejected", async () => {
  const store = mutationStore();
  const service = createCommunityMutationService(store.repository, () => "submission-uuid");

  const record = await service.submitProfile("member-1", "create", null, validProfile(), NOW);

  assert.deepEqual(record, {
    id: "submission-uuid",
    communityId: null,
    submitterUserId: "member-1",
    kind: "create",
    name: "广州 AI 产品社群",
    summary: "面向广州创作者的 AI 产品交流与实践社群。",
    primaryCity: "广州",
    locationMode: "city",
    focusTagsJson: '["Agent","产品"]',
    officialUrl: "https://example.com/community",
    sourceUrl: "https://example.com/source",
    sourceLabel: "官方社区页面",
    status: "pending",
    submittedAt: NOW,
    reviewedAt: null,
    reviewedBy: null,
    reviewReason: null,
    createdAt: NOW,
    updatedAt: NOW,
  });
  await assert.rejects(
    () => service.submitProfile("member-1", "create", null, validProfile({ status: "approved", reviewedBy: "admin", publishedAt: NOW }), NOW),
    CommunityMutationError,
  );
  assert.equal(store.profiles.length, 1);
});

test("only an approved manager may submit a profile update or community update", async () => {
  const store = mutationStore();
  const ids = ["profile-update-uuid", "update-uuid"];
  const service = createCommunityMutationService(store.repository, () => ids.shift()!);

  await assert.rejects(() => service.submitProfile("stranger", "update", "published", validProfile(), NOW), /负责人/);
  await service.submitProfile("manager", "update", "published", validProfile(), NOW);
  await assert.rejects(() => service.submitUpdate("stranger", validUpdate(), NOW), /负责人/);
  const update = await service.submitUpdate("manager", validUpdate(), NOW);

  assert.equal(store.profiles[0]?.submitterUserId, "manager");
  assert.equal(store.profiles[0]?.status, "pending");
  assert.equal(update.submitterUserId, "manager");
  assert.equal(update.status, "pending");
  assert.equal(update.reviewedBy, null);
  assert.equal(update.submittedAt, NOW);
});

test("pending claim uniqueness is scoped to a user and community while changes-requested claims may be resubmitted", async () => {
  const store = mutationStore();
  const ids = ["claim-1", "claim-2"];
  const service = createCommunityMutationService(store.repository, () => ids.shift()!);

  const first = await service.submitClaim("member-1", validClaim(), NOW);
  await assert.rejects(() => service.submitClaim("member-1", validClaim(), NOW + 1), /审核中|重复/);
  assert.equal(store.claims.length, 1);
  first.status = "changes_requested";
  const second = await service.submitClaim("member-1", validClaim(), NOW + 2);

  assert.equal(store.claims.length, 2);
  assert.equal(second.id, "claim-2");
  assert.equal(second.status, "pending");
  assert.equal(second.submittedAt, NOW + 2);
  assert.equal(second.reviewedAt, null);
});

test("concurrent claim submissions admit one database winner and return a safe domain conflict for the loser", async () => {
  const database = new DatabaseSync(":memory:");
  try {
    database.exec("CREATE TABLE users (id text PRIMARY KEY NOT NULL)");
    for (const path of ["drizzle/0004_ai_community_foundation.sql", "drizzle/0005_pending_community_claim_uniqueness.sql"]) {
      if (!existsSync(path)) continue;
      for (const statement of readFileSync(path, "utf8").split("--> statement-breakpoint")) {
        if (statement.trim()) database.exec(statement);
      }
    }
    database.exec("INSERT INTO users (id) VALUES ('member-1'); INSERT INTO communities (id, slug, name, summary, location_mode, official_url, source_url, source_label, publish_status, created_at, updated_at) VALUES ('published', 'published', 'Community', 'Summary long enough', 'online', 'https://example.com', 'https://example.com/source', 'Source', 'published', 1, 1)");
    const db = drizzle(async (sql, params, method) => {
      const statement = database.prepare(sql);
      if (method === "run") { statement.run(...params); return { rows: [] }; }
      if (method === "get") return { rows: statement.get(...params) as never };
      const rows = statement.all(...params).map((row) => Object.values(row));
      return { rows };
    });
    const repository = createCommunityRepository(db as never);
    const originalHasPendingClaim = repository.hasPendingClaim.bind(repository);
    let checks = 0;
    let releaseChecks!: () => void;
    const bothChecked = new Promise<void>((resolve) => { releaseChecks = resolve; });
    repository.hasPendingClaim = async (userId, communityId) => {
      const result = await originalHasPendingClaim(userId, communityId);
      checks += 1;
      if (checks === 2) releaseChecks();
      await bothChecked;
      return result;
    };
    const ids = ["claim-a", "claim-b", "claim-c"];
    const service = createCommunityMutationService(repository, () => ids.shift()!);

    const results = await Promise.allSettled([
      service.submitClaim("member-1", validClaim(), NOW),
      service.submitClaim("member-1", validClaim(), NOW + 1),
    ]);

    assert.equal(results.filter((result) => result.status === "fulfilled").length, 1);
    const rejected = results.find((result) => result.status === "rejected") as PromiseRejectedResult | undefined;
    assert.ok(rejected?.reason instanceof CommunityMutationError);
    assert.match(rejected.reason.message, /审核中|重复/);
    assert.equal((database.prepare("SELECT count(*) AS count FROM community_claims WHERE status = 'pending'").get() as { count: number }).count, 1);

    database.exec("UPDATE community_claims SET status = 'changes_requested' WHERE status = 'pending'");
    await service.submitClaim("member-1", validClaim(), NOW + 2);
    assert.equal((database.prepare("SELECT count(*) AS count FROM community_claims WHERE status = 'pending'").get() as { count: number }).count, 1);
    assert.equal((database.prepare("SELECT count(*) AS count FROM community_claims").get() as { count: number }).count, 2);
  } finally {
    database.close();
  }
});

test("following is idempotent and cannot target an unpublished community", async () => {
  const store = mutationStore();
  const service = createCommunityMutationService(store.repository);

  await service.setFollow("member", "published", true, NOW);
  await service.setFollow("member", "published", true, NOW + 1);
  assert.equal(store.follows.size, 1);
  assert.equal(store.follows.get("member:published")?.createdAt, NOW);
  await service.setFollow("member", "published", false, NOW + 2);
  await service.setFollow("member", "published", false, NOW + 3);
  assert.equal(store.follows.size, 0);
  await assert.rejects(() => service.setFollow("member", "draft", true, NOW), /社群不存在/);
});

test("claim and update records use server identity, UUIDs and timestamps and never publish directly", async () => {
  const store = mutationStore();
  const ids = ["claim-uuid", "update-uuid"];
  const service = createCommunityMutationService(store.repository, () => ids.shift()!);

  const claim = await service.submitClaim("member-1", validClaim(), NOW);
  const update = await service.submitUpdate("manager", validUpdate(), NOW + 1);

  assert.equal(claim.applicantUserId, "member-1");
  assert.equal(claim.status, "pending");
  assert.equal(claim.createdAt, NOW);
  assert.equal(update.submitterUserId, "manager");
  assert.equal(update.status, "pending");
  assert.equal(update.createdAt, NOW + 1);
  assert.equal(update.updatedAt, NOW + 1);
});
