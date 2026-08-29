import assert from "node:assert/strict";
import test from "node:test";
import { SafetyServiceError, createSafetyService, type SafetyRepository } from "../../features/safety/service";

test("only the fixed admin can resolve an open report and sanctions are audited atomically", async () => {
  const calls: unknown[] = [];
  const repository: SafetyRepository = {
    blockPairAtomic: async () => ({ created: true }), unblock: async () => undefined, listBlocks: async () => [], resolvePublicMemberId: async () => undefined, targetExists: async () => true,
    requestBelongsToPair: async () => true, createReport: async (input) => ({ ...input, status: "open" }), getReportForReporter: async () => undefined,
    getReportForAdmin: async () => ({ id: "r1", reporterId: "u1", targetUserId: "u2", category: "harassment", description: "minimized", status: "open" }),
    listReportsForAdmin: async () => [],
    resolveReportAtomic: async (input) => { calls.push(input); return { id: "r1", reporterId: "u1", targetUserId: "u2", category: "harassment", description: "minimized", status: input.resolution === "dismiss" ? "dismissed" : "resolved", resolution: input.resolution }; },
  };
  const service = createSafetyService(repository, () => "id-1");
  await assert.rejects(() => service.resolveReport("u1", "r1", "warn", 1), (error: unknown) => error instanceof SafetyServiceError && error.code === "forbidden");
  const resolved = await service.resolveReport("demo-admin", "r1", "suspend_connections", 1);
  assert.equal(resolved.status, "resolved");
  assert.deepEqual(calls[0], { reportId: "r1", adminId: "demo-admin", resolution: "suspend_connections", now: 1, auditId: "id-1" });
  await assert.rejects(() => service.resolveReport("demo-admin", "r1", "delete" as never, 1), /invalid_resolution/i);
});

test("same-millisecond duplicate or conflicting report resolutions admit one winner", async () => {
  let open = true;
  let audits = 0;
  let sanctions = 0;
  const repository: SafetyRepository = {
    blockPairAtomic: async () => ({ created: true }), unblock: async () => undefined, listBlocks: async () => [], resolvePublicMemberId: async () => undefined, targetExists: async () => true, requestBelongsToPair: async () => true,
    createReport: async (input) => ({ ...input, status: "open" }), getReportForReporter: async () => undefined, getReportForAdmin: async () => undefined, listReportsForAdmin: async () => [],
    resolveReportAtomic: async (input) => { if (!open) return undefined; open = false; audits += 1; if (input.resolution === "suspend_connections") sanctions += 1; return { id: input.reportId, reporterId: "u1", targetUserId: "u2", category: "spam", description: "minimized", status: "resolved", resolution: input.resolution }; },
  };
  const service = createSafetyService(repository, (() => { let n = 0; return () => `audit-${++n}`; })());
  const results = await Promise.allSettled([service.resolveReport("demo-admin", "r1", "suspend_connections", 9), service.resolveReport("demo-admin", "r1", "dismiss", 9)]);
  assert.equal(results.filter((result) => result.status === "fulfilled").length, 1);
  assert.equal(audits, 1);
  assert.equal(sanctions, 1);
});
