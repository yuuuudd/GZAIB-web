import { and, eq } from "drizzle-orm";
import { contributions } from "../../../db/schema";
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
    .where(and(
      eq(contributions.profileId, profileId),
      eq(contributions.status, "confirmed"),
      eq(contributions.visibility, "public"),
    ));

  return rows;
}
