import type { AuditRecord } from "../admin/authorization";
import { isAuthorizedAdminId } from "../admin/identity";
import type { NotificationSender } from "../notifications/types";
import { sendNotificationWithoutRollback } from "../notifications/types";

export type ContributionStatus = "pending" | "confirmed" | "rejected";
export type ContributionVisibility = "public" | "members" | "private";

export type ContributionConfirmationInput = {
  id: string;
  status: "confirmed";
};

export type ContributionRecord = {
  id: string;
  profileId: string;
  activityKey: string;
  title: string;
  activityDate: number;
  role: string;
  outcome: string;
  publicSummary: string;
  visibility: ContributionVisibility;
  status: ContributionStatus;
  confirmedBy?: string;
  confirmedAt?: number;
  createdAt: number;
  updatedAt: number;
};

export type ContributionRepository = {
  confirmPendingAtomic(input: {
    contributionId: string;
    confirmedBy: string;
    confirmedAt: number;
    audit: AuditRecord;
  }): Promise<
    | { transitioned: false }
    | { transitioned: true; contribution: ContributionRecord; verifiedBuilder: boolean; recipientUserId: string }
  >;
};

export function parseContributionInput(value: unknown): ContributionConfirmationInput {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid contribution confirmation");
  const record = value as Record<string, unknown>;
  if (Object.keys(record).length !== 2 || record.status !== "confirmed"
    || typeof record.id !== "string" || !/^[a-zA-Z0-9:_-]{1,200}$/.test(record.id)) {
    throw new Error("Invalid contribution confirmation");
  }
  return { id: record.id, status: "confirmed" };
}

export function createContributionService(
  repository: ContributionRepository,
  createAuditId: () => string = () => crypto.randomUUID(),
  notificationSender?: NotificationSender,
) {
  return {
    async confirmContribution(adminId: string, rawInput: ContributionConfirmationInput, now: number) {
      if (!isAuthorizedAdminId(adminId)) throw new Error("Forbidden");
      const input = parseContributionInput(rawInput);
      const result = await repository.confirmPendingAtomic({
        contributionId: input.id,
        confirmedBy: adminId,
        confirmedAt: now,
        audit: {
          id: createAuditId(), actorUserId: adminId, targetType: "contribution", targetId: input.id,
          action: "contribution.confirmed", diffJson: JSON.stringify({ status: "confirmed" }), createdAt: now,
        },
      });
      if (!result.transitioned) throw new Error("Pending contribution state changed before commit");
      await sendNotificationWithoutRollback(notificationSender, {
        type: "contribution_confirmed",
        userId: result.recipientUserId,
        contributionId: result.contribution.id,
        contributionTitle: result.contribution.title,
        createdAt: now,
      });
      return { contribution: result.contribution, verifiedBuilder: result.verifiedBuilder };
    },
  };
}

export async function confirmContribution(adminId: string, input: ContributionConfirmationInput, now: number) {
  return (await createRuntimeContributionService()).confirmContribution(adminId, input, now);
}

export async function createRuntimeContributionService() {
  const [{ getDb }, schema, drizzle, { createInAppNotificationSender }] = await Promise.all([
    import("../../db"), import("../../db/schema"), import("drizzle-orm"), import("../notifications/in-app"),
  ]);
  const db = getDb();
  return createContributionService({
    async confirmPendingAtomic(input) {
      const gateAudit = db.insert(schema.auditLogs).select(drizzle.sql`
        select ${input.audit.id}, ${input.audit.actorUserId}, ${input.audit.targetType}, ${input.audit.targetId},
          ${input.audit.action}, ${input.audit.diffJson}, ${input.audit.createdAt}
        from ${schema.contributions}
        where ${schema.contributions.id} = ${input.contributionId}
          and ${schema.contributions.status} = 'pending'
      `);
      const auditExists = drizzle.sql`exists (select 1 from ${schema.auditLogs} where ${schema.auditLogs.id} = ${input.audit.id})`;
      const results = await db.batch([
        gateAudit,
        db.update(schema.contributions).set({
          status: "confirmed", confirmedBy: input.confirmedBy, confirmedAt: input.confirmedAt, updatedAt: input.confirmedAt,
        }).where(drizzle.and(
          drizzle.eq(schema.contributions.id, input.contributionId),
          drizzle.eq(schema.contributions.status, "pending"),
          auditExists,
        )),
        db.update(schema.memberProfiles).set({
          verifiedBuilder: drizzle.sql<boolean>`exists (
            select 1 from ${schema.contributions} confirmed
            where confirmed.profile_id = ${schema.memberProfiles.id} and confirmed.status = 'confirmed'
          )`,
          updatedAt: input.confirmedAt,
        }).where(drizzle.and(
          drizzle.eq(
            schema.memberProfiles.id,
            drizzle.sql`(select profile_id from ${schema.contributions} where ${schema.contributions.id} = ${input.contributionId})`,
          ),
          auditExists,
        )),
      ]);
      const gateResult = results[0] as { meta?: { changes?: number } };
      if ((gateResult.meta?.changes ?? 0) !== 1) return { transitioned: false };

      const [row] = await db.select({ contribution: schema.contributions, profile: schema.memberProfiles })
        .from(schema.contributions)
        .innerJoin(schema.memberProfiles, drizzle.eq(schema.memberProfiles.id, schema.contributions.profileId))
        .where(drizzle.eq(schema.contributions.id, input.contributionId));
      if (!row || row.contribution.status !== "confirmed") throw new Error("Confirmed contribution could not be loaded");
      const contribution: ContributionRecord = {
        id: row.contribution.id,
        profileId: row.contribution.profileId,
        activityKey: row.contribution.activityKey,
        title: row.contribution.title,
        activityDate: row.contribution.activityDate,
        role: row.contribution.role,
        outcome: row.contribution.outcome,
        publicSummary: row.contribution.publicSummary,
        status: "confirmed",
        visibility: row.contribution.visibility,
        createdAt: row.contribution.createdAt,
        updatedAt: row.contribution.updatedAt,
        ...(row.contribution.confirmedBy ? { confirmedBy: row.contribution.confirmedBy } : {}),
        ...(row.contribution.confirmedAt ? { confirmedAt: row.contribution.confirmedAt } : {}),
      };
      return {
        transitioned: true,
        contribution,
        verifiedBuilder: row.profile.verifiedBuilder,
        recipientUserId: row.profile.userId,
      };
    },
  }, undefined, createInAppNotificationSender(db));
}
