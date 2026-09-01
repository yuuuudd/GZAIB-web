import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import { drizzle } from "drizzle-orm/d1";
import {
  CommunityAdminError,
  createCommunityAdminService,
  parseCommunityReviewAction,
  type CommunityAdminRepository,
} from "../../features/admin/communities";
import { createCommunityRepository } from "../../lib/db/repositories/communities";

const NOW = 1_780_000_000_000;

type SqliteRunResult = { success: true; results: Record<string, unknown>[]; meta: { changes: number } };

class SqliteD1Statement {
  constructor(
    private readonly database: DatabaseSync,
    readonly sql: string,
    readonly params: unknown[] = [],
  ) {}

  bind(...params: unknown[]) {
    return new SqliteD1Statement(this.database, this.sql, params);
  }

  async run(): Promise<SqliteRunResult> {
    const result = this.database.prepare(this.sql).run(...this.params as never[]);
    return { success: true, results: [], meta: { changes: Number(result.changes) } };
  }

  async all() {
    const results = this.database.prepare(this.sql).all(...this.params as never[]) as Record<string, unknown>[];
    return { success: true, results, meta: { changes: 0 } };
  }

  async raw() {
    const rows = this.database.prepare(this.sql).all(...this.params as never[]) as Record<string, unknown>[];
    return rows.map((row) => Object.values(row));
  }
}

class SqliteD1Database {
  private batchTail: Promise<void> = Promise.resolve();

  constructor(readonly sqlite: DatabaseSync) {}

  prepare(sql: string) {
    return new SqliteD1Statement(this.sqlite, sql);
  }

  batch(statements: SqliteD1Statement[]): Promise<SqliteRunResult[]> {
    let resolveResult!: (value: SqliteRunResult[]) => void;
    let rejectResult!: (reason: unknown) => void;
    const result = new Promise<SqliteRunResult[]>((resolve, reject) => {
      resolveResult = resolve;
      rejectResult = reject;
    });
    this.batchTail = this.batchTail.then(async () => {
      this.sqlite.exec("BEGIN IMMEDIATE");
      try {
        const results: SqliteRunResult[] = [];
        for (const statement of statements) results.push(await statement.run());
        this.sqlite.exec("COMMIT");
        resolveResult(results);
      } catch (error) {
        this.sqlite.exec("ROLLBACK");
        rejectResult(error);
      }
    });
    return result;
  }
}

