import assert from "node:assert/strict";
import test from "node:test";
import { SQLiteSyncDialect } from "drizzle-orm/sqlite-core";
import { createPublicConnectionRecipientResolver } from "../../features/connections/recipient-resolver";

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
