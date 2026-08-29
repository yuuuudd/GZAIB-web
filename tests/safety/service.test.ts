import assert from "node:assert/strict";
import test from "node:test";
import { SafetyServiceError, createSafetyService, validateReportInput, type SafetyRepository } from "../../features/safety/service";

function memoryRepository() {
  const blocks = new Set<string>();
  const requests = new Map([
    ["outgoing", { id: "outgoing", senderId: "u1", recipientId: "u2", status: "pending" }],
    ["incoming", { id: "incoming", senderId: "u2", recipientId: "u1", status: "pending" }],
  ]);
  const reports = new Map<string, { id: string; reporterId: string; targetUserId: string; category: string; description: string; status: "open" | "resolved" | "dismissed"; resolution?: string }>();
  const batches: unknown[][] = [];
  const repository: SafetyRepository = {
    async blockPairAtomic(input) {
      batches.push([input]);
      blocks.add(`${input.blockerId}:${input.blockedId}`);
      for (const request of requests.values()) if (request.status === "pending" && ((request.senderId === input.blockerId && request.recipientId === input.blockedId) || (request.senderId === input.blockedId && request.recipientId === input.blockerId))) request.status = "cancelled_by_block";
      return { created: true };
    },
    async unblock(blockerId, blockedId) { blocks.delete(`${blockerId}:${blockedId}`); },
    async listBlocks(blockerId) { return [...blocks].filter((value) => value.startsWith(`${blockerId}:`)).map((value) => ({ blockedId: value.split(":")[1]!, displayName: "成员" })); },
    async resolvePublicMemberId(slug) { return slug === "member-two" ? "u2" : undefined; },
    async targetExists(id) { return id === "u2"; },
    async requestBelongsToPair(requestId, reporterId, targetUserId) { const item = requests.get(requestId); return Boolean(item && ((item.senderId === reporterId && item.recipientId === targetUserId) || (item.senderId === targetUserId && item.recipientId === reporterId))); },
    async createReport(input) { reports.set(input.id, { ...input, status: "open" }); return reports.get(input.id)!; },
    async getReportForReporter(id, reporterId) { const report = reports.get(id); return report?.reporterId === reporterId ? report : undefined; },
    async getReportForAdmin(id) { return reports.get(id); },
    async listReportsForAdmin() { return [...reports.values()]; },
    async resolveReportAtomic(input) { batches.push([input]); const report = reports.get(input.reportId); if (!report || report.status !== "open") return undefined; report.status = input.resolution === "dismiss" ? "dismissed" : "resolved"; report.resolution = input.resolution; return report; },
  };
  return { repository, requests, reports, blocks, batches };
}

test("block rejects self targets and atomically cancels both pending directions", async () => {
  const store = memoryRepository();
  const service = createSafetyService(store.repository, () => "report-1");
  await assert.rejects(() => service.blockUser("u1", "u1", 1), (error: unknown) => error instanceof SafetyServiceError && error.code === "invalid_target");

  await service.blockUser("u1", "u2", 1);
  assert.equal(store.requests.get("outgoing")?.status, "cancelled_by_block");
  assert.equal(store.requests.get("incoming")?.status, "cancelled_by_block");
  assert.equal(store.batches.length, 1, "a single atomic repository operation owns block plus cancellations");
  await service.unblockUser("u1", "u2");
  assert.equal(store.requests.get("outgoing")?.status, "cancelled_by_block", "unblock never restores a cancelled request");
});

test("report input is normalized, allowlisted, and tied to an existing pair request", async () => {
  assert.deepEqual(validateReportInput({ targetUserId: "u2", category: "spam", description: "  这是一段足够长的举报说明，用来描述连接中的垃圾信息。  ", requestId: "outgoing" }), {
    targetUserId: "u2", category: "spam", description: "这是一段足够长的举报说明，用来描述连接中的垃圾信息。", requestId: "outgoing",
  });
  assert.throws(() => validateReportInput({ targetUserId: "u2", category: "invented", description: "这是一段足够长的举报说明，用来描述连接中的垃圾信息。" }), SafetyServiceError);
  const store = memoryRepository();
  const service = createSafetyService(store.repository, () => "report-1");
  await assert.rejects(() => service.submitReport("u1", { targetUserId: "u2", category: "spam", description: "这是一段足够长的举报说明，用来描述连接中的垃圾信息。", requestId: "unrelated" }, 1), /invalid_report/i);
  const report = await service.submitReport("u1", { targetUserId: "u2", category: "spam", description: "这是一段足够长的举报说明，用来描述连接中的垃圾信息。", requestId: "outgoing" }, 1);
  assert.equal(report.id, "report-1");
  assert.equal(await service.getOwnReport("u2", report.id), undefined, "the reported member cannot enumerate reporter reports");
});