function databaseStore() {
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec(`
    PRAGMA foreign_keys = ON;
    CREATE TABLE users (
      id text PRIMARY KEY NOT NULL,
      email text NOT NULL,
      role text NOT NULL DEFAULT 'member',
      status text NOT NULL DEFAULT 'active',
      created_at integer NOT NULL,
      updated_at integer NOT NULL
    );
    CREATE TABLE member_profiles (
      id text PRIMARY KEY NOT NULL,
      user_id text NOT NULL REFERENCES users(id),
      slug text NOT NULL,
      nickname text NOT NULL,
      publish_status text NOT NULL,
      created_at integer NOT NULL,
      updated_at integer NOT NULL
    );
    CREATE TABLE audit_logs (
      id text PRIMARY KEY NOT NULL,
      actor_user_id text REFERENCES users(id),
      target_type text NOT NULL,
      target_id text NOT NULL,
      action text NOT NULL,
      diff_json text NOT NULL DEFAULT '{}',
      created_at integer NOT NULL
    );
    CREATE TABLE communities (
      id text PRIMARY KEY NOT NULL,
      slug text NOT NULL UNIQUE,
      name text NOT NULL,
      summary text NOT NULL,
      primary_city text,
      location_mode text NOT NULL,
      focus_tags_json text NOT NULL DEFAULT '[]',
      official_url text NOT NULL,
      source_url text NOT NULL,
      source_label text NOT NULL,
      publish_status text NOT NULL DEFAULT 'draft',
      published_at integer,
      created_at integer NOT NULL,
      updated_at integer NOT NULL
    );
    CREATE TABLE community_profile_submissions (
      id text PRIMARY KEY NOT NULL,
      community_id text REFERENCES communities(id),
      submitter_user_id text NOT NULL REFERENCES users(id),
      kind text NOT NULL,
      name text NOT NULL,
      summary text NOT NULL,
      primary_city text,
      location_mode text NOT NULL,
      focus_tags_json text NOT NULL,
      official_url text NOT NULL,
      source_url text NOT NULL,
      source_label text NOT NULL,
      status text NOT NULL,
      submitted_at integer NOT NULL,
      reviewed_at integer,
      reviewed_by text REFERENCES users(id),
      review_reason text,
      created_at integer NOT NULL,
      updated_at integer NOT NULL
    );
    CREATE TABLE community_claims (
      id text PRIMARY KEY NOT NULL,
      community_id text NOT NULL REFERENCES communities(id),
      applicant_user_id text NOT NULL REFERENCES users(id),
      evidence text NOT NULL,
      evidence_url text,
      status text NOT NULL,
      submitted_at integer NOT NULL,
      reviewed_at integer,
      reviewed_by text REFERENCES users(id),
      review_reason text,
      created_at integer NOT NULL,
      updated_at integer NOT NULL
    );
    CREATE TABLE community_managers (
      community_id text NOT NULL REFERENCES communities(id),
      user_id text NOT NULL REFERENCES users(id),
      role text NOT NULL DEFAULT 'owner',
      created_at integer NOT NULL,
      PRIMARY KEY(community_id, user_id)
    );
    CREATE TABLE community_updates (
      id text PRIMARY KEY NOT NULL,
      community_id text NOT NULL REFERENCES communities(id),
      submitter_user_id text NOT NULL REFERENCES users(id),
      title text NOT NULL,
      summary text NOT NULL,
      occurred_at integer NOT NULL,
      source_url text,
      status text NOT NULL,
      submitted_at integer NOT NULL,
      reviewed_at integer,
      reviewed_by text REFERENCES users(id),
      review_reason text,
      created_at integer NOT NULL,
      updated_at integer NOT NULL
    );
    CREATE TABLE community_follows (
      community_id text NOT NULL REFERENCES communities(id),
      user_id text NOT NULL REFERENCES users(id),
      created_at integer NOT NULL,
      PRIMARY KEY(community_id, user_id)
    );
    INSERT INTO users (id, email, role, created_at, updated_at) VALUES
      ('demo-admin', 'admin@example.test', 'admin', 1, 1),
      ('member-1', 'member@example.test', 'member', 1, 1);
    INSERT INTO member_profiles (id, user_id, slug, nickname, publish_status, created_at, updated_at)
      VALUES ('profile-member-1', 'member-1', 'member-1', '公开昵称', 'published', 1, 1);
  `);
  const client = new SqliteD1Database(sqlite);
  const db = drizzle(client as never);
  const repository = createCommunityRepository(db as never);
  const service = createCommunityAdminService(repository, () => "community-new", () => crypto.randomUUID());
  return { sqlite, repository, service };
}

function plain(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" ? { ...value as Record<string, unknown> } : undefined;
}

function plainRows(values: unknown[]): Record<string, unknown>[] {
  return values.map((value) => ({ ...value as Record<string, unknown> }));
}

function seedCommunity(sqlite: DatabaseSync, id = "community-1") {
  sqlite.prepare(`INSERT INTO communities
    (id, slug, name, summary, primary_city, location_mode, focus_tags_json, official_url, source_url, source_label, publish_status, published_at, created_at, updated_at)
    VALUES (?, ?, '旧社群名', '旧的公开简介内容。', '广州', 'city', '["旧标签"]', 'https://old.example.test', 'https://old.example.test/source', '旧来源', 'published', 10, 10, 10)`)
    .run(id, id);
}

function seedProfile(sqlite: DatabaseSync, options: { id?: string; kind?: "create" | "update"; communityId?: string | null } = {}) {
  sqlite.prepare(`INSERT INTO community_profile_submissions
    (id, community_id, submitter_user_id, kind, name, summary, primary_city, location_mode, focus_tags_json, official_url, source_url, source_label, status, submitted_at, created_at, updated_at)
    VALUES (?, ?, 'member-1', ?, '存储的社群名称', '这段简介完全来自待审核记录。', '深圳', 'hybrid', '["Agent","产品"]', 'https://stored.example.test', 'https://stored.example.test/source', '存储来源', 'pending', 20, 20, 20)`)
    .run(options.id ?? "submission-1", options.communityId ?? null, options.kind ?? "create");
}

