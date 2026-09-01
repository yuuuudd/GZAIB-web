import assert from "node:assert/strict";
import test from "node:test";
import { SQLiteSyncDialect } from "drizzle-orm/sqlite-core";
import { activityProposals, auditLogs, blocks, connectionRequests, contactCards, reports } from "../../db/schema";
import { createAccountDeletionRepository } from "../../features/identity/account-deletion";
import { createSafetyRepository } from "../../lib/db/repositories/safety";

type CapturedOperation = {
  kind: "insert-values" | "insert-select" | "update" | "delete";
  table: unknown;
  values?: Record<string, unknown>;
  query?: unknown;
  condition?: unknown;
};

function captureDb(firstChanges = 1) {
  let latestBatch: CapturedOperation[] = [];
  const db = {
    insert(table: unknown) {
      return {
        values(values: Record<string, unknown>) {
          const operation: CapturedOperation = { kind: "insert-values", table, values };
          return { onConflictDoNothing: () => operation };
        },
        select(query: unknown) { return { kind: "insert-select", table, query } satisfies CapturedOperation; },
      };
    },
    update(table: unknown) {
      return { set: (values: Record<string, unknown>) => ({ where: (condition: unknown) => ({ kind: "update", table, values, condition } satisfies CapturedOperation) }) };
    },
    delete(table: unknown) {
      return { where: (condition: unknown) => ({ kind: "delete", table, condition } satisfies CapturedOperation) };
    },
    async batch(operations: CapturedOperation[]) {
      latestBatch = operations;
      return operations.map((_, index) => ({ meta: { changes: index === 0 ? firstChanges : 0 } }));
    },
  };
  return { db, latestBatch: () => latestBatch };
}

function query(value: unknown) {
  return new SQLiteSyncDialect().sqlToQuery(value as never);
}

test("D1 block batch inserts once then cancels pending requests in both directions", async () => {
  const capture = captureDb(1);
  const result = await createSafetyRepository(capture.db as never).blockPairAtomic({ blockerId: "member-a", blockedId: "member-b", now: 9 });
  assert.equal(result.created, true);
  const operations = capture.latestBatch();
  assert.equal(operations.length, 2);
  assert.equal(operations[0]?.table, blocks);
  assert.equal(operations[1]?.table, connectionRequests);
  assert.equal(operations[1]?.values?.status, "cancelled_by_block");
  const predicate = query(operations[1]?.condition);
  assert.ok(predicate.params.includes("pending"));
  assert.equal(predicate.params.filter((value) => value === "member-a").length >= 2, true);
  assert.equal(predicate.params.filter((value) => value === "member-b").length >= 2, true);

  const duplicate = captureDb(0);
  assert.equal((await createSafetyRepository(duplicate.db as never).blockPairAtomic({ blockerId: "member-a", blockedId: "member-b", now: 10 })).created, false);
});

test("D1 report resolution gates audit on changes and sanction on this audit id", async () => {
  const capture = captureDb(0);
  const result = await createSafetyRepository(capture.db as never).resolveReportAtomic({
    reportId: "report-1", adminId: "demo-admin", resolution: "suspend_connections", now: 9, auditId: "audit-1",
  });
  assert.equal(result, undefined);
  const operations = capture.latestBatch();
  assert.equal(operations.length, 3);
  assert.equal(operations[0]?.table, reports);
  assert.equal(operations[1]?.table, auditLogs);
  assert.match(query(operations[1]?.query).sql, /changes\(\) = 1/i);
  assert.ok(query(operations[1]?.query).params.includes("audit-1"));
  assert.equal(operations[2]?.values?.status, "connection_suspended");
  const sanction = query(operations[2]?.condition);
  assert.match(sanction.sql, /audit_logs/i);
  assert.ok(sanction.params.includes("audit-1"));
});

test("safety target resolution accepts every counterpart state visible in an inbox", async () => {
  let predicate: unknown;
  const builder = {
    innerJoin: () => builder,
    where: (condition: unknown) => { predicate = condition; return builder; },
    limit: async () => [],
  };
  const db = { select: () => ({ from: () => builder }) };
  await createSafetyRepository(db as never).resolvePublicMemberId("member-b");
  const resolved = query(predicate);
  assert.ok(resolved.params.includes("active"));
  assert.ok(resolved.params.includes("connection_suspended"));
});

test("account deletion keeps connection cleanup inside the guarded batch", async () => {
  const capture = captureDb(1);
  const result = await createAccountDeletionRepository(capture.db as never).deleteAccountAtomic({
    userId: "member-a", deletedAt: 9, auditId: "audit-delete", audit: {
      targetType: "member", targetId: "member-a", action: "member.self_deleted", createdAt: 9, diffJson: "{}",
    },
  });
  assert.equal(result.deleted, true);
  const operations = capture.latestBatch();
  assert.equal(operations.length, 9);
  assert.equal(operations[5]?.table, activityProposals);
  assert.equal(operations[6]?.table, contactCards);
  assert.equal(operations[7]?.table, connectionRequests);
  assert.equal(operations[7]?.values?.status, "cancelled_by_block");
  assert.equal(operations[8]?.table, blocks);
  for (const operation of operations.slice(1)) {
    const predicate = query(operation.condition);
    assert.ok(predicate.params.includes("audit-delete"), "every cleanup mutation is gated by this deletion audit");
  }
});
