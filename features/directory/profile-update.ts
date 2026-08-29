import { MAP_REQUIRED_VISIBILITY_FIELDS } from "../applications/validation";
import { isOwnedAvatarKey } from "./avatar";
import type { Visibility, VisibilityRules } from "./types";

export type ProfilePublishStatus = "published" | "unpublished";
export type OwnProfileUpdateContext = {
  userId: string;
  profileId: string;
  slug: string;
  schoolId: string;
  publishStatus: "published" | "unpublished" | "pending_school_review";
  visibility: VisibilityRules;
};

type EditableProfilePatch = {
  nickname?: string;
  avatarKey?: string | null;
  schoolId?: string;
  major?: string | null;
  grade?: string | null;
  intro?: string;
  currentFocus?: string | null;
  canOffer?: string | null;
  wantsToMeet?: string | null;
  skills?: string[];
  interests?: string[];
  roles?: string[];
  workLinks?: string[];
  visibility?: VisibilityRules;
  mapVisibility?: "shown" | "hidden";
};

export type ProfileUpdateWrite = {
  userId: string;
  profileId: string;
  slug: string;
  profilePatch: Omit<EditableProfilePatch, "visibility" | "mapVisibility" | "schoolId"> & { schoolId?: undefined };
  applicationPatch: Record<string, unknown>;
  visibility: VisibilityRules;
  publishStatus: ProfilePublishStatus;
  updatedAt: number;
};

export type ProfileUpdateRepository = {
  getOwnUpdateContext(userId: string): Promise<OwnProfileUpdateContext | undefined>;
  isConfirmedSchool(schoolId: string): Promise<boolean>;
  applyOwnUpdateAtomic(input: ProfileUpdateWrite): Promise<{ updated: boolean }>;
};

const editableKeys = new Set([
  "nickname", "avatarKey", "schoolId", "major", "grade", "intro", "currentFocus", "canOffer", "wantsToMeet",
  "skills", "interests", "roles", "workLinks", "visibility", "mapVisibility",
]);
const visibilityFields = new Set([
  "nickname", "avatarUrl", "school", "city", "intro", "skills", "roles", "verifiedBuilder", "contributions",
  "currentFocus", "canOffer", "wantsToMeet", "workLinks", "major", "grade",
]);

function asPatch(value: unknown): EditableProfilePatch {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid profile update");
  const record = value as Record<string, unknown>;
  if (Object.keys(record).some((key) => !editableKeys.has(key))) throw new Error("Forbidden profile field");
  return record as EditableProfilePatch;
}

function validateText(value: unknown, min: number, max: number, nullable = false): boolean {
  return nullable && value === null || typeof value === "string" && value.trim().length >= min && value.trim().length <= max;
}

function validateStringArray(value: unknown, max: number, httpsOnly = false): boolean {
  if (!Array.isArray(value) || value.length > max || !value.every((item) => typeof item === "string" && item.trim().length > 0)) return false;
  if (!httpsOnly) return true;
  return value.every((item) => {
    try { return new URL(item).protocol === "https:"; } catch { return false; }
  });
}

function validatedVisibility(value: unknown): VisibilityRules {
  if (value === undefined) return {};
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid visibility update");
  const result: VisibilityRules = {};
  for (const [field, visibility] of Object.entries(value as Record<string, unknown>)) {
    if (!visibilityFields.has(field) || !["public", "members", "private"].includes(visibility as string)) {
      throw new Error("Invalid visibility update");
    }
    result[field as keyof VisibilityRules] = visibility as Visibility;
  }
  return result;
}