function seedClaim(sqlite: DatabaseSync) {
  sqlite.prepare(`INSERT INTO community_claims
    (id, community_id, applicant_user_id, evidence, evidence_url, status, submitted_at, created_at, updated_at)
    VALUES ('claim-1', 'community-1', 'member-1', '仅运营可见的认领证明 secret-evidence', 'https://private.example.test/evidence', 'pending', 30, 30, 30)`).run();
}

function seedUpdate(sqlite: DatabaseSync) {
  sqlite.prepare(`INSERT INTO community_updates
    (id, community_id, submitter_user_id, title, summary, occurred_at, source_url, status, submitted_at, created_at, updated_at)
    VALUES ('update-1', 'community-1', 'member-1', '待发布动态', '只有审核后才会公开的动态摘要。', 40, 'https://stored.example.test/update', 'pending', 40, 40, 40)`).run();
}

test("review parser accepts only the exact discriminated union and trims bounded reasons", () => {
  assert.deepEqual(parseCommunityReviewAction({ decision: "approve" }), { decision: "approve" });
  assert.deepEqual(parseCommunityReviewAction({ decision: "reject", reason: "  不通过  " }), { decision: "reject", reason: "不通过" });
  assert.deepEqual(parseCommunityReviewAction({ decision: "changes_requested", reason: "需补充" }), { decision: "changes_requested", reason: "需补充" });
  assert.deepEqual(parseCommunityReviewAction({ decision: "reject", reason: "甲".repeat(300) }), { decision: "reject", reason: "甲".repeat(300) });
  assert.deepEqual(parseCommunityReviewAction({ decision: "reject", reason: "😀".repeat(300) }), { decision: "reject", reason: "😀".repeat(300) });

  for (const invalid of [
    null,
    [],
    { decision: "approve", reason: "客户端不得提供" },
    { decision: "approve", name: "客户端覆盖" },
    { decision: "approve", reviewedBy: "demo-admin", publishedAt: NOW },
    { decision: "reject" },
    { decision: "reject", reason: "短" },
    { decision: "reject", reason: "😀" },
    { decision: "reject", reason: "甲".repeat(301) },
    { decision: "changes_requested", reason: "有效理由", evidence: "不允许" },
    { decision: "published" },
  ]) assert.throws(() => parseCommunityReviewAction(invalid), /审核操作/);
});

test("service owns reviewer, timestamps, transition, audit action, and generated public identifiers", async () => {
  const calls: Parameters<CommunityAdminRepository["reviewAtomic"]>[0][] = [];
  const repository: CommunityAdminRepository = {
    reviewAtomic: async (input) => { calls.push(input); return { transitioned: true }; },
    listPendingReviews: async () => ({ profiles: [], claims: [], updates: [] }),
  };
  const service = createCommunityAdminService(repository, () => "community-server-id", () => "audit-server-id");

  const result = await service.review("chatgpt:operator-1", "profile", "submission-1", { decision: "approve" }, NOW);

  assert.deepEqual(result, { kind: "profile", id: "submission-1", status: "approved" });
  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0], {
    kind: "profile",
    id: "submission-1",
    status: "approved",
    reviewedBy: "chatgpt:operator-1",
    reviewedAt: NOW,
    reviewReason: null,
    newCommunity: { id: "community-server-id", slug: "community-community-server-id" },
    audit: {
      id: "audit-server-id",
      actorUserId: "chatgpt:operator-1",
      targetType: "community_submission",
      targetId: "submission-1",
      action: "community.profile_approved",
      diffJson: '{"status":"approved"}',
      createdAt: NOW,
    },
  });
});

