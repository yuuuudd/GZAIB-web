import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import { getTableConfig } from "drizzle-orm/sqlite-core";
import * as schema from "../db/schema";

test("core schema exports every required table", () => {
  for (const name of [
    "users", "magicLinkTokens", "sessions", "schools", "applications",
    "memberProfiles", "profileVisibility", "contributions", "notifications", "dailyMetrics", "auditLogs",
  ]) assert.ok(name in schema, `missing ${name}`);
  for (const name of ["contactCards", "connectionRequests", "blocks", "reports"]) {
    assert.ok(name in schema, `missing ${name}`);
  }
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
