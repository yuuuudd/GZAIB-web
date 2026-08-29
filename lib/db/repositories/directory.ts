import { and, eq, inArray } from "drizzle-orm";
import { applications, contributions, memberProfiles, profileVisibility, schools, users } from "../../../db/schema";
import type { getDb } from "../../../db";
import { projectProfile } from "../../../features/directory/public-profile";
import type { ProfileAccessCandidate, ProfileAccessRepository } from "../../../features/directory/profile-access";
import type {
  DirectoryFilters,
  MemberProfileRecord,
  ProjectedProfile,
  Viewer,
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

export async function loadProfileVisibility(db: Db, profileId: string): Promise<VisibilityRules> {
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

function contributionIsVisible(visibility: string, viewer: Viewer): boolean {
  if (viewer.kind === "admin" || viewer.kind === "owner") return true;
  if (visibility === "public") return true;
  return visibility === "members" && viewer.kind === "member";
}

async function loadConfirmedContributions(db: Db, profileId: string, viewer: Viewer) {
  const rows = await db.select().from(contributions).where(and(
    eq(contributions.profileId, profileId),
    eq(contributions.status, "confirmed"),
  ));
  return rows.filter((row) => contributionIsVisible(row.visibility, viewer)).map((row) => ({
    id: row.id,
    title: row.title,
    activityDate: row.activityDate,
    role: row.role,
    outcome: row.outcome,
    publicSummary: row.publicSummary,
  }));
}

async function accessCandidate(
  db: Db,
  condition: ReturnType<typeof eq>,
  viewer: Viewer,
): Promise<ProfileAccessCandidate | undefined> {
  const [row] = await db.select({
    profile: memberProfiles,
    school: schools,
    accountStatus: users.status,
    applicationStatus: applications.status,
  }).from(memberProfiles)
    .innerJoin(users, eq(users.id, memberProfiles.userId))
    .innerJoin(applications, eq(applications.userId, memberProfiles.userId))
    .innerJoin(schools, eq(schools.id, memberProfiles.schoolId))
    .where(condition);
  if (!row) return undefined;
  const [visibility, confirmedContributions] = await Promise.all([
    loadProfileVisibility(db, row.profile.id),
    loadConfirmedContributions(db, row.profile.id, viewer),
  ]);
  return {
    accountStatus: row.accountStatus,
    applicationStatus: row.applicationStatus,
    publishStatus: row.profile.publishStatus,
    profile: { ...toMemberProfileRecord(row), contributions: confirmedContributions },
    visibility,
  };
}

export function createProfileAccessRepository(db: Db): ProfileAccessRepository {
  return {
    findBySlug: (slug, viewer) => accessCandidate(db, eq(memberProfiles.slug, slug), viewer),
    findByUserId: (userId) => accessCandidate(db, eq(memberProfiles.userId, userId), { kind: "owner", userId }),
  };
}

function publicConditions(filters: DirectoryFilters) {
  const conditions = [
    inArray(users.status, ["active", "connection_suspended"]),
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
  viewer: Viewer,
): Promise<ProjectedProfile[]> {
  const rows = await queryPublishedRows(db, filters);
  return Promise.all(rows.map(async (row) => {
    const visibility = await loadProfileVisibility(db, row.profile.id);
    return projectProfile(toMemberProfileRecord(row), visibility, viewer);
  }));
}

export async function getPublishedProfileBySlug(
  db: Db,
  slug: string,
  viewer: Viewer,
): Promise<ProjectedProfile | undefined> {
  const [row] = await queryPublishedRows(db, {}, slug);
  if (!row) return undefined;

  const visibility = await loadProfileVisibility(db, row.profile.id);
  return projectProfile(toMemberProfileRecord(row), visibility, viewer);
}
