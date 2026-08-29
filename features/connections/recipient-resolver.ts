import { and, eq, inArray } from "drizzle-orm";
import { applications, memberProfiles, users } from "../../db/schema";
import { getDb } from "../../db";

/** Resolves only a currently public, approved member slug; missing and hidden targets intentionally look alike. */
export async function resolvePublicConnectionRecipientId(slug: string): Promise<string | undefined> {
  if (typeof slug !== "string" || !/^[a-z0-9-]{2,120}$/i.test(slug)) return undefined;
  const [row] = await getDb().select({ id: users.id }).from(memberProfiles)
    .innerJoin(users, eq(users.id, memberProfiles.userId))
    .innerJoin(applications, eq(applications.userId, users.id))
    .where(and(
      eq(memberProfiles.slug, slug),
      eq(memberProfiles.publishStatus, "published"),
      eq(applications.status, "approved"),
      inArray(users.status, ["active", "connection_suspended"]),
    ));
  return row?.id;
}