test("named profile, claim, and update review transitions stay on their fixed source kinds", async () => {
  const calls: Parameters<CommunityAdminRepository["reviewAtomic"]>[0][] = [];
  const repository: CommunityAdminRepository = {
    reviewAtomic: async (input) => { calls.push(input); return { transitioned: true }; },
    listPendingReviews: async () => ({ profiles: [], claims: [], updates: [] }),
  };
  const service = createCommunityAdminService(repository, () => "community-server-id", () => `audit-${calls.length + 1}`);

  await service.reviewProfileSubmission("demo-admin", "submission-1", { decision: "reject", reason: "无法核验" }, NOW);
  await service.reviewClaim("demo-admin", "claim-1", { decision: "approve" }, NOW + 1);
  await service.reviewUpdate("demo-admin", "update-1", { decision: "approve" }, NOW + 2);

  assert.deepEqual(calls.map(({ kind, status }) => ({ kind, status })), [
    { kind: "profile", status: "rejected" },
    { kind: "claim", status: "approved" },
    { kind: "update", status: "published" },
  ]);
});

test("approving a create submission publishes exactly one allowlisted stored community and one audit", async (t) => {
  const store = databaseStore();
  t.after(() => store.sqlite.close());
  seedProfile(store.sqlite);

  const result = await store.service.review("demo-admin", "profile", "submission-1", { decision: "approve" }, NOW);

  assert.deepEqual(result, { kind: "profile", id: "submission-1", status: "approved" });
  assert.deepEqual(plain(store.sqlite.prepare(`SELECT id, slug, name, summary, primary_city AS primaryCity, location_mode AS locationMode,
    focus_tags_json AS focusTagsJson, official_url AS officialUrl, source_url AS sourceUrl, source_label AS sourceLabel,
    publish_status AS publishStatus, published_at AS publishedAt FROM communities`).get()), {
    id: "community-new",
    slug: "community-community-new",
    name: "存储的社群名称",
    summary: "这段简介完全来自待审核记录。",
    primaryCity: "深圳",
    locationMode: "hybrid",
    focusTagsJson: '["Agent","产品"]',
    officialUrl: "https://stored.example.test",
    sourceUrl: "https://stored.example.test/source",
    sourceLabel: "存储来源",
    publishStatus: "published",
    publishedAt: NOW,
  });
  assert.deepEqual(plain(store.sqlite.prepare("SELECT status, community_id AS communityId, reviewed_by AS reviewedBy, reviewed_at AS reviewedAt, review_reason AS reviewReason FROM community_profile_submissions").get()), {
    status: "approved", communityId: "community-new", reviewedBy: "demo-admin", reviewedAt: NOW, reviewReason: null,
  });
  assert.deepEqual(plainRows(store.sqlite.prepare("SELECT target_type AS targetType, action, diff_json AS diffJson FROM audit_logs").all()), [
    { targetType: "community_submission", action: "community.profile_approved", diffJson: '{"status":"approved"}' },
  ]);
});

test("profile update approval copies only stored submission fields and preserves public identity", async (t) => {
  const store = databaseStore();
  t.after(() => store.sqlite.close());
  seedCommunity(store.sqlite);
  seedProfile(store.sqlite, { kind: "update", communityId: "community-1" });

  await store.service.review("demo-admin", "profile", "submission-1", { decision: "approve" }, NOW);

  const row = plain(store.sqlite.prepare("SELECT id, slug, name, source_url AS sourceUrl, created_at AS createdAt, updated_at AS updatedAt FROM communities").get());
  assert.deepEqual(row, {
    id: "community-1", slug: "community-1", name: "存储的社群名称",
    sourceUrl: "https://stored.example.test/source", createdAt: 10, updatedAt: NOW,
  });
  assert.equal((store.sqlite.prepare("SELECT count(*) AS count FROM communities").get() as { count: number }).count, 1);
});

test("claim approval creates manager access only inside the successful audit-gated batch", async (t) => {
  const store = databaseStore();
  t.after(() => store.sqlite.close());
  seedCommunity(store.sqlite);
  seedClaim(store.sqlite);

  await store.service.review("demo-admin", "claim", "claim-1", { decision: "approve" }, NOW);

  assert.deepEqual(plainRows(store.sqlite.prepare("SELECT community_id AS communityId, user_id AS userId, role, created_at AS createdAt FROM community_managers").all()), [
    { communityId: "community-1", userId: "member-1", role: "owner", createdAt: NOW },
  ]);
  assert.deepEqual(plain(store.sqlite.prepare("SELECT status, reviewed_by AS reviewedBy, reviewed_at AS reviewedAt FROM community_claims").get()), {
    status: "approved", reviewedBy: "demo-admin", reviewedAt: NOW,
  });
  const audit = JSON.stringify(store.sqlite.prepare("SELECT * FROM audit_logs").get());
  assert.doesNotMatch(audit, /secret-evidence|private\.example/);
});

