import { projectProfile } from "./public-profile";
import type { MemberProfileRecord, ProjectedProfile, VisibilityRules } from "./types";

export const DIRECTORY_PROFILE_CAP = 2_000;
export const DIRECTORY_PAGE_CAP = 50;

export type DirectoryQuery = {
  city?: string;
  schoolId?: string;
  skills?: string[];
  roles?: string[];
  verified?: boolean;
  q?: string;
};

export type DirectoryMemberPreview = Pick<ProjectedProfile, "slug"> & {
  nickname: string;
  avatarUrl?: string;
  skills: string[];
  roles: string[];
  verifiedBuilder: boolean;
};

export type DirectorySchool = {
  id: string;
  name: string;
  campus: string;
  city: string;
  lng: number;
  lat: number;
  memberCount: number;
  previewMembers: DirectoryMemberPreview[];
};

export type DirectoryCandidate = {
  approvalStatus: string;
  accountStatus: string;
  publishStatus: string;
  school: {
    id: string;
    name: string;
    campus: string;
    city: string;
    longitude: number;
    latitude: number;
    coordinateStatus: string;
  };
  profile: MemberProfileRecord;
  visibility: VisibilityRules;
};

export type DirectoryRepository = {
  listCandidates(limit: number): Promise<DirectoryCandidate[]>;
};

type PublicCandidate = {
  source: DirectoryCandidate;
  projected: ProjectedProfile & Required<Pick<ProjectedProfile, "nickname" | "school" | "city" | "intro" | "skills" | "roles" | "verifiedBuilder" | "contributions">>;
};

function normalizeSearch(value: string): string {
  return value.normalize("NFKC").trim().toLocaleLowerCase("zh-CN");
}

function hasRequiredPublicFields(profile: ProjectedProfile): profile is PublicCandidate["projected"] {
  return typeof profile.nickname === "string"
    && typeof profile.school === "string"
    && typeof profile.city === "string"
    && typeof profile.intro === "string"
    && Array.isArray(profile.skills)
    && Array.isArray(profile.roles)
    && typeof profile.verifiedBuilder === "boolean"
    && Array.isArray(profile.contributions);
}

function isPublishedCandidate(candidate: DirectoryCandidate): boolean {
  return candidate.approvalStatus === "approved"
    && candidate.accountStatus === "active"
    && candidate.publishStatus === "published"
    && candidate.school.coordinateStatus === "confirmed";
}

function matchesQuery(candidate: PublicCandidate, query: DirectoryQuery): boolean {
  const { source, projected } = candidate;
  if (query.city && source.school.city !== query.city) return false;
  if (query.schoolId && source.school.id !== query.schoolId) return false;
  if (query.skills?.some((skill) => !projected.skills.includes(skill))) return false;
  if (query.roles?.some((role) => !projected.roles.includes(role))) return false;
  if (query.verified !== undefined && projected.verifiedBuilder !== query.verified) return false;
  if (query.q) {
    const needle = normalizeSearch(query.q);
    const searchable = [projected.nickname, source.school.name, source.school.city, ...projected.skills, ...projected.roles]
      .map(normalizeSearch);
    if (needle && !searchable.some((value) => value.includes(needle))) return false;
  }
  return true;
}

function toPreview(projected: PublicCandidate["projected"]): DirectoryMemberPreview {
  return {
    slug: projected.slug,
    nickname: projected.nickname,
    ...(projected.avatarUrl ? { avatarUrl: projected.avatarUrl } : {}),
    skills: projected.skills.slice(0, 3),
    roles: projected.roles.slice(0, 2),
    verifiedBuilder: projected.verifiedBuilder,
  };
}

async function publicCandidates(repository: DirectoryRepository, query: DirectoryQuery): Promise<PublicCandidate[]> {
  const candidates = (await repository.listCandidates(DIRECTORY_PROFILE_CAP)).slice(0, DIRECTORY_PROFILE_CAP);
  return candidates.flatMap((source) => {
    if (!isPublishedCandidate(source)) return [];
    const projected = projectProfile(source.profile, source.visibility, { kind: "visitor" });
    if (!hasRequiredPublicFields(projected)) return [];
    const candidate = { source, projected };
    return matchesQuery(candidate, query) ? [candidate] : [];
  });
}

export function createDirectoryService(repository: DirectoryRepository) {
  return {
    async list(query: DirectoryQuery = {}): Promise<DirectorySchool[]> {
      const candidates = await publicCandidates(repository, query);
      const grouped = new Map<string, DirectorySchool>();
      for (const { source, projected } of candidates) {
        const existing = grouped.get(source.school.id);
        if (existing) {
          existing.memberCount += 1;
          if (existing.previewMembers.length < 4) existing.previewMembers.push(toPreview(projected));
          continue;
        }
        grouped.set(source.school.id, {
          id: source.school.id,
          name: source.school.name,
          campus: source.school.campus,
          city: source.school.city,
          lng: source.school.longitude / 1_000_000,
          lat: source.school.latitude / 1_000_000,
          memberCount: 1,
          previewMembers: [toPreview(projected)],
        });
      }
      return [...grouped.values()].sort((a, b) => b.memberCount - a.memberCount || a.name.localeCompare(b.name, "zh-CN"));
    },

    async listMembers(query: DirectoryQuery = {}, options: { limit?: number; cursor?: string } = {}) {
      const candidates = await publicCandidates(repository, query);
      const sorted = candidates.sort((a, b) => a.projected.slug.localeCompare(b.projected.slug));
      const start = options.cursor ? sorted.findIndex(({ projected }) => projected.slug > options.cursor!) : 0;
      const safeStart = start < 0 ? sorted.length : start;
      const limit = Math.max(1, Math.min(options.limit ?? 24, DIRECTORY_PAGE_CAP));
      const page = sorted.slice(safeStart, safeStart + limit);
      return {
        items: page.map(({ projected }) => projected),
        nextCursor: safeStart + limit < sorted.length ? page.at(-1)?.projected.slug : undefined,
      };
    },
  };
}

