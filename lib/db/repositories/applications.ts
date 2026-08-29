import { eq } from "drizzle-orm";
import { applications } from "../../../db/schema";
import type { getDb } from "../../../db";
import type { ApplicationInput, ApplicationReviewInput } from "../../../features/applications/types";

type Db = ReturnType<typeof getDb>;

export type ApplicationRepository = {
  saveApplication(input: ApplicationInput): Promise<void>;
  reviewApplication(input: ApplicationReviewInput): Promise<void>;
};

export function createApplicationRepository(db: Db): ApplicationRepository {
  return {
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

export async function saveApplication(db: Db, input: ApplicationInput): Promise<void> {
  return createApplicationRepository(db).saveApplication(input);
}

export async function reviewApplication(db: Db, input: ApplicationReviewInput): Promise<void> {
  return createApplicationRepository(db).reviewApplication(input);
}
