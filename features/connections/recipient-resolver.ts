import { and, eq, inArray } from "drizzle-orm";
import { applications, memberProfiles, schools, users } from "../../db/schema";
import type { getDb } from "../../db";

type Db = ReturnType<typeof getDb>;

/** Resolves only a currently public, approved member slug; missing and hidden targets intentionally look alike. */
export function createPublicConnectionRecipientResolver(db: Db) {
  return async (slug: string): Promise<string | undefined> => {
    if (typeof slug !== "string" || !/^[a-z0-9-]{2,120}$/i.test(slug)) return undefined;
    const [row] = await db.select({ id: users.id }).from(memberProfiles)
    .innerJoin(users, eq(users.id, memberProfiles.userId))
    .innerJoin(applications, eq(applications.userId, users.id))
    .where(and(
      eq(memberProfiles.slug, slug),
      inArray(users.role, ["member", "admin"]),
      eq(memberProfiles.publishStatus, "published"),
      eq(memberProfiles.adminManaged, false),
      eq(applications.status, "approved"),
      inArray(users.status, ["active", "connection_suspended"]),
    ));
    return row?.id;
  };
}

export async function resolvePublicConnectionRecipientId(slug: string): Promise<string | undefined> {
  const { getDb: runtimeGetDb } = await import("../../db");
  return createPublicConnectionRecipientResolver(runtimeGetDb())(slug);
}

/** Converts an already-authorized inbox participant to its public reference. */
export function createPublicConnectionSlugResolver(db: Db) {
  return async (userId: string): Promise<string | undefined> => {
    const [row] = await db.select({ slug: memberProfiles.slug }).from(memberProfiles).innerJoin(users, eq(users.id, memberProfiles.userId))
      .where(and(eq(users.id, userId), inArray(users.role, ["member", "admin"]), eq(memberProfiles.publishStatus, "published"), eq(memberProfiles.adminManaged, false), inArray(users.status, ["active", "connection_suspended"]))).limit(1);
    return row?.slug;
  };
}

export async function resolvePublicConnectionSlug(userId: string): Promise<string | undefined> {
  const { getDb: runtimeGetDb } = await import("../../db");
  return createPublicConnectionSlugResolver(runtimeGetDb())(userId);
}

export type PublicConnectionMember = { slug: string; nickname: string; avatarUrl?: string; school: string; city: string; intro: string; skills: string[] };

/** Returns the public card for an already-authorized inbox counterpart. */
export function createPublicConnectionMemberResolver(db: Db) {
  return async (userId: string): Promise<PublicConnectionMember | undefined> => {
    const [row] = await db.select({ slug: memberProfiles.slug, nickname: memberProfiles.nickname, avatarKey: memberProfiles.avatarKey, school: schools.name, city: schools.city, intro: memberProfiles.intro, skillsJson: memberProfiles.skillsJson }).from(memberProfiles)
      .innerJoin(users, eq(users.id, memberProfiles.userId)).innerJoin(applications, eq(applications.userId, users.id)).innerJoin(schools, eq(schools.id, memberProfiles.schoolId))
      .where(and(eq(users.id, userId), inArray(users.role, ["member", "admin"]), inArray(users.status, ["active", "connection_suspended"]), eq(applications.status, "approved"), eq(memberProfiles.publishStatus, "published"), eq(memberProfiles.adminManaged, false))).limit(1);
    if (!row) return undefined;
    let skills: string[] = [];
    try { const parsed: unknown = JSON.parse(row.skillsJson); if (Array.isArray(parsed) && parsed.every((value) => typeof value === "string")) skills = parsed; } catch { /* A malformed stored list stays private and empty. */ }
    return { slug: row.slug, nickname: row.nickname, ...(row.avatarKey ? { avatarUrl: `/api/avatars/${row.avatarKey}` } : {}), school: row.school, city: row.city, intro: row.intro, skills };
  };
}

export async function resolvePublicConnectionMember(userId: string): Promise<PublicConnectionMember | undefined> {
  const { getDb: runtimeGetDb } = await import("../../db");
  return createPublicConnectionMemberResolver(runtimeGetDb())(userId);
}
