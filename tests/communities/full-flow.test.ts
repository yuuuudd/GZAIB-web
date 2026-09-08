import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { drizzle } from "drizzle-orm/d1";
import { CommunityProfile } from "../../components/communities/CommunityProfile";
import { createDemoSeedRepository, seedDemoData } from "../../db/demo-seed";
import { createCommunityAdminService } from "../../features/admin/communities";
import { createCommunityDirectoryService, createCommunityMutationService } from "../../features/communities/service";
import { createCommunityRepository } from "../../lib/db/repositories/communities";

const NOW = 1_780_000_000_000;
const MIGRATIONS = [
  "drizzle/0000_builder_map_core.sql",
  "drizzle/0001_member_connections.sql",
  "drizzle/0002_real_admin_manual_members.sql",
  "drizzle/0003_activate_school_coordinates.sql",
  "drizzle/0004_ai_community_foundation.sql",
  "drizzle/0005_pending_community_claim_uniqueness.sql",
  "drizzle/0012_school_provinces.sql",
  "drizzle/0013_repair_legacy_school_provinces.sql",
] as const;

type SqliteRunResult = { success: true; results: Record<string, unknown>[]; meta: { changes: number } };

class SqliteD1Statement {
  constructor(
    private readonly database: DatabaseSync,
    readonly sql: string,
    readonly params: unknown[] = [],
  ) {}

