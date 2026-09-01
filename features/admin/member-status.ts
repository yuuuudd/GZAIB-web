import type { AuditRecord } from "./authorization";
import { isAuthorizedAdminId } from "./identity";
import type { AccountDeletionRepository } from "../identity/account-deletion";

export const MEMBER_STATUS_ACTIONS = ["hide", "restore", "suspend_connections", "suspend_account", "delete"] as const;
export type MemberStatusAction = (typeof MEMBER_STATUS_ACTIONS)[number];
export type MemberAccountStatus = "active" | "hidden" | "connection_suspended" | "suspended" | "deleted";

export type MemberStatusRepository = {
  applyStatusAtomic(input: { memberId: string; status: Exclude<MemberAccountStatus, "deleted">; audit: AuditRecord; updatedAt: number }): Promise<void>;
  deleteAccountAtomic: AccountDeletionRepository["deleteAccountAtomic"];
};

const transitions: Record<Exclude<MemberStatusAction, "delete">, { status: Exclude<MemberAccountStatus, "deleted">; audit: AuditRecord["action"] }> = {
  hide: { status: "hidden", audit: "member.hidden" },
  restore: { status: "active", audit: "member.restored" },
  suspend_connections: { status: "connection_suspended", audit: "member.connections_suspended" },
  suspend_account: { status: "suspended", audit: "member.account_suspended" },
};

/** Canonical status/audit mapping shared by direct admin actions and safety sanctions. */
export function memberTransitionForSafetyResolution(resolution: "hide_profile" | "suspend_connections" | "suspend_account" | "warn" | "dismiss") {
  if (resolution === "hide_profile") return transitions.hide;
  if (resolution === "suspend_connections") return transitions.suspend_connections;
  if (resolution === "suspend_account") return transitions.suspend_account;
  return undefined;
}

export function parseMemberStatusAction(value: unknown): MemberStatusAction {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid member action");
  const record = value as Record<string, unknown>;
  if (Object.keys(record).length !== 1 || !MEMBER_STATUS_ACTIONS.includes(record.action as MemberStatusAction)) {
    throw new Error("Invalid member action");
  }
  return record.action as MemberStatusAction;
}

export function createMemberStatusService(
  repository: MemberStatusRepository,
  createId: () => string = () => crypto.randomUUID(),
) {
  return {
    async updateMemberStatus(adminId: string, memberId: string, action: MemberStatusAction, now: number) {
      if (!isAuthorizedAdminId(adminId)) throw new Error("Forbidden");
      if (!MEMBER_STATUS_ACTIONS.includes(action) || !memberId || memberId === adminId) throw new Error("Invalid member action");
      if (action === "delete") {
        const auditId = createId();
        const result = await repository.deleteAccountAtomic({
          userId: memberId, deletedAt: now, auditId,
          audit: { actorUserId: adminId, targetType: "member", targetId: memberId, action: "member.deleted", diffJson: "{}", createdAt: now },
        });
        if (!result.deleted) throw new Error("Member not found or already deleted");
        return { memberId, status: "deleted" as const };
      }
      const transition = transitions[action];
      await repository.applyStatusAtomic({
        memberId,
        status: transition.status,
        updatedAt: now,
        audit: {
          id: createId(), actorUserId: adminId, targetType: "member", targetId: memberId,
          action: transition.audit, diffJson: JSON.stringify({ status: transition.status }), createdAt: now,
        },
      });
      return { memberId, status: transition.status };
    },
  };
}

export async function createRuntimeMemberStatusService() {
  const [{ getDb }, schema, { eq }, { createAccountDeletionRepository }] = await Promise.all([
    import("../../db"), import("../../db/schema"), import("drizzle-orm"), import("../identity/account-deletion"),
  ]);
  const db = getDb();
  const deletionRepository = createAccountDeletionRepository(db);
  return createMemberStatusService({
    async applyStatusAtomic(input) {
      const [member] = await db.select({ id: schema.users.id }).from(schema.users)
        .where(eq(schema.users.id, input.memberId));
      if (!member) throw new Error("Member not found");
      await db.batch([
        db.update(schema.users).set({ status: input.status, updatedAt: input.updatedAt }).where(eq(schema.users.id, input.memberId)),
        db.insert(schema.auditLogs).values(input.audit),
      ]);
    },
    deleteAccountAtomic: deletionRepository.deleteAccountAtomic,
  });
}
