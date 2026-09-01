import type { AuditRecord } from "../admin/authorization";
import type { getDb } from "../../db";
import * as schema from "../../db/schema";
import * as drizzle from "drizzle-orm";
import { clearSession } from "./session";
import type { Session } from "./types";

export const ACCOUNT_DELETION_CONFIRMATION = "删除我的账号";

export type MinimalAccountDeletionAudit = Pick<AuditRecord, "targetId" | "createdAt"> & {
  actorUserId: string | null;
  targetType: "member";
  action: "member.self_deleted" | "member.deleted";
  diffJson: "{}";
};

export type AccountDeletionRepository = {
  deleteAccountAtomic(input: {
    userId: string;
    deletedAt: number;
    auditId: string;
    audit: MinimalAccountDeletionAudit;
  }): Promise<{ deleted: boolean }>;
};

export function createAccountDeletionService(
  repository: AccountDeletionRepository,
  createAuditId: () => string = () => crypto.randomUUID(),
) {
  return {
    async deleteOwnAccount(userId: string, confirmation: unknown, now: number): Promise<void> {
      if (!userId || confirmation !== ACCOUNT_DELETION_CONFIRMATION) throw new Error("Invalid account deletion confirmation");
      const result = await repository.deleteAccountAtomic({
        userId,
        deletedAt: now,
        auditId: createAuditId(),
        audit: {
          actorUserId: null,
          targetType: "member",
          targetId: userId,
          action: "member.self_deleted",
          createdAt: now,
          diffJson: "{}",
        },
      });
      if (!result.deleted) throw new Error("Account deletion state changed before commit");
    },
  };
}

export type AccountDeletionRequestDependencies = {
  requireActiveSession(request: Request): Promise<Session>;
  deleteOwnAccount(userId: string, confirmation: unknown, now: number): Promise<void>;
  now(): number;
};

/** HTTP adapter kept injectable so cookie clearing and server-owned identity are tested together. */
export async function handleAccountDeletionRequest(
  request: Request,
  dependencies: AccountDeletionRequestDependencies,
): Promise<Response> {
  let session: Session;
  try {
    session = await dependencies.requireActiveSession(request);
  } catch {
    return Response.json({ error: "请先登录有效账号" }, { status: 401 });
  }
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "请输入账号删除确认短语" }, { status: 400 });
  }
  if (!body || typeof body !== "object" || Array.isArray(body)
    || Object.keys(body).length !== 1 || !("confirmation" in body)) {
    return Response.json({ error: "请输入账号删除确认短语" }, { status: 400 });
  }
  try {
    await dependencies.deleteOwnAccount(session.identity.id, (body as { confirmation: unknown }).confirmation, dependencies.now());
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "暂时无法删除账号" }, { status: 400 });
  }
  return clearSession(new Response(null, { status: 204 }));
}

export function createAccountDeletionRepository(db: ReturnType<typeof getDb>): AccountDeletionRepository {
  return {
    async deleteAccountAtomic(input) {
      const gateAudit = db.insert(schema.auditLogs).select(drizzle.sql`
        select ${input.auditId}, ${input.audit.actorUserId}, ${input.audit.targetType}, ${input.audit.targetId},
          ${input.audit.action}, ${input.audit.diffJson}, ${input.audit.createdAt}
        from ${schema.users}
        where ${schema.users.id} = ${input.userId}
          and ${schema.users.status} <> 'deleted'
      `);
      const auditExists = drizzle.sql`exists (
        select 1 from ${schema.auditLogs} where ${schema.auditLogs.id} = ${input.auditId}
      )`;
      const [gateResult] = await db.batch([
        gateAudit,
        db.update(schema.users).set({ status: "deleted", updatedAt: input.deletedAt }).where(drizzle.and(
          drizzle.eq(schema.users.id, input.userId), auditExists,
        )),
        db.update(schema.memberProfiles).set({ publishStatus: "unpublished", updatedAt: input.deletedAt }).where(drizzle.and(
          drizzle.eq(schema.memberProfiles.userId, input.userId), auditExists,
        )),
        db.update(schema.applications).set({ status: "withdrawn", updatedAt: input.deletedAt }).where(drizzle.and(
          drizzle.eq(schema.applications.userId, input.userId),
          drizzle.eq(schema.applications.status, "pending"),
          auditExists,
        )),
        db.update(schema.sessions).set({ revokedAt: input.deletedAt }).where(drizzle.and(
          drizzle.eq(schema.sessions.userId, input.userId),
          drizzle.isNull(schema.sessions.revokedAt),
          auditExists,
        )),
        db.delete(schema.activityProposals).where(drizzle.and(drizzle.eq(schema.activityProposals.userId, input.userId), auditExists)),
        // These connection-era records are private capability state, not moderation history.
        db.delete(schema.contactCards).where(drizzle.and(drizzle.eq(schema.contactCards.userId, input.userId), auditExists)),
        db.update(schema.connectionRequests).set({ status: "cancelled_by_block", resolvedAt: input.deletedAt, updatedAt: input.deletedAt }).where(drizzle.and(
          drizzle.eq(schema.connectionRequests.status, "pending"),
          drizzle.or(drizzle.eq(schema.connectionRequests.senderId, input.userId), drizzle.eq(schema.connectionRequests.recipientId, input.userId)),
          auditExists,
        )),
        // A deleted account must not keep controlling another member's access; reports/audits remain retained.
        db.delete(schema.blocks).where(drizzle.and(drizzle.eq(schema.blocks.blockerId, input.userId), auditExists)),
      ]);
      return { deleted: ((gateResult as { meta?: { changes?: number } }).meta?.changes ?? 0) === 1 };
    },
  };
}

export async function createRuntimeAccountDeletionService() {
  const { getDb } = await import("../../db");
  return createAccountDeletionService(createAccountDeletionRepository(getDb()));
}

export async function deleteOwnAccount(userId: string, confirmation: unknown, now: number): Promise<void> {
  return (await createRuntimeAccountDeletionService()).deleteOwnAccount(userId, confirmation, now);
}