test("reject and changes-requested decisions never publish or grant management", async (t) => {
  const store = databaseStore();
  t.after(() => store.sqlite.close());
  seedCommunity(store.sqlite);
  seedProfile(store.sqlite);
  seedClaim(store.sqlite);

  await store.service.review("demo-admin", "profile", "submission-1", { decision: "reject", reason: "来源无法核验" }, NOW);
  await store.service.review("demo-admin", "claim", "claim-1", { decision: "changes_requested", reason: "请补充证明" }, NOW + 1);

  assert.equal((store.sqlite.prepare("SELECT count(*) AS count FROM communities WHERE id = 'community-new'").get() as { count: number }).count, 0);
  assert.equal((store.sqlite.prepare("SELECT count(*) AS count FROM community_managers").get() as { count: number }).count, 0);
  assert.deepEqual(plain(store.sqlite.prepare("SELECT status, review_reason AS reason FROM community_profile_submissions").get()), { status: "rejected", reason: "来源无法核验" });
  assert.deepEqual(plain(store.sqlite.prepare("SELECT status, review_reason AS reason FROM community_claims").get()), { status: "changes_requested", reason: "请补充证明" });
  assert.deepEqual(plainRows(store.sqlite.prepare("SELECT action FROM audit_logs ORDER BY created_at").all()), [
    { action: "community.profile_rejected" },
    { action: "community.claim_changes_requested" },
  ]);
});

test("concurrent update reviews admit one publication and one audit winner", async (t) => {
  const store = databaseStore();
  t.after(() => store.sqlite.close());
  seedCommunity(store.sqlite);
  seedUpdate(store.sqlite);

  const settled = await Promise.allSettled([
    store.service.review("demo-admin", "update", "update-1", { decision: "approve" }, NOW),
    store.service.review("demo-admin", "update", "update-1", { decision: "approve" }, NOW + 1),
  ]);

  assert.equal(settled.filter((item) => item.status === "fulfilled").length, 1);
  const rejected = settled.find((item) => item.status === "rejected") as PromiseRejectedResult | undefined;
  assert.ok(rejected?.reason instanceof CommunityAdminError);
  assert.equal(rejected.reason.code, "state_changed");
  assert.match(rejected.reason.message, /状态已变化/);
  assert.deepEqual(plain(store.sqlite.prepare("SELECT status FROM community_updates").get()), { status: "published" });
  assert.equal((store.sqlite.prepare("SELECT count(*) AS count FROM audit_logs").get() as { count: number }).count, 1);

  await assert.rejects(
    () => store.service.review("demo-admin", "update", "update-1", { decision: "reject", reason: "不再发布" }, NOW + 2),
    /状态已变化/,
  );
  assert.equal((store.sqlite.prepare("SELECT count(*) AS count FROM audit_logs").get() as { count: number }).count, 1);
});

test("a failure after the audit gate rolls back the audit and leaves the source pending", async (t) => {
  const store = databaseStore();
  t.after(() => store.sqlite.close());
  seedCommunity(store.sqlite, "community-new");
  seedProfile(store.sqlite);

  await assert.rejects(() => store.service.review("demo-admin", "profile", "submission-1", { decision: "approve" }, NOW));

  assert.equal((store.sqlite.prepare("SELECT count(*) AS count FROM audit_logs").get() as { count: number }).count, 0);
  assert.deepEqual(plain(store.sqlite.prepare("SELECT status, reviewed_by AS reviewedBy FROM community_profile_submissions").get()), { status: "pending", reviewedBy: null });
  assert.equal((store.sqlite.prepare("SELECT count(*) AS count FROM communities").get() as { count: number }).count, 1);
});
