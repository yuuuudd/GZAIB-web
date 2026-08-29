import type { AuditRecord } from "../admin/authorization";
import type { Visibility } from "../directory/types";
import type { ApplicationRecord, ApplicationStatus } from "./types";
import { completeApplicationVisibility, getMapEligibility } from "./validation";

export type ReviewDecision =
  | { decision: "approved" }
  | { decision: "changes_requested" | "rejected"; reason: string };

export type ReviewedProfile = {
  id: string;
  userId: string;
  slug: string;
  nickname: string;
  realName?: string;
  avatarKey?: string;
  schoolId: string;
  major?: string;
  grade?: string;
  intro: string;
  currentFocus?: string;
  canOffer?: string;
  wantsToMeet?: string;
  skillsJson: string;
  interestsJson: string;
  rolesJson: string;
  workLinksJson: string;
  publishStatus: "published" | "unpublished";
  verifiedBuilder: boolean;
  publishedAt?: number;
  createdAt: number;
  updatedAt: number;
};

export type ApplicationReviewRepository = {
  getReviewContext(applicationId: string): Promise<{
    application: ApplicationRecord;
    schoolCoordinateStatus: "suggested" | "confirmed";
    existingProfile?: Pick<ReviewedProfile, "id" | "slug" | "verifiedBuilder" | "createdAt">;
  } | undefined>;
  applyReviewAtomic(input: {
    application: { id: string; status: "approved"; reviewedBy: string; reviewedAt: number; reviewReason: null };
    profile: ReviewedProfile;
    visibility: { id: string; profileId: string; fieldName: string; visibility: Visibility; updatedAt: number }[];
    audit: AuditRecord;
  }): Promise<void>;
  recordDecisionAtomic(input: {
    application: { id: string; status: "changes_requested" | "rejected"; reviewedBy: string; reviewedAt: number; reviewReason: string };
    audit: AuditRecord;
  }): Promise<void>;
};

function safeSlug(value: string): string {
  const slug = value.normalize("NFKC").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 70);
  return slug || "demo-builder";
}

function validReason(value: unknown): value is string {
  return typeof value === "string" && value.trim().length >= 10 && value.trim().length <= 500;
}

export function parseReviewDecision(value: unknown): ReviewDecision {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid review decision");
  const record = value as Record<string, unknown>;
  if (record.decision === "approved" && Object.keys(record).length === 1) return { decision: "approved" };
  if ((record.decision === "changes_requested" || record.decision === "rejected")
    && Object.keys(record).length === 2 && "reason" in record && typeof record.reason === "string") {
    return { decision: record.decision, reason: record.reason };
  }
  throw new Error("Invalid review decision");
}

export function createApplicationReviewService(
  repository: ApplicationReviewRepository,
  createProfileId: () => string = () => crypto.randomUUID(),
  createAuditId: () => string = () => crypto.randomUUID(),
) {
  return {
    async reviewApplication(adminId: string, applicationId: string, decision: ReviewDecision, now: number) {
      if (adminId !== "demo-admin") throw new Error("Forbidden");
      if (!applicationId || !decision || !["approved", "changes_requested", "rejected"].includes(decision.decision)) {
        throw new Error("Invalid review decision");
      }
      const context = await repository.getReviewContext(applicationId);
      if (!context) throw new Error("Application not found");
      if (context.application.status !== "pending") throw new Error("Application is not pending");
      if (context.application.userId === adminId) throw new Error("Administrators cannot review their own application");

      if (decision.decision !== "approved") {
        if (!validReason(decision.reason)) throw new Error("Review reason must contain 10-500 characters");
        const reason = decision.reason.trim();
        const status = decision.decision;
        await repository.recordDecisionAtomic({
          application: { id: applicationId, status, reviewedBy: adminId, reviewedAt: now, reviewReason: reason },
          audit: {
            id: createAuditId(), actorUserId: adminId, targetType: "application", targetId: applicationId,
            action: status === "rejected" ? "application.rejected" : "application.changes_requested",
            diffJson: JSON.stringify({ status }), createdAt: now,
          },
        });
        return { application: { ...context.application, status, updatedAt: now }, profile: undefined };
      }

      if (context.schoolCoordinateStatus !== "confirmed") throw new Error("School coordinate must be confirmed before approval");
      const visibility = completeApplicationVisibility(context.application.visibility);
      const eligible = getMapEligibility(visibility).eligible;
      const profileId = context.existingProfile?.id ?? createProfileId();
      const profile: ReviewedProfile = {
        id: profileId,
        userId: context.application.userId,
        slug: context.existingProfile?.slug ?? `${safeSlug(context.application.userId)}-${safeSlug(applicationId).slice(-10)}`,
        nickname: context.application.nickname,
        ...(context.application.realName ? { realName: context.application.realName } : {}),
        ...(context.application.avatarKey ? { avatarKey: context.application.avatarKey } : {}),
        schoolId: context.application.schoolId,
        ...(context.application.major ? { major: context.application.major } : {}),
        ...(context.application.grade ? { grade: context.application.grade } : {}),
        intro: context.application.intro,
        ...(context.application.currentFocus ? { currentFocus: context.application.currentFocus } : {}),
        ...(context.application.canOffer ? { canOffer: context.application.canOffer } : {}),
        ...(context.application.wantsToMeet ? { wantsToMeet: context.application.wantsToMeet } : {}),
        skillsJson: JSON.stringify(context.application.skills),
        interestsJson: JSON.stringify(context.application.interests),
        rolesJson: JSON.stringify(context.application.roles),
        workLinksJson: JSON.stringify(context.application.workLinks),
        publishStatus: eligible ? "published" : "unpublished",
        verifiedBuilder: context.existingProfile?.verifiedBuilder ?? false,
        ...(eligible ? { publishedAt: now } : {}),
        createdAt: context.existingProfile?.createdAt ?? now,
        updatedAt: now,
      };
      const visibilityRows = Object.entries(visibility).map(([fieldName, fieldVisibility]) => ({
        id: `${profileId}:${fieldName}`, profileId, fieldName, visibility: fieldVisibility, updatedAt: now,
      }));
      await repository.applyReviewAtomic({
        application: { id: applicationId, status: "approved", reviewedBy: adminId, reviewedAt: now, reviewReason: null },
        profile,
        visibility: visibilityRows,
        audit: {
          id: createAuditId(), actorUserId: adminId, targetType: "application", targetId: applicationId,
          action: "application.approved", diffJson: JSON.stringify({ status: "approved", publishStatus: profile.publishStatus }), createdAt: now,
        },
      });
      return { application: { ...context.application, status: "approved" as ApplicationStatus, updatedAt: now }, profile };
    },
  };
}

