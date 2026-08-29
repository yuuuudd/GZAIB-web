import { and, eq } from "drizzle-orm";
import { applications, memberProfiles, profileVisibility, schools, users } from "../../../db/schema";
import type { getDb } from "../../../db";
import type {
  DirectoryFilters,
  MemberProfileRecord,
  Visibility,
  VisibilityRules,
} from "../../../features/directory/types";

type Db = ReturnType<typeof getDb>;

type PublishedProfileRow = {
  profile: typeof memberProfiles.$inferSelect;
  school: typeof schools.$inferSelect;
};

/** Legacy JSON fields must never turn an otherwise safe public route into 500. */
export function safeJsonArray(value: unknown): string[] {
  if (typeof value !== "string") return [];

  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed) && parsed.every((item) => typeof item === "string") ? parsed : [];
  } catch {
    return [];
  }
}

async function loadVisibilityRules(db: Db, profileId: string): Promise<VisibilityRules> {
  const rows = await db
    .select({ fieldName: profileVisibility.fieldName, visibility: profileVisibility.visibility })
    .from(profileVisibility)
    .where(eq(profileVisibility.profileId, profileId));

  const rules: VisibilityRules = {};
  for (const row of rows) {
    if (isProjectableField(row.fieldName) && isVisibility(row.visibility)) rules[row.fieldName] = row.visibility;
  }
  return rules;
}

function isProjectableField(field: string): field is keyof VisibilityRules {
  return [
    "nickname", "avatarUrl", "school", "city", "intro", "skills", "roles", "verifiedBuilder", "contributions",
    "currentFocus", "canOffer", "wantsToMeet", "workLinks", "major", "grade",
  ].includes(field);
}

function isVisibility(value: string): value is Visibility {
  return value === "public" || value === "members" || value === "private";
}

function toMemberProfileRecord(row: PublishedProfileRow): MemberProfileRecord {
  return {
    id: row.profile.id,
    userId: row.profile.userId,
    slug: row.profile.slug,
    nickname: row.profile.nickname,
    avatarUrl: row.profile.avatarKey ? `/api/avatars/${row.profile.avatarKey}` : undefined,
    school: row.school.name,
    city: row.school.city,
    intro: row.profile.intro,
    skills: safeJsonArray(row.profile.skillsJson),
    roles: safeJsonArray(row.profile.rolesJson),
    verifiedBuilder: row.profile.verifiedBuilder,
    contributions: [],
    currentFocus: row.profile.currentFocus ?? undefined,
    canOffer: row.profile.canOffer ?? undefined,
    wantsToMeet: row.profile.wantsToMeet ?? undefined,
    workLinks: safeJsonArray(row.profile.workLinksJson),
    major: row.profile.major ?? undefined,
    grade: row.profile.grade ?? undefined,
  };
}

export type PublishedDirectoryProfile = {
  profile: MemberProfileRecord;
  visibility: VisibilityRules;
  schoolId: string;
};

function publicConditions(filters: DirectoryFilters) {
  const conditions = [
    eq(applications.status, "approved"),
    eq(users.status, "active"),
    eq(memberProfiles.publishStatus, "published"),
  ];
  if (filters.city) conditions.push(eq(schools.city, filters.city));
  if (filters.schoolId) conditions.push(eq(memberProfiles.schoolId, filters.schoolId));
  return and(...conditions);
}

async function queryPublishedRows(db: Db, filters: DirectoryFilters, slug?: string): Promise<PublishedProfileRow[]> {
  const conditions = publicConditions(filters);
  const where = slug ? and(conditions, eq(memberProfiles.slug, slug)) : conditions;

  return db
    .select({ profile: memberProfiles, school: schools })
    .from(memberProfiles)
    .innerJoin(users, eq(users.id, memberProfiles.userId))
    .innerJoin(applications, eq(applications.userId, memberProfiles.userId))
    .innerJoin(schools, eq(schools.id, memberProfiles.schoolId))
    .where(where);
}

export async function listPublishedDirectory(
  db: Db,
  filters: DirectoryFilters = {},
): Promise<PublishedDirectoryProfile[]> {
  const rows = await queryPublishedRows(db, filters);
  return Promise.all(rows.map(async (row) => {
    const visibility = await loadVisibilityRules(db, row.profile.id);
    return { profile: toMemberProfileRecord(row), visibility, schoolId: row.profile.schoolId };
  }));
}

export async function getPublishedProfileBySlug(
  db: Db,
  slug: string,
): Promise<PublishedDirectoryProfile | undefined> {
  const [row] = await queryPublishedRows(db, {}, slug);
  if (!row) return undefined;

  const visibility = await loadVisibilityRules(db, row.profile.id);
  return { profile: toMemberProfileRecord(row), visibility, schoolId: row.profile.schoolId };
}
