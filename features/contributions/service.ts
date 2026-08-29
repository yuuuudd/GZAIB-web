import type { AuditRecord } from "../admin/authorization";

export const CONTRIBUTION_STATUSES = ["pending", "confirmed", "rejected"] as const;
export const CONTRIBUTION_VISIBILITIES = ["public", "members", "private"] as const;
export type ContributionStatus = (typeof CONTRIBUTION_STATUSES)[number];
export type ContributionVisibility = (typeof CONTRIBUTION_VISIBILITIES)[number];

export type ContributionInput = {
  profileId: string;
  activityKey: string;
  title: string;
  activityDate: number;
  role: string;
  outcome: string;
  publicSummary: string;
  visibility: ContributionVisibility;
  status: ContributionStatus;
};

export type ContributionRecord = ContributionInput & {
  id: string;
  confirmedBy?: string;
  confirmedAt?: number;
  createdAt: number;
  updatedAt: number;
};

export type ContributionRepository = {
  applyStatusAtomic(input: { profileId: string; contribution: ContributionRecord; audit?: AuditRecord }): Promise<{ verifiedBuilder: boolean }>;
};

const contributionFields = [
  "profileId", "activityKey", "title", "activityDate", "role", "outcome", "publicSummary", "visibility", "status",
] as const;

export function parseContributionInput(value: unknown): ContributionInput {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid contribution");
  const record = value as Record<string, unknown>;
  if (Object.keys(record).length !== contributionFields.length || contributionFields.some((field) => !(field in record))) {
    throw new Error("Invalid contribution");
  }
  return validate(record as ContributionInput);
}

function text(value: unknown, min: number, max: number): value is string {
  return typeof value === "string" && value.trim().length >= min && value.trim().length <= max;
}

function validate(input: ContributionInput): ContributionInput {
  if (!input || typeof input !== "object") throw new Error("Invalid contribution");
  if (!text(input.profileId, 1, 160) || !/^[a-zA-Z0-9:_-]+$/.test(input.profileId)) throw new Error("Invalid contribution profile");
  if (!text(input.activityKey, 2, 120) || !/^[a-zA-Z0-9:_-]+$/.test(input.activityKey)) throw new Error("Invalid activity key");
  if (!text(input.title, 2, 120) || !text(input.role, 2, 80) || !text(input.outcome, 2, 500) || !text(input.publicSummary, 10, 500)) {
    throw new Error("Invalid contribution details");
  }
  if (!Number.isSafeInteger(input.activityDate) || input.activityDate <= 0) throw new Error("Invalid contribution date");
  if (!CONTRIBUTION_STATUSES.includes(input.status) || !CONTRIBUTION_VISIBILITIES.includes(input.visibility)) throw new Error("Invalid contribution status");
  return { ...input, title: input.title.trim(), role: input.role.trim(), outcome: input.outcome.trim(), publicSummary: input.publicSummary.trim() };
}

export function createContributionService(
  repository: ContributionRepository,
  createId: (input: ContributionInput) => string = (input) => `contribution:${input.profileId}:${input.activityKey}`,
  createAuditId: () => string = () => crypto.randomUUID(),
) {
  return {
    async confirmContribution(adminId: string, rawInput: ContributionInput, now: number) {
      if (adminId !== "demo-admin") throw new Error("Forbidden");
      const input = validate(rawInput);
      const contribution: ContributionRecord = {
        ...input,
        id: createId(input),
        ...(input.status === "confirmed" ? { confirmedBy: adminId, confirmedAt: now } : {}),
        createdAt: now,
        updatedAt: now,
      };
      const audit: AuditRecord | undefined = input.status === "confirmed" ? {
        id: createAuditId(), actorUserId: adminId, targetType: "contribution", targetId: contribution.id,
        action: "contribution.confirmed", diffJson: JSON.stringify({ status: input.status }), createdAt: now,
      } : undefined;
      const result = await repository.applyStatusAtomic({ profileId: input.profileId, contribution, ...(audit ? { audit } : {}) });
      return { contribution, verifiedBuilder: result.verifiedBuilder };
    },
  };
}

export async function confirmContribution(adminId: string, input: ContributionInput, now: number) {
  return (await createRuntimeContributionService()).confirmContribution(adminId, input, now);
}

export async function createRuntimeContributionService() {
  const [{ getDb }, schema, { eq, sql }] = await Promise.all([import("../../db"), import("../../db/schema"), import("drizzle-orm")]);
  const db = getDb();
  return createContributionService({
    async applyStatusAtomic(input) {
      const save = db.insert(schema.contributions).values(input.contribution).onConflictDoUpdate({
        target: schema.contributions.id,
        set: {
          activityKey: input.contribution.activityKey, title: input.contribution.title, activityDate: input.contribution.activityDate,
          role: input.contribution.role, outcome: input.contribution.outcome, publicSummary: input.contribution.publicSummary,
          visibility: input.contribution.visibility, status: input.contribution.status,
          confirmedBy: input.contribution.confirmedBy ?? null, confirmedAt: input.contribution.confirmedAt ?? null,
          updatedAt: input.contribution.updatedAt,
        },
      });
      const recalculate = db.update(schema.memberProfiles).set({
        verifiedBuilder: sql<boolean>`EXISTS (SELECT 1 FROM contributions c WHERE c.profile_id = ${input.profileId} AND c.status = 'confirmed')`,
        updatedAt: input.contribution.updatedAt,
      }).where(eq(schema.memberProfiles.id, input.profileId));
      if (input.audit) await db.batch([save, recalculate, db.insert(schema.auditLogs).values(input.audit)]);
      else await db.batch([save, recalculate]);
      const [profile] = await db.select({ verifiedBuilder: schema.memberProfiles.verifiedBuilder })
        .from(schema.memberProfiles).where(eq(schema.memberProfiles.id, input.profileId));
      if (!profile) throw new Error("Profile not found");
      return profile;
    },
  });
}
