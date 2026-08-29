import { and, eq } from "drizzle-orm";
import { applications, contributions, memberProfiles, users } from "../../../db/schema";
import type { getDb } from "../../../db";
import type { ProfileContribution } from "../../../features/directory/types";

type Db = ReturnType<typeof getDb>;

/** Returns only confirmed public contribution records suitable for a profile. */
export async function listApprovedContributions(db: Db, profileId: string): Promise<ProfileContribution[]> {
  const rows = await db
    .select({
      id: contributions.id,
      title: contributions.title,
      activityDate: contributions.activityDate,
      role: contributions.role,
      outcome: contributions.outcome,
      publicSummary: contributions.publicSummary,
    })
    .from(contributions)
    .innerJoin(memberProfiles, eq(memberProfiles.id, contributions.profileId))
    .innerJoin(users, eq(users.id, memberProfiles.userId))
    .innerJoin(applications, eq(applications.userId, memberProfiles.userId))
    .where(and(
      eq(contributions.profileId, profileId),
      eq(contributions.status, "confirmed"),
      eq(contributions.visibility, "public"),
      eq(applications.status, "approved"),
      eq(users.status, "active"),
      eq(memberProfiles.publishStatus, "published"),
    ));

  return rows;
}