/** Builds the D1-backed directory at the server boundary; client code imports only DTO types. */
export async function createRuntimeDirectoryService() {
  const [{ getDb }, schema, drizzle, repositoryHelpers] = await Promise.all([
    import("../../db"),
    import("../../db/schema"),
    import("drizzle-orm"),
    import("../../lib/db/repositories/directory"),
  ]);
  const db = getDb();
  const repository: DirectoryRepository = {
    async listCandidates(limit) {
      const rows = await db
        .select({ profile: schema.memberProfiles, school: schema.schools })
        .from(schema.memberProfiles)
        .innerJoin(schema.users, drizzle.eq(schema.users.id, schema.memberProfiles.userId))
        .innerJoin(schema.applications, drizzle.eq(schema.applications.userId, schema.memberProfiles.userId))
        .innerJoin(schema.schools, drizzle.eq(schema.schools.id, schema.memberProfiles.schoolId))
        .where(drizzle.and(
          drizzle.eq(schema.applications.status, "approved"),
          drizzle.eq(schema.users.status, "active"),
          drizzle.eq(schema.memberProfiles.publishStatus, "published"),
          drizzle.eq(schema.schools.coordinateStatus, "confirmed"),
        ))
        .limit(Math.min(limit, DIRECTORY_PROFILE_CAP));

      return Promise.all(rows.map(async ({ profile, school }) => {
        const visibilityRows = await db
          .select({ fieldName: schema.profileVisibility.fieldName, visibility: schema.profileVisibility.visibility })
          .from(schema.profileVisibility)
          .where(drizzle.eq(schema.profileVisibility.profileId, profile.id));
        const visibility: VisibilityRules = {};
        for (const row of visibilityRows) {
          if (isProjectableField(row.fieldName) && isVisibility(row.visibility)) visibility[row.fieldName] = row.visibility;
        }
        return {
          approvalStatus: "approved",
          accountStatus: "active",
          publishStatus: "published",
          school,
          profile: {
            id: profile.id,
            userId: profile.userId,
            slug: profile.slug,
            nickname: profile.nickname,
            ...(profile.avatarKey ? { avatarUrl: `/api/avatars/${profile.avatarKey}` } : {}),
            school: school.name,
            city: school.city,
            intro: profile.intro,
            skills: repositoryHelpers.safeJsonArray(profile.skillsJson),
            roles: repositoryHelpers.safeJsonArray(profile.rolesJson),
            verifiedBuilder: profile.verifiedBuilder,
            contributions: [],
            ...(profile.currentFocus ? { currentFocus: profile.currentFocus } : {}),
            ...(profile.canOffer ? { canOffer: profile.canOffer } : {}),
            ...(profile.wantsToMeet ? { wantsToMeet: profile.wantsToMeet } : {}),
            workLinks: repositoryHelpers.safeJsonArray(profile.workLinksJson),
            ...(profile.major ? { major: profile.major } : {}),
            ...(profile.grade ? { grade: profile.grade } : {}),
          },
          visibility,
        } satisfies DirectoryCandidate;
      }));
    },
  };
  return createDirectoryService(repository);
}

function isProjectableField(field: string): field is keyof VisibilityRules {
  return [
    "nickname", "avatarUrl", "school", "city", "intro", "skills", "roles", "verifiedBuilder", "contributions",
    "currentFocus", "canOffer", "wantsToMeet", "workLinks", "major", "grade",
  ].includes(field);
}

function isVisibility(value: string): value is "public" | "members" | "private" {
  return value === "public" || value === "members" || value === "private";
}

export const METRIC_EVENT_TYPES = ["map_view", "profile_view", "map_to_profile"] as const;
export type MetricEventType = (typeof METRIC_EVENT_TYPES)[number];
export type MetricCounter = {
  metricDate: string;
  eventType: MetricEventType;
  dimensionKey: string;
  updatedAt: number;
};
export type MetricsRepository = { increment(counter: MetricCounter): Promise<number> };

function isMetricPayload(value: unknown): value is { eventType: MetricEventType; dimensionKey: string } {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  if (Object.keys(record).some((key) => key !== "eventType" && key !== "dimensionKey")) return false;
  if (!METRIC_EVENT_TYPES.includes(record.eventType as MetricEventType)) return false;
  return record.dimensionKey === "all"
    || (typeof record.dimensionKey === "string" && /^school:[a-zA-Z0-9][a-zA-Z0-9_-]{0,119}$/.test(record.dimensionKey));
}

export function createMetricsService(repository: MetricsRepository) {
  return {
    async record(payload: unknown, now: number): Promise<number> {
      if (!isMetricPayload(payload) || !Number.isFinite(now)) throw new Error("Invalid aggregate metric");
      return repository.increment({
        metricDate: new Date(now).toISOString().slice(0, 10),
        eventType: payload.eventType,
        dimensionKey: payload.dimensionKey,
        updatedAt: now,
      });
    },
  };
}