function validateProfileValues(patch: EditableProfilePatch): void {
  const checks: [unknown, number, number, boolean][] = [
    [patch.nickname, 2, 30, false], [patch.avatarKey, 1, 240, true], [patch.major, 1, 100, true],
    [patch.grade, 1, 40, true], [patch.intro, 10, 160, false], [patch.currentFocus, 1, 500, true],
    [patch.canOffer, 1, 500, true], [patch.wantsToMeet, 1, 500, true],
  ];
  for (const [value, min, max, nullable] of checks) {
    if (value !== undefined && !validateText(value, min, max, nullable)) throw new Error("Invalid profile update");
  }
  if (patch.skills !== undefined && !validateStringArray(patch.skills, 8)) throw new Error("Invalid profile update");
  if (patch.interests !== undefined && !validateStringArray(patch.interests, 6)) throw new Error("Invalid profile update");
  if (patch.roles !== undefined && !validateStringArray(patch.roles, 4)) throw new Error("Invalid profile update");
  if (patch.workLinks !== undefined && !validateStringArray(patch.workLinks, 5, true)) throw new Error("Invalid profile update");
  if (patch.mapVisibility !== undefined && patch.mapVisibility !== "shown" && patch.mapVisibility !== "hidden") {
    throw new Error("Invalid profile update");
  }
}

export function createProfileUpdateService(repository: ProfileUpdateRepository) {
  return {
    async updateOwnProfile(actorUserId: string, targetUserId: string, value: unknown, now: number): Promise<void> {
      if (actorUserId !== targetUserId) throw new Error("Forbidden cross-user profile update");
      const context = await repository.getOwnUpdateContext(targetUserId);
      if (!context || context.userId !== actorUserId) throw new Error("Forbidden profile update");
      const patch = asPatch(value);
      validateProfileValues(patch);
      if (typeof patch.avatarKey === "string" && !isOwnedAvatarKey(patch.avatarKey, actorUserId)) {
        throw new Error("Invalid avatar owner");
      }
      const visibilityPatch = validatedVisibility(patch.visibility);
      const visibility = { ...context.visibility, ...visibilityPatch };
      const publishStatus: ProfilePublishStatus = patch.mapVisibility === "hidden"
        ? "unpublished"
        : patch.mapVisibility === "shown" ? "published" : context.publishStatus === "published" ? "published" : "unpublished";
      if (publishStatus === "published" && MAP_REQUIRED_VISIBILITY_FIELDS.some((field) => visibility[field] !== "public")) {
        throw new Error("请先使用“隐藏我的地图资料”，再把地图必需字段设为非公开");
      }

      const { visibility: discardedVisibility, mapVisibility: discardedMapVisibility, schoolId, ...profilePatch } = patch;
      void discardedVisibility;
      void discardedMapVisibility;
      const applicationPatch: Record<string, unknown> = { ...profilePatch };
      if (schoolId !== undefined && schoolId !== context.schoolId) {
        if (!schoolId || !await repository.isConfirmedSchool(schoolId)) throw new Error("Invalid school proposal");
        applicationPatch.schoolId = schoolId;
        applicationPatch.status = "pending";
      }
      const result = await repository.applyOwnUpdateAtomic({
        userId: targetUserId,
        profileId: context.profileId,
        slug: context.slug,
        profilePatch,
        applicationPatch,
        visibility,
        publishStatus,
        updatedAt: now,
      });
      if (!result.updated) throw new Error("Profile update state changed before commit");
    },
  };
}

function toDatabaseProfilePatch(patch: ProfileUpdateWrite["profilePatch"]) {
  const output: Record<string, unknown> = {};
  for (const field of ["nickname", "avatarKey", "major", "grade", "intro", "currentFocus", "canOffer", "wantsToMeet"] as const) {
    if (patch[field] !== undefined) output[field] = patch[field];
  }
  if (patch.skills !== undefined) output.skillsJson = JSON.stringify(patch.skills);
  if (patch.interests !== undefined) output.interestsJson = JSON.stringify(patch.interests);
  if (patch.roles !== undefined) output.rolesJson = JSON.stringify(patch.roles);
  if (patch.workLinks !== undefined) output.workLinksJson = JSON.stringify(patch.workLinks);
  return output;
}

