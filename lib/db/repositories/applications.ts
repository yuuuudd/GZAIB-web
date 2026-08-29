import { and, eq } from "drizzle-orm";
import { applications, schools } from "../../../db/schema";
import type { getDb } from "../../../db";
import type { ApplicationRecord, ApplicationReviewInput } from "../../../features/applications/types";
import type { VisibilityRules } from "../../../features/directory/types";

type Db = ReturnType<typeof getDb>;

export type ApplicationRepository = {
  getApplicationByUserId(userId: string): Promise<ApplicationRecord | undefined>;
  isSchoolConfirmed(schoolId: string): Promise<boolean>;
  saveApplication(input: ApplicationRecord): Promise<void>;
  reviewApplication(input: ApplicationReviewInput): Promise<void>;
};

function readStringArray(value: string): string[] {
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed) && parsed.every((item) => typeof item === "string") ? parsed : [];
  } catch {
    return [];
  }
}

function readVisibility(value: string): VisibilityRules {
  try {
    const parsed: unknown = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as VisibilityRules : {};
  } catch {
    return {};
  }
}

function toApplicationRecord(row: typeof applications.$inferSelect): ApplicationRecord {
  return {
    id: row.id, userId: row.userId, status: row.status as ApplicationRecord["status"],
    nickname: row.nickname, realName: row.realName ?? undefined, avatarKey: row.avatarKey ?? undefined,
    schoolId: row.schoolId, major: row.major ?? undefined, grade: row.grade ?? undefined,
    intro: row.intro, currentFocus: row.currentFocus ?? undefined, canOffer: row.canOffer ?? undefined,
    wantsToMeet: row.wantsToMeet ?? undefined, skills: readStringArray(row.skillsJson),
    interests: readStringArray(row.interestsJson), roles: readStringArray(row.rolesJson),
    workLinks: readStringArray(row.workLinksJson), visibility: readVisibility(row.visibilityJson),
    consentVersion: row.consentVersion, consentAcceptedAt: row.consentAcceptedAt,
    submittedAt: row.submittedAt ?? undefined, createdAt: row.createdAt, updatedAt: row.updatedAt,
  };
}

export function createApplicationRepository(db: Db): ApplicationRepository {
  return {
    async getApplicationByUserId(userId) {
      const [record] = await db.select().from(applications).where(eq(applications.userId, userId));
      return record ? toApplicationRecord(record) : undefined;
    },
    async isSchoolConfirmed(schoolId) {
      const [school] = await db.select({ id: schools.id }).from(schools).where(and(
        eq(schools.id, schoolId),
        eq(schools.coordinateStatus, "confirmed"),
      ));
      return Boolean(school);
    },
    async saveApplication(input) {
      await db.insert(applications).values({
        id: input.id,
        userId: input.userId,
        status: input.status,
        nickname: input.nickname,
        realName: input.realName,
        avatarKey: input.avatarKey,
        schoolId: input.schoolId,
        major: input.major,
        grade: input.grade,
        intro: input.intro,
        currentFocus: input.currentFocus,
        canOffer: input.canOffer,
        wantsToMeet: input.wantsToMeet,
        skillsJson: JSON.stringify(input.skills),
        interestsJson: JSON.stringify(input.interests),
        rolesJson: JSON.stringify(input.roles),
        workLinksJson: JSON.stringify(input.workLinks),
        visibilityJson: JSON.stringify(input.visibility),
        consentVersion: input.consentVersion,
        consentAcceptedAt: input.consentAcceptedAt,
        submittedAt: input.submittedAt,
        createdAt: input.createdAt,
        updatedAt: input.updatedAt,
      }).onConflictDoUpdate({
        target: applications.userId,
        set: {
          status: input.status,
          nickname: input.nickname,
          realName: input.realName,
          avatarKey: input.avatarKey,
          schoolId: input.schoolId,
          major: input.major,
          grade: input.grade,
          intro: input.intro,
          currentFocus: input.currentFocus,
          canOffer: input.canOffer,
          wantsToMeet: input.wantsToMeet,
          skillsJson: JSON.stringify(input.skills),
          interestsJson: JSON.stringify(input.interests),
          rolesJson: JSON.stringify(input.roles),
          workLinksJson: JSON.stringify(input.workLinks),
          visibilityJson: JSON.stringify(input.visibility),
          consentVersion: input.consentVersion,
          consentAcceptedAt: input.consentAcceptedAt,
          submittedAt: input.submittedAt,
          updatedAt: input.updatedAt,
        },
      });
    },
    async reviewApplication(input) {
      await db.update(applications).set({
        status: input.status,
        reviewedBy: input.reviewedBy,
        reviewedAt: input.reviewedAt,
        reviewReason: input.reviewReason,
        updatedAt: input.reviewedAt,
      }).where(eq(applications.id, input.id));
    },
  };
}

export async function saveApplication(db: Db, input: ApplicationRecord): Promise<void> {
  return createApplicationRepository(db).saveApplication(input);
}

export async function reviewApplication(db: Db, input: ApplicationReviewInput): Promise<void> {
  return createApplicationRepository(db).reviewApplication(input);
}
