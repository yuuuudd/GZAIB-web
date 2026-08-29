import { REPORT_CATEGORIES, REPORT_RESOLUTIONS, type ReportInput, type ReportResolution, type SafetyReport } from "./types";

export type BlockedMember = { blockedId: string; displayName: string };
export type SafetyRepository = {
  blockPairAtomic(input: { blockerId: string; blockedId: string; now: number }): Promise<{ created: boolean }>;
  unblock(blockerId: string, blockedId: string): Promise<void>;
  listBlocks(blockerId: string): Promise<BlockedMember[]>;
  resolvePublicMemberId(slug: string): Promise<string | undefined>;
  targetExists(id: string): Promise<boolean>;
  requestBelongsToPair(requestId: string, reporterId: string, targetUserId: string): Promise<boolean>;
  createReport(input: SafetyReport & { createdAt: number }): Promise<SafetyReport>;
  getReportForReporter(id: string, reporterId: string): Promise<SafetyReport | undefined>;
  getReportForAdmin(id: string): Promise<SafetyReport | undefined>;
  listReportsForAdmin(): Promise<SafetyReport[]>;
  resolveReportAtomic(input: { reportId: string; adminId: "demo-admin"; resolution: ReportResolution; now: number; auditId: string }): Promise<SafetyReport | undefined>;
};

export class SafetyServiceError extends Error {
  constructor(readonly code: "invalid_target" | "not_found" | "invalid_report" | "forbidden" | "invalid_resolution" | "state_conflict") { super(code); this.name = "SafetyServiceError"; }
}

function own(record: Record<string, unknown>, key: string): string | undefined {
  const value = record[key];
  return typeof value === "string" ? value : undefined;
}

/** Parses only allowlisted report fields and normalizes text before persistence. */
export function validateReportInput(value: unknown): ReportInput {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new SafetyServiceError("invalid_report");
  const record = value as Record<string, unknown>;
  if (Object.keys(record).some((key) => key !== "targetUserId" && key !== "category" && key !== "description" && key !== "requestId")) throw new SafetyServiceError("invalid_report");
  const targetUserId = own(record, "targetUserId");
  const category = own(record, "category");
  const description = own(record, "description")?.replace(/\s+/g, " ").trim();
  const requestId = record.requestId === undefined ? undefined : own(record, "requestId");
  if (!targetUserId || !category || !REPORT_CATEGORIES.includes(category as ReportInput["category"]) || !description || description.length < 20 || description.length > 1000 || (record.requestId !== undefined && !requestId)) throw new SafetyServiceError("invalid_report");
  return { targetUserId, category: category as ReportInput["category"], description, ...(requestId ? { requestId } : {}) };
}

export function createSafetyService(repository: SafetyRepository, createId: () => string = () => crypto.randomUUID()) {
  return {
    async blockUser(blockerId: string, blockedId: string, now: number) {
      if (!blockerId || !blockedId || blockerId === blockedId || !Number.isFinite(now)) throw new SafetyServiceError("invalid_target");
      // Missing and hidden targets intentionally have the same result, preventing enumeration.
      if (!await repository.targetExists(blockedId)) throw new SafetyServiceError("not_found");
      await repository.blockPairAtomic({ blockerId, blockedId, now });
    },
    resolvePublicMemberId(slug: string) { return repository.resolvePublicMemberId(slug); },
    async unblockUser(blockerId: string, blockedId: string) {
      if (!blockerId || !blockedId || blockerId === blockedId) throw new SafetyServiceError("invalid_target");
      await repository.unblock(blockerId, blockedId);
    },
    listBlockedUsers(blockerId: string) { return repository.listBlocks(blockerId); },
    async submitReport(reporterId: string, input: unknown, now: number): Promise<SafetyReport> {
      if (!reporterId || !Number.isFinite(now)) throw new SafetyServiceError("invalid_report");
      const normalized = validateReportInput(input);
      if (normalized.targetUserId === reporterId || !await repository.targetExists(normalized.targetUserId)) throw new SafetyServiceError("invalid_report");
      if (normalized.requestId && !await repository.requestBelongsToPair(normalized.requestId, reporterId, normalized.targetUserId)) throw new SafetyServiceError("invalid_report");
      return repository.createReport({ id: createId(), reporterId, ...normalized, status: "open", createdAt: now });
    },
    async getOwnReport(reporterId: string, reportId: string) {
      const report = await repository.getReportForReporter(reportId, reporterId);
      return report ? { id: report.id, category: report.category, status: report.status, resolution: report.resolution ? "已由运营处理" : undefined } : undefined;
    },
    listReportsForAdmin(adminId: string) {
      if (adminId !== "demo-admin") throw new SafetyServiceError("forbidden");
      return repository.listReportsForAdmin();
    },
    async resolveReport(adminId: string, reportId: string, resolution: ReportResolution, now: number): Promise<SafetyReport> {
      if (adminId !== "demo-admin") throw new SafetyServiceError("forbidden");
      if (!reportId || !REPORT_RESOLUTIONS.includes(resolution) || !Number.isFinite(now)) throw new SafetyServiceError("invalid_resolution");
      const result = await repository.resolveReportAtomic({ reportId, adminId, resolution, now, auditId: createId() });
      if (!result) throw new SafetyServiceError("state_conflict");
      return result;
    },
  };
}

export async function createRuntimeSafetyService() {
  const [{ getDb }, { createSafetyRepository }] = await Promise.all([import("../../db"), import("../../lib/db/repositories/safety")]);
  return createSafetyService(createSafetyRepository(getDb()));
}
