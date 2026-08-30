import { and, eq } from "drizzle-orm";
import type { getDb } from "../../../db";
import { auditLogs, memberProfiles, profileVisibility, schools, users } from "../../../db/schema";
import type { ManualMemberRecord, ManualMemberRepository } from "../../../features/admin/manual-members";

type Db = ReturnType<typeof getDb>;

/** D1 persistence for administrator-managed, non-login member profiles. */
export function createManualMemberRepository(db: Db): ManualMemberRepository {
  return {
    async isSchoolConfirmed(schoolId) {
      const [school] = await db.select({ id: schools.id }).from(schools).where(and(eq(schools.id, schoolId), eq(schools.coordinateStatus, "confirmed"))).limit(1);
      return Boolean(school);
    },
    async createAtomic(record: ManualMemberRecord) {
      const profile = record.profile;
      const { publication: _publication, ...profileFields } = profile;
      await db.batch([
        db.insert(users).values({ ...record.user, role: "member", status: "active" }),
        db.insert(memberProfiles).values({
          ...profileFields,
          realName: profile.realName, major: profile.major, grade: profile.grade, currentFocus: profile.currentFocus,
          canOffer: profile.canOffer, wantsToMeet: profile.wantsToMeet, avatarKey: null,
          skillsJson: JSON.stringify(profile.skills), interestsJson: JSON.stringify(profile.interests), rolesJson: JSON.stringify(profile.roles), workLinksJson: JSON.stringify(profile.workLinks),
          publishedAt: profile.publishStatus === "published" ? profile.createdAt : null,
        }),
        ...Object.entries(record.visibility).map(([fieldName, visibility]) => db.insert(profileVisibility).values({
          id: `${profile.id}:${fieldName}`, profileId: profile.id, fieldName, visibility, updatedAt: profile.updatedAt,
        })),
        db.insert(auditLogs).values(record.audit),
      ]);
    },
  };
}
