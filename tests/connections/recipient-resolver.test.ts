import assert from "node:assert/strict";
import test from "node:test";
import { SQLiteSyncDialect } from "drizzle-orm/sqlite-core";
import { createPublicConnectionRecipientResolver } from "../../features/connections/recipient-resolver";

test("public connection recipient resolution treats an approved published admin as unavailable", async () => {
  let predicate: unknown;
  const builder = {
    innerJoin() { return builder; },
    where(condition: unknown) { predicate = condition; return Promise.resolve([]); },
  };
  const db = { select: () => ({ from: () => builder }) };
  const resolve = createPublicConnectionRecipientResolver(db as never);

  assert.equal(await resolve("approved-admin"), undefined);
  const query = new SQLiteSyncDialect().sqlToQuery(predicate as never);
  assert.match(query.sql, /"users"\."role" = \?/);
  assert.ok(query.params.includes("member"));
});