  bind(...params: unknown[]) {
    if (params.length > 100) throw new Error(`D1 bind limit exceeded: ${params.length}`);
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

function applyMigrations(sqlite: DatabaseSync) {
  for (const path of MIGRATIONS) {
    for (const statement of readFileSync(path, "utf8").split("--> statement-breakpoint")) {
      if (statement.trim()) sqlite.exec(statement);
    }
  }
}

function profile(name: string, summary: string) {
  return {
    name,
    summary,
    primaryCity: "佛山",
    locationMode: "hybrid",
    focusTags: ["Agent", "产品"],
    officialUrl: "https://flow-community.example.test",
    sourceUrl: "https://flow-community.example.test/about",
    sourceLabel: "全流程测试来源",
  };
}

async function exerciseFullFlow() {
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec("PRAGMA foreign_keys = ON");
  applyMigrations(sqlite);
  const d1 = new SqliteD1Database(sqlite);
  const db = drizzle(d1 as never);
  const repository = createCommunityRepository(db as never);

  const firstSeedCounts = await seedDemoData("demo-admin", createDemoSeedRepository(db as never), NOW);
  const secondSeedCounts = await seedDemoData("demo-admin", createDemoSeedRepository(db as never), NOW + 1);
  assert.deepEqual(secondSeedCounts, firstSeedCounts);
  assert.equal((sqlite.prepare("SELECT count(*) AS count FROM communities").get() as { count: number }).count, 3);
  assert.equal((sqlite.prepare("SELECT count(*) AS count FROM community_managers").get() as { count: number }).count, 3);
  assert.equal((sqlite.prepare("SELECT count(*) AS count FROM community_updates").get() as { count: number }).count, 3);

  const directory = createCommunityDirectoryService(repository);
  const visitorStart = await directory.list({});
  assert.deepEqual(visitorStart.items.map(({ slug }) => slug).sort(), [
    "demo-guangzhou-ai-builders",
    "demo-online-ai-makers",
    "demo-shenzhen-agent-lab",
  ]);
  assert.deepEqual(visitorStart.citySummaries, [
    { city: "广州", communityCount: 1 },
    { city: "深圳", communityCount: 1 },
  ]);
  assert.equal(visitorStart.items.every(({ name, summary, updates }) => name.includes("演示虚构") && summary.includes("演示虚构") && updates.length === 1), true);

  let mutationSequence = 0;
  const mutations = createCommunityMutationService(repository, () => `flow-record-${++mutationSequence}`);
  const starter = visitorStart.items.find(({ slug }) => slug === "demo-guangzhou-ai-builders")!;
  await mutations.setFollow("demo-member", starter.id, true, NOW + 10);
  await mutations.setFollow("demo-member", starter.id, true, NOW + 11);
  assert.equal((await directory.getBySlug(starter.slug, "demo-member"))?.followed, true);
  assert.equal((sqlite.prepare("SELECT count(*) AS count FROM community_follows").get() as { count: number }).count, 1);

  const submission = await mutations.submitProfile(
    "demo-member",
    "create",
    null,
    profile("佛山 AI 行动实验室", "面向湾区开发者的 AI 行动实验与产品共创社群。"),
    NOW + 20,
  );
  assert.equal((await directory.list({ q: "佛山 AI 行动实验室" })).items.length, 0);

  let auditSequence = 0;
  const admin = createCommunityAdminService(repository, () => "community-flow", () => `flow-audit-${++auditSequence}`);
  await admin.review("demo-admin", "profile", submission.id, { decision: "approve" }, NOW + 30);
  const published = await directory.getBySlug("community-community-flow");
  assert.equal(published?.name, "佛山 AI 行动实验室");
  assert.equal(published?.claimed, false);

  const evidence = "private-evidence-only-for-review-42 申请人与社群共同维护官方入口。";
  const claim = await mutations.submitClaim("demo-member", {
    communityId: published!.id,
    evidence,
    evidenceUrl: "https://private-evidence.example.test/proof",
  }, NOW + 40);
  assert.equal((await directory.getBySlug(published!.slug))?.claimed, false);
  await admin.review("demo-admin", "claim", claim.id, { decision: "approve" }, NOW + 50);
  const claimed = await directory.getBySlug(published!.slug);
  assert.equal(claimed?.claimed, true);
  assert.equal(claimed?.contactSlug, "demo-fictional-community-owner");

  const publicUpdate = await mutations.submitUpdate("demo-member", {
    communityId: published!.id,
    title: "已发布全流程动态",
    summary: "这是负责人提交且经运营审核后可公开的社群动态。",
    occurredAt: NOW + 60,
    sourceUrl: "https://flow-community.example.test/published-update",
  }, NOW + 61);
  await admin.review("demo-admin", "update", publicUpdate.id, { decision: "approve" }, NOW + 62);

  const pendingUpdate = await mutations.submitUpdate("demo-member", {
    communityId: published!.id,
    title: "pending-update-private-token",
    summary: "这条动态仍在等待审核，不得进入公开详情页。",
    occurredAt: NOW + 70,
  }, NOW + 71);
  const changesUpdate = await mutations.submitUpdate("demo-member", {
    communityId: published!.id,
    title: "changes-requested-update-private-token",
    summary: "这条动态被要求修改，不得进入公开详情页。",
    occurredAt: NOW + 80,
  }, NOW + 81);
  await admin.review("demo-admin", "update", changesUpdate.id, { decision: "changes_requested", reason: "private-review-reason-changes" }, NOW + 82);
  const rejectedUpdate = await mutations.submitUpdate("demo-member", {
    communityId: published!.id,
    title: "rejected-update-private-token",
    summary: "这条动态已被拒绝，不得进入公开详情页。",
    occurredAt: NOW + 90,
  }, NOW + 91);
  await admin.review("demo-admin", "update", rejectedUpdate.id, { decision: "reject", reason: "private-review-reason-rejected" }, NOW + 92);

  const hiddenProfiles = [
    ["pending-profile-private-token", null] as const,
    ["changes-profile-private-token", { decision: "changes_requested", reason: "private-profile-reason-changes" } as const] as const,
    ["rejected-profile-private-token", { decision: "reject", reason: "private-profile-reason-rejected" } as const] as const,
  ];
  for (const [name, decision] of hiddenProfiles) {
    const hidden = await mutations.submitProfile("demo-member", "create", null, profile(name, `这是 ${name} 的待审核社群简介，不得进入公开目录。`), NOW + 100 + mutationSequence);
    if (decision) await admin.review("demo-admin", "profile", hidden.id, decision, NOW + 110 + auditSequence);
  }

  const visitorFinalList = await directory.list({});
  const detail = await directory.getBySlug(published!.slug);
  assert.ok(detail);
  assert.deepEqual(detail.updates, [{
    id: publicUpdate.id,
    title: "已发布全流程动态",
    summary: "这是负责人提交且经运营审核后可公开的社群动态。",
    occurredAt: NOW + 60,
    sourceUrl: "https://flow-community.example.test/published-update",
  }]);
  const publicProjection = JSON.stringify({ visitorFinalList, detail });
  for (const forbidden of [
    pendingUpdate.title,
    changesUpdate.title,
    rejectedUpdate.title,
    ...hiddenProfiles.map(([name]) => name),
    evidence,
    "private-evidence.example.test",
    "private-review-reason",
    "private-profile-reason",
    "demo-admin",
    "demo-member",
    "submitterUserId",
    "applicantUserId",
    "reviewedBy",
    "reviewReason",
  ]) assert.equal(publicProjection.includes(forbidden), false, `public projection leaked ${forbidden}`);

  const auditActions = (sqlite.prepare("SELECT action FROM audit_logs WHERE target_type <> 'demo' ORDER BY created_at, id").all() as { action: string }[]).map(({ action }) => action);
  assert.deepEqual(auditActions, [
    "community.profile_approved",
    "community.claim_approved",
    "community.update_published",
    "community.update_changes_requested",
    "community.update_rejected",
    "community.profile_changes_requested",
    "community.profile_rejected",
  ]);

  return { sqlite, detail };
}

export async function renderFullFlowPublicDetail() {
  const result = await exerciseFullFlow();
  try {
    return renderToStaticMarkup(createElement(CommunityProfile, { community: result.detail!, isLoggedIn: false }));
  } finally {
    result.sqlite.close();
  }
}

if (process.env.COMMUNITY_RENDER_FIXTURE === "1") {
  process.stdout.write(await renderFullFlowPublicDetail());
} else {
  test("public read through audited member mutations keeps every non-published and internal field private", async () => {
    const result = await exerciseFullFlow();
    result.sqlite.close();
  });

  test("public projections batch more than 100 communities within D1's bind budget", async () => {
    const sqlite = new DatabaseSync(":memory:");
    sqlite.exec("PRAGMA foreign_keys = ON");
    applyMigrations(sqlite);
    const d1 = new SqliteD1Database(sqlite);
    const db = drizzle(d1 as never);
    await seedDemoData("demo-admin", createDemoSeedRepository(db as never), NOW);

    const insertCommunity = sqlite.prepare(`INSERT INTO communities
      (id, slug, name, summary, primary_city, location_mode, focus_tags_json, official_url, source_url, source_label, publish_status, published_at, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, 'city', '[]', ?, ?, '测试来源', 'published', ?, ?, ?)`);
    for (let index = 0; index < 101; index += 1) {
      const id = `bulk-community-${String(index).padStart(3, "0")}`;
      insertCommunity.run(id, id, `批量社群 ${index}`, "用于验证 D1 参数分批的公开社群。", "广州", `https://example.test/${id}`, `https://example.test/${id}/source`, NOW, NOW, NOW);
    }
    sqlite.prepare("INSERT INTO community_follows (community_id, user_id, created_at) VALUES (?, ?, ?)")
      .run("bulk-community-100", "demo-member", NOW);

    try {
      const result = await createCommunityDirectoryService(createCommunityRepository(db as never)).list({}, "demo-member");
      assert.equal(result.items.length, 104);
      assert.equal(result.items.find(({ id }) => id === "bulk-community-100")?.followed, true);
    } finally {
      sqlite.close();
    }
  });

  test("manager contacts are public only for active or connection-suspended accounts", async () => {
    const sqlite = new DatabaseSync(":memory:");
    sqlite.exec("PRAGMA foreign_keys = ON");
    applyMigrations(sqlite);
    const db = drizzle(new SqliteD1Database(sqlite) as never);
    await seedDemoData("demo-admin", createDemoSeedRepository(db as never), NOW);
    const directory = createCommunityDirectoryService(createCommunityRepository(db as never));
    const slug = "demo-guangzhou-ai-builders";

    try {
      for (const [status, visible] of [
        ["active", true],
        ["connection_suspended", true],
        ["hidden", false],
        ["suspended", false],
        ["deleted", false],
      ] as const) {
        sqlite.prepare("UPDATE users SET status = ? WHERE id = 'demo-member'").run(status);
        const community = await directory.getBySlug(slug);
        assert.equal(Boolean(community?.contactSlug), visible, status);
      }
    } finally {
      sqlite.close();
    }
  });
}
