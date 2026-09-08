import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import { getTableConfig } from "drizzle-orm/sqlite-core";
import * as schema from "../db/schema";

test("core schema exports every required table", () => {
  for (const name of [
    "users", "magicLinkTokens", "sessions", "passwordCredentials", "schools", "applications",
    "memberProfiles", "profileVisibility", "contributions", "notifications", "dailyMetrics", "auditLogs",
  ]) assert.ok(name in schema, `missing ${name}`);
  for (const name of ["contactCards", "connectionRequests", "blocks", "reports"]) {
    assert.ok(name in schema, `missing ${name}`);
  }
});

test("password credential migration stores only a salted irreversible digest", () => {
  const migrationPath = "drizzle/0009_password_credentials.sql";
  assert.ok(existsSync(migrationPath), `missing ${migrationPath}`);
  const database = new DatabaseSync(":memory:");
  try {
    database.exec("PRAGMA foreign_keys = ON; CREATE TABLE users (id text PRIMARY KEY NOT NULL)");
    database.exec(readFileSync(migrationPath, "utf8"));
    const columns = database.prepare("PRAGMA table_info(password_credentials)").all() as Array<{ name: string }>;
    assert.deepEqual(columns.map(({ name }) => name), ["user_id", "password_hash", "salt", "iterations", "updated_at"]);
    assert.throws(() => database.exec("INSERT INTO password_credentials VALUES ('missing', 'hash', 'salt', 600000, 1)"), /FOREIGN KEY constraint failed/);
  } finally {
    database.close();
  }
});

test("school province migrations backfill legacy Wuhan and Shanghai schools", () => {
  const database = new DatabaseSync(":memory:");
  try {
    database.exec("CREATE TABLE schools (id text PRIMARY KEY, name text NOT NULL, city text NOT NULL)");
    database.exec("INSERT INTO schools VALUES ('sjtu', '上海交通大学(闵行本部校区)', '上海市'), ('whu', '武汉大学', '武汉市'), ('sysu', '中山大学', '广州')");
    for (const migrationPath of ["drizzle/0012_school_provinces.sql", "drizzle/0013_repair_legacy_school_provinces.sql"]) {
      for (const statement of readFileSync(migrationPath, "utf8").split("--> statement-breakpoint")) {
        if (statement.trim()) database.exec(statement);
      }
    }
    const rows = database.prepare("SELECT id, province FROM schools ORDER BY id").all().map((row) => ({ ...row }));
    assert.deepEqual(rows, [
      { id: "sjtu", province: "上海" },
      { id: "sysu", province: "广东" },
      { id: "whu", province: "湖北" },
    ]);
  } finally {
    database.close();
  }
});

test("school schema keeps city and province-city lookup indexes", () => {
  const indexes = getTableConfig(schema.schools).indexes.map((candidate) => candidate.config.name);
  assert.ok(indexes.includes("idx_schools_city"));
  assert.ok(indexes.includes("idx_schools_province_city"));
});

test("community foundation schema exports every required table", () => {
  for (const name of [
    "communities", "communityProfileSubmissions", "communityClaims",
    "communityManagers", "communityUpdates", "communityFollows",
  ]) assert.ok(name in schema, `missing ${name}`);
});

test("pending community claims have an executable partial unique index while reviewed claims remain resubmittable", () => {
  const indexName = "ux_community_claims_pending_applicant";
  const config = getTableConfig(schema.communityClaims);
  const schemaIndex = config.indexes.find((candidate) => candidate.config.name === indexName);
  assert.ok(schemaIndex, `missing ${indexName} from Drizzle schema`);
  assert.equal(schemaIndex.config.unique, true);
  assert.ok(schemaIndex.config.where, `${indexName} must be partial`);

  const migrationPath = "drizzle/0005_pending_community_claim_uniqueness.sql";
  assert.ok(existsSync(migrationPath), `missing ${migrationPath}`);
  const database = new DatabaseSync(":memory:");
  try {
    database.exec("CREATE TABLE users (id text PRIMARY KEY NOT NULL)");
    for (const path of ["drizzle/0004_ai_community_foundation.sql", migrationPath]) {
      for (const statement of readFileSync(path, "utf8").split("--> statement-breakpoint")) {
        if (statement.trim()) database.exec(statement);
      }
    }
    const storedIndex = database.prepare("SELECT sql FROM sqlite_master WHERE type = 'index' AND name = ?").get(indexName) as { sql?: string } | undefined;
    assert.match(storedIndex?.sql ?? "", /UNIQUE INDEX.+applicant_user_id.+community_id.+WHERE.+status.+pending/is);

    database.exec("INSERT INTO users (id) VALUES ('member-1'); INSERT INTO communities (id, slug, name, summary, location_mode, official_url, source_url, source_label, publish_status, created_at, updated_at) VALUES ('community-1', 'community-1', 'Community', 'Summary long enough', 'online', 'https://example.com', 'https://example.com/source', 'Source', 'published', 1, 1)");
    const insert = database.prepare("INSERT INTO community_claims (id, community_id, applicant_user_id, evidence, status, submitted_at, created_at, updated_at) VALUES (?, 'community-1', 'member-1', 'evidence long enough for review', 'pending', 1, 1, 1)");
    insert.run("claim-1");
    assert.throws(() => insert.run("claim-2"), /UNIQUE constraint failed/);
    database.exec("UPDATE community_claims SET status = 'changes_requested' WHERE id = 'claim-1'");
    insert.run("claim-2");
    assert.equal((database.prepare("SELECT count(*) AS count FROM community_claims").get() as { count: number }).count, 2);
  } finally {
    database.close();
  }

  const journal = JSON.parse(readFileSync("drizzle/meta/_journal.json", "utf8")) as { entries: Array<{ idx: number; tag: string }> };
  assert.ok(journal.entries.some((entry) => entry.idx === 5 && entry.tag === "0005_pending_community_claim_uniqueness"));
});

test("real community migration publishes the seven approved sources and excludes withheld hackathons", () => {
  const migrationPath = "drizzle/0006_publish_verified_ai_communities.sql";
  assert.ok(existsSync(migrationPath), `missing ${migrationPath}`);
  const database = new DatabaseSync(":memory:");
  try {
    database.exec("CREATE TABLE users (id text PRIMARY KEY NOT NULL)");
    for (const path of ["drizzle/0004_ai_community_foundation.sql", migrationPath]) {
      for (const statement of readFileSync(path, "utf8").split("--> statement-breakpoint")) {
        if (statement.trim()) database.exec(statement);
      }
    }
    const rows = database.prepare("SELECT slug, name, publish_status, official_url FROM communities ORDER BY slug").all() as Array<{ slug: string; name: string; publish_status: string; official_url: string }>;
    assert.equal(rows.length, 7);
    assert.ok(rows.every((row) => row.publish_status === "published"));
    assert.ok(rows.every((row) => new URL(row.official_url).protocol === "https:"));
    assert.deepEqual(rows.map((row) => row.slug), [
      "datawhale", "dongguan-industrial-ai-community", "gdg-guangzhou", "hackathonweekly",
      "modelscope", "opc-dongguan", "openi",
    ]);
    assert.doesNotMatch(rows.map((row) => row.name).join(" "), /深客松|肇客松|莞客松/);
  } finally {
    database.close();
  }

  const journal = JSON.parse(readFileSync("drizzle/meta/_journal.json", "utf8")) as { entries: Array<{ idx: number; tag: string }> };
  assert.ok(journal.entries.some((entry) => entry.idx === 6 && entry.tag === "0006_publish_verified_ai_communities"));
});