function toDatabaseApplicationPatch(patch: Record<string, unknown>) {
  const { skills, interests, roles, workLinks, ...plain } = patch;
  return {
    ...plain,
    ...(skills !== undefined ? { skillsJson: JSON.stringify(skills) } : {}),
    ...(interests !== undefined ? { interestsJson: JSON.stringify(interests) } : {}),
    ...(roles !== undefined ? { rolesJson: JSON.stringify(roles) } : {}),
    ...(workLinks !== undefined ? { workLinksJson: JSON.stringify(workLinks) } : {}),
  };
}

export async function createRuntimeProfileUpdateService() {
  const [{ getDb }, schema, drizzle, { loadProfileVisibility }] = await Promise.all([
    import("../../db"), import("../../db/schema"), import("drizzle-orm"), import("../../lib/db/repositories/directory"),
  ]);
  const db = getDb();
  const usableAccount = (userId: string) => drizzle.sql`exists (
    select 1 from ${schema.users}
    where ${schema.users.id} = ${userId}
      and ${schema.users.status} in ('active', 'hidden', 'connection_suspended')
  )`;
  const repository: ProfileUpdateRepository = {
    async getOwnUpdateContext(userId) {
      const [profile] = await db.select().from(schema.memberProfiles).where(drizzle.and(
        drizzle.eq(schema.memberProfiles.userId, userId), usableAccount(userId),
      ));
      if (!profile) return undefined;
      return {
        userId: profile.userId,
        profileId: profile.id,
        slug: profile.slug,
        schoolId: profile.schoolId,
        publishStatus: profile.publishStatus,
        visibility: await loadProfileVisibility(db, profile.id),
      };
    },
    async isConfirmedSchool(schoolId) {
      const [school] = await db.select({ id: schema.schools.id }).from(schema.schools).where(drizzle.and(
        drizzle.eq(schema.schools.id, schoolId), drizzle.eq(schema.schools.coordinateStatus, "confirmed"),
      ));
      return Boolean(school);
    },
    async applyOwnUpdateAtomic(input) {
      const ownerExists = usableAccount(input.userId);
      const profileSet = {
        ...toDatabaseProfilePatch(input.profilePatch),
        publishStatus: input.publishStatus,
        ...(input.publishStatus === "published" ? { publishedAt: input.updatedAt } : {}),
        updatedAt: input.updatedAt,
      };
      type BatchStatement = Parameters<typeof db.batch>[0][number];
      const statements: BatchStatement[] = [
        db.update(schema.memberProfiles).set(profileSet).where(drizzle.and(
          drizzle.eq(schema.memberProfiles.id, input.profileId),
          drizzle.eq(schema.memberProfiles.userId, input.userId),
          ownerExists,
        )),
      ];
      if (Object.keys(input.applicationPatch).length > 0) {
        statements.push(db.update(schema.applications).set({
          ...toDatabaseApplicationPatch(input.applicationPatch), updatedAt: input.updatedAt,
        }).where(drizzle.and(drizzle.eq(schema.applications.userId, input.userId), ownerExists)));
      }
      for (const [fieldName, fieldVisibility] of Object.entries(input.visibility)) {
        if (!fieldVisibility) continue;
        statements.push(db.insert(schema.profileVisibility).select(drizzle.sql`
          select ${`${input.profileId}:${fieldName}`}, ${input.profileId}, ${fieldName}, ${fieldVisibility}, ${input.updatedAt}
          where ${ownerExists}
        `).onConflictDoUpdate({
          target: [schema.profileVisibility.profileId, schema.profileVisibility.fieldName],
          set: { visibility: fieldVisibility, updatedAt: input.updatedAt },
        }));
      }
      const [profileResult] = await db.batch(statements as [BatchStatement, ...BatchStatement[]]);
      return { updated: ((profileResult as { meta?: { changes?: number } }).meta?.changes ?? 0) === 1 };
    },
  };
  return createProfileUpdateService(repository);
}

/** Route-safe owner update; target ownership is fixed to the authenticated user id. */
export async function updateOwnProfile(userId: string, patch: unknown, now: number): Promise<void> {
  return (await createRuntimeProfileUpdateService()).updateOwnProfile(userId, userId, patch, now);
}