export async function reviewApplication(adminId: string, applicationId: string, decision: ReviewDecision, now: number) {
  return (await createRuntimeApplicationReviewService()).reviewApplication(adminId, applicationId, decision, now);
}

export async function createRuntimeApplicationReviewService() {
  const [{ getDb }, schema, drizzle, applicationRepository] = await Promise.all([
    import("../../db"), import("../../db/schema"), import("drizzle-orm"), import("../../lib/db/repositories/applications"),
  ]);
  const db = getDb();
  const repository: ApplicationReviewRepository = {
    async getReviewContext(applicationId) {
      const [row] = await db.select({ application: schema.applications, school: schema.schools, profile: schema.memberProfiles })
        .from(schema.applications)
        .innerJoin(schema.schools, drizzle.eq(schema.schools.id, schema.applications.schoolId))
        .leftJoin(schema.memberProfiles, drizzle.eq(schema.memberProfiles.userId, schema.applications.userId))
        .where(drizzle.eq(schema.applications.id, applicationId));
      if (!row) return undefined;
      return {
        application: applicationRepository.toApplicationRecord(row.application),
        schoolCoordinateStatus: row.school.coordinateStatus,
        ...(row.profile ? { existingProfile: {
          id: row.profile.id, slug: row.profile.slug, verifiedBuilder: row.profile.verifiedBuilder, createdAt: row.profile.createdAt,
        } } : {}),
      };
    },
    async applyReviewAtomic(input) {
      const profileUpdate: Partial<ReviewedProfile> = { ...input.profile };
      delete profileUpdate.id;
      delete profileUpdate.userId;
      delete profileUpdate.createdAt;
      await db.batch([
        db.update(schema.applications).set({
          status: input.application.status, reviewedBy: input.application.reviewedBy, reviewedAt: input.application.reviewedAt,
          reviewReason: input.application.reviewReason, updatedAt: input.application.reviewedAt,
        }).where(drizzle.eq(schema.applications.id, input.application.id)),
        db.insert(schema.memberProfiles).values(input.profile).onConflictDoUpdate({
          target: schema.memberProfiles.userId,
          set: profileUpdate,
        }),
        db.delete(schema.profileVisibility).where(drizzle.eq(schema.profileVisibility.profileId, input.profile.id)),
        db.insert(schema.profileVisibility).values(input.visibility),
        db.insert(schema.auditLogs).values(input.audit),
      ]);
    },
    async recordDecisionAtomic(input) {
      await db.batch([
        db.update(schema.applications).set({
          status: input.application.status, reviewedBy: input.application.reviewedBy, reviewedAt: input.application.reviewedAt,
          reviewReason: input.application.reviewReason, updatedAt: input.application.reviewedAt,
        }).where(drizzle.eq(schema.applications.id, input.application.id)),
        db.insert(schema.auditLogs).values(input.audit),
      ]);
    },
  };
  return createApplicationReviewService(repository);
}
