import { and, asc, eq, or, sql } from "drizzle-orm";
import { auditLogs, blocks, connectionRequests, memberProfiles, reports, users } from "../../../db/schema";
import type { getDb } from "../../../db";
import type { SafetyRepository } from "../../../features/safety/service";
import type { ReportResolution } from "../../../features/safety/types";

type Db = ReturnType<typeof getDb>;
function pair(left: string, right: string) { return or(and(eq(connectionRequests.senderId, left), eq(connectionRequests.recipientId, right)), and(eq(connectionRequests.senderId, right), eq(connectionRequests.recipientId, left))); }
function statusFor(resolution: ReportResolution): "connection_suspended" | "hidden" | "suspended" | undefined { return resolution === "suspend_connections" ? "connection_suspended" : resolution === "hide_profile" ? "hidden" : resolution === "suspend_account" ? "suspended" : undefined; }

export function createSafetyRepository(db: Db): SafetyRepository {
  return {
    async blockPairAtomic(input) {
      const insert = db.insert(blocks).values({ blockerId: input.blockerId, blockedId: input.blockedId, createdAt: input.now }).onConflictDoNothing();
      const cancel = db.update(connectionRequests).set({ status: "cancelled_by_block", resolvedAt: input.now, updatedAt: input.now }).where(and(eq(connectionRequests.status, "pending"), pair(input.blockerId, input.blockedId), sql`exists (select 1 from blocks where blocker_id = ${input.blockerId} and blocked_id = ${input.blockedId})`));
      const [result] = await db.batch([insert, cancel]);
      return { created: ((result as { meta?: { changes?: number } }).meta?.changes ?? 0) === 1 };
    },
    async unblock(blockerId, blockedId) { await db.delete(blocks).where(and(eq(blocks.blockerId, blockerId), eq(blocks.blockedId, blockedId))); },
    async listBlocks(blockerId) {
      const rows = await db.select({ blockedId: blocks.blockedId, displayName: memberProfiles.nickname, status: users.status }).from(blocks).innerJoin(users, eq(users.id, blocks.blockedId)).leftJoin(memberProfiles, eq(memberProfiles.userId, users.id)).where(eq(blocks.blockerId, blockerId)).orderBy(asc(blocks.createdAt));
      return rows.map((row) => ({ blockedId: row.blockedId, displayName: row.status === "deleted" ? "已注销成员" : row.displayName ?? "成员" }));
    },
    async resolvePublicMemberId(slug) { const [row] = await db.select({ id: users.id }).from(memberProfiles).innerJoin(users, eq(users.id, memberProfiles.userId)).where(and(eq(memberProfiles.slug, slug), eq(memberProfiles.publishStatus, "published"), eq(users.status, "active"))).limit(1); return row?.id; },
    async targetExists(id) { const [row] = await db.select({ id: users.id }).from(users).where(and(eq(users.id, id), eq(users.status, "active"))).limit(1); return Boolean(row); },
    async requestBelongsToPair(requestId, reporterId, targetUserId) { const [row] = await db.select({ id: connectionRequests.id }).from(connectionRequests).where(and(eq(connectionRequests.id, requestId), pair(reporterId, targetUserId))).limit(1); return Boolean(row); },
    async createReport(input) { await db.insert(reports).values({ id: input.id, reporterId: input.reporterId, targetUserId: input.targetUserId, connectionRequestId: input.requestId, category: input.category, description: input.description, status: "open", createdAt: input.createdAt }); return { id: input.id, reporterId: input.reporterId, targetUserId: input.targetUserId, category: input.category, description: input.description, requestId: input.requestId, status: "open" }; },
    async getReportForReporter(id, reporterId) { const [row] = await db.select().from(reports).where(and(eq(reports.id, id), eq(reports.reporterId, reporterId))).limit(1); return row ? { id: row.id, reporterId: row.reporterId, targetUserId: row.targetUserId, category: row.category as never, description: row.description, requestId: row.connectionRequestId ?? undefined, status: row.status as never, resolution: row.resolution as never } : undefined; },
    async getReportForAdmin(id) { const [row] = await db.select().from(reports).where(eq(reports.id, id)).limit(1); return row ? { id: row.id, reporterId: row.reporterId, targetUserId: row.targetUserId, category: row.category as never, description: row.description, requestId: row.connectionRequestId ?? undefined, status: row.status as never, resolution: row.resolution as never } : undefined; },
    async listReportsForAdmin() { const rows = await db.select().from(reports).orderBy(asc(reports.createdAt)); return rows.map((row) => ({ id: row.id, reporterId: row.reporterId, targetUserId: row.targetUserId, category: row.category as never, description: row.description, requestId: row.connectionRequestId ?? undefined, status: row.status as never, resolution: row.resolution as never })); },
    async resolveReportAtomic(input) {
      const status = input.resolution === "dismiss" ? "dismissed" : "resolved";
      const sanction = statusFor(input.resolution);
      const update = db.update(reports).set({ status, resolution: input.resolution, resolvedAt: input.now, resolvedBy: input.adminId }).where(and(eq(reports.id, input.reportId), eq(reports.status, "open")));
      const audit = db.insert(auditLogs).select(sql`select ${input.auditId}, ${input.adminId}, 'member', target_user_id, ${`report.${input.resolution}`}, '{}', ${input.now} from reports where id = ${input.reportId} and status = ${status} and resolved_at = ${input.now}`);
      const operations: [typeof update, typeof audit, ...unknown[]] = [update, audit];
      if (sanction) operations.push(db.update(users).set({ status: sanction, updatedAt: input.now }).where(and(eq(users.id, sql`(select target_user_id from reports where id = ${input.reportId} and status = ${status} and resolved_at = ${input.now})`), eq(users.status, "active"))) as never);
      const results = await db.batch(operations as never) as Array<{ meta?: { changes?: number } }>;
      if ((results[0]?.meta?.changes ?? 0) !== 1) return undefined;
      return this.getReportForAdmin(input.reportId);
    },
  };
}
