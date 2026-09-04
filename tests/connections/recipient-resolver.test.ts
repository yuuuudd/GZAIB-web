import assert from "node:assert/strict";
import test from "node:test";
import { SQLiteSyncDialect } from "drizzle-orm/sqlite-core";
import { createPublicConnectionMemberResolver, createPublicConnectionRecipientResolver } from "../../features/connections/recipient-resolver";

test("public connection recipient resolution includes an admin with a normal approved published profile", async () => {
  let predicate: unknown;
  const builder = {
    innerJoin() { return builder; },
    where(condition: unknown) { predicate = condition; return Promise.resolve([{ id: "admin-1" }]); },
  };
  const db = { select: () => ({ from: () => builder }) };
  const resolve = createPublicConnectionRecipientResolver(db as never);

  assert.equal(await resolve("approved-admin"), "admin-1");
  const query = new SQLiteSyncDialect().sqlToQuery(predicate as never);
  assert.match(query.sql, /"users"\."role" in \(\?, \?\)/);
  assert.ok(query.params.includes("member"));
  assert.ok(query.params.includes("admin"));
});

test("public connection member resolution returns only the small card used by connection screens", async () => {
  const builder = {
    innerJoin() { return builder; },
    where() { return builder; },
    limit() { return Promise.resolve([{ slug: "peer", nickname: "共建者 B", avatarKey: "avatars/peer.png", school: "中山大学", city: "广州", intro: "正在做校园 AI 项目", skillsJson: '["AI应用"]' }]); },
  };
  const db = { select: () => ({ from: () => builder }) };
  assert.deepEqual(await createPublicConnectionMemberResolver(db as never)("member-2"), {
    slug: "peer", nickname: "共建者 B", avatarUrl: "/api/avatars/avatars/peer.png", school: "中山大学", city: "广州", intro: "正在做校园 AI 项目", skills: ["AI应用"],
  });
});
