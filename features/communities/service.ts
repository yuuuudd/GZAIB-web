import { safeJsonArray } from "../../lib/db/repositories/directory";
import type { CommunityDirectoryQuery, CommunityLocationMode, PublicCommunity, PublicCommunityUpdate } from "./types";
import { validateClaimInput, validateCommunityProfileInput, validateUpdateInput } from "./validation";
import type {
  communities,
  communityClaims,
  communityProfileSubmissions,
  communityUpdates,
} from "../../db/schema";

export const COMMUNITY_DIRECTORY_CAP = 2_000;
export const COMMUNITY_UPDATE_CAP = 3;

export type CommunityRecord = typeof communities.$inferSelect;
export type CommunityUpdateRecord = typeof communityUpdates.$inferSelect;
export type CommunityProfileSubmissionRecord = typeof communityProfileSubmissions.$inferSelect;
export type CommunityClaimRecord = typeof communityClaims.$inferSelect;

export type ManagedCommunitySummary = Pick<CommunityRecord, "id" | "slug" | "name" | "publishStatus">;

export type CommunityMutationRepository = {
  isPublishedCommunity(id: string): Promise<boolean>;
  isManager(userId: string, communityId: string): Promise<boolean>;
  hasPendingClaim(userId: string, communityId: string): Promise<boolean>;
  saveProfileSubmission(record: CommunityProfileSubmissionRecord): Promise<void>;
  saveClaim(record: CommunityClaimRecord): Promise<boolean>;
  saveUpdate(record: CommunityUpdateRecord): Promise<void>;
  setFollow(input: { userId: string; communityId: string; following: boolean; createdAt: number }): Promise<void>;
  listManagedCommunities(userId: string): Promise<ManagedCommunitySummary[]>;
};

export class CommunityMutationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CommunityMutationError";
  }
}

export type CommunityMutationService = {
  submitProfile(userId: string, kind: "create" | "update", communityId: string | null, input: unknown, now: number): Promise<CommunityProfileSubmissionRecord>;
  submitClaim(userId: string, input: unknown, now: number): Promise<CommunityClaimRecord>;
  submitUpdate(userId: string, input: unknown, now: number): Promise<CommunityUpdateRecord>;
  setFollow(userId: string, communityId: string, following: boolean, now: number): Promise<void>;
  listManagedCommunities(userId: string): Promise<ManagedCommunitySummary[]>;
};

export type CommunityDirectoryRepository = {
  listPublished(limit: number): Promise<CommunityRecord[]>;
  findPublishedBySlug(slug: string): Promise<CommunityRecord | undefined>;
  listPublishedUpdates(communityIds: string[], limitPerCommunity: number): Promise<CommunityUpdateRecord[]>;
  listManagerContacts(communityIds: string[]): Promise<{ communityId: string; memberSlug: string }[]>;
  listClaimedCommunityIds(communityIds: string[]): Promise<string[]>;
  listFollowedCommunityIds(userId: string, communityIds: string[]): Promise<string[]>;
};

export type CommunityDirectoryResult = {
  items: PublicCommunity[];
  citySummaries: { city: string; communityCount: number }[];
};

function normalize(value: string): string {
  return value.normalize("NFKC").trim().toLocaleLowerCase("zh-CN");
}

function normalizedCity(value: string): string {
  return value.normalize("NFKC").trim().replace(/市$/, "");
}

function isLocationMode(value: unknown): value is CommunityLocationMode {
  return value === "city" || value === "hybrid" || value === "online";
}

function matchesQuery(community: CommunityRecord, query: CommunityDirectoryQuery, focusTags: string[]): boolean {
  if (query.city && normalizedCity(community.primaryCity ?? "") !== normalizedCity(query.city)) return false;
  if (query.locationMode && community.locationMode !== query.locationMode) return false;
  if (query.focus && !focusTags.some((tag) => normalize(tag) === normalize(query.focus!))) return false;
  if (!query.q) return true;
  const keyword = normalize(query.q);
  if (!keyword) return true;
  return [community.name, community.summary, community.primaryCity ?? "", ...focusTags]
    .some((value) => normalize(value).includes(keyword));
}

function toUpdate(update: CommunityUpdateRecord): PublicCommunityUpdate {
  return {
    id: update.id,
    title: update.title,
    summary: update.summary,
    occurredAt: update.occurredAt,
    ...(update.sourceUrl ? { sourceUrl: update.sourceUrl } : {}),
  };
}

function toCommunity(
  record: CommunityRecord,
  options: { claimed: boolean; contactSlug?: string; followed?: boolean; updates: PublicCommunityUpdate[] },
): PublicCommunity {
  return {
    id: record.id,
    slug: record.slug,
    name: record.name,
    summary: record.summary,
    primaryCity: record.primaryCity,
    locationMode: record.locationMode as CommunityLocationMode,
    focusTags: safeJsonArray(record.focusTagsJson).slice(0, 8),
    officialUrl: record.officialUrl,
    sourceUrl: record.sourceUrl,
    sourceLabel: record.sourceLabel,
    updatedAt: record.updatedAt,
    claimed: options.claimed,
    ...(options.contactSlug ? { contactSlug: options.contactSlug } : {}),
    ...(options.followed === undefined ? {} : { followed: options.followed }),
    updates: options.updates,
  };
}

function isPublished(record: CommunityRecord): boolean {
  return record.publishStatus === "published" && isLocationMode(record.locationMode);
}

function sortRecords(left: CommunityRecord, right: CommunityRecord): number {
  return right.updatedAt - left.updatedAt || left.name.localeCompare(right.name, "zh-CN") || left.slug.localeCompare(right.slug);
}

async function projectCommunities(
  repository: CommunityDirectoryRepository,
  records: CommunityRecord[],
  viewerId?: string,
): Promise<PublicCommunity[]> {
  const ids = records.map((record) => record.id);
  if (!ids.length) return [];
  const [updates, contacts, claimedIds, followedIds] = await Promise.all([
    repository.listPublishedUpdates(ids, COMMUNITY_UPDATE_CAP),
    repository.listManagerContacts(ids),
    repository.listClaimedCommunityIds(ids),
    viewerId ? repository.listFollowedCommunityIds(viewerId, ids) : Promise.resolve([]),
  ]);
  const updatesByCommunity = new Map<string, PublicCommunityUpdate[]>();
  for (const update of updates) {
    if (update.status !== "published" || !ids.includes(update.communityId)) continue;
    const current = updatesByCommunity.get(update.communityId) ?? [];
    current.push(toUpdate(update));
    updatesByCommunity.set(update.communityId, current);
  }
  for (const [communityId, current] of updatesByCommunity) {
    updatesByCommunity.set(communityId, current
      .sort((left, right) => right.occurredAt - left.occurredAt || left.id.localeCompare(right.id))
      .slice(0, COMMUNITY_UPDATE_CAP));
  }

  const contactsByCommunity = new Map<string, string>();
  for (const contact of contacts) if (ids.includes(contact.communityId) && !contactsByCommunity.has(contact.communityId)) contactsByCommunity.set(contact.communityId, contact.memberSlug);
  const claimed = new Set(claimedIds);
  const followed = new Set(followedIds);
  return records.map((record) => toCommunity(record, {
    claimed: claimed.has(record.id),
    ...(contactsByCommunity.get(record.id) ? { contactSlug: contactsByCommunity.get(record.id) } : {}),
    ...(viewerId ? { followed: followed.has(record.id) } : {}),
    updates: updatesByCommunity.get(record.id) ?? [],
  }));
}

function citySummaries(records: CommunityRecord[]): CommunityDirectoryResult["citySummaries"] {
  const counts = new Map<string, number>();
  for (const record of records) {
    if (record.locationMode === "online" || !record.primaryCity) continue;
    const city = normalizedCity(record.primaryCity);
    if (city) counts.set(city, (counts.get(city) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([city, communityCount]) => ({ city, communityCount }))
    .sort((left, right) => right.communityCount - left.communityCount || left.city.localeCompare(right.city, "zh-CN"));
}

/** Public projection applies a second publication check so an adapter regression cannot expose review data. */
export function createCommunityDirectoryService(repository: CommunityDirectoryRepository) {
  return {
    async list(query: CommunityDirectoryQuery = {}, viewerId?: string): Promise<CommunityDirectoryResult> {
      const records = (await repository.listPublished(COMMUNITY_DIRECTORY_CAP))
        .slice(0, COMMUNITY_DIRECTORY_CAP)
        .filter(isPublished)
        .filter((record) => matchesQuery(record, query, safeJsonArray(record.focusTagsJson).slice(0, 8)))
        .sort(sortRecords);
      return { items: await projectCommunities(repository, records, viewerId), citySummaries: citySummaries(records) };
    },

    async getBySlug(slug: string, viewerId?: string): Promise<PublicCommunity | undefined> {
      if (!/^[a-z0-9][a-z0-9-]{0,79}$/.test(slug)) return undefined;
      const record = await repository.findPublishedBySlug(slug);
      if (!record || !isPublished(record)) return undefined;
      return (await projectCommunities(repository, [record], viewerId))[0];
    },
  };
}

export async function createRuntimeCommunityDirectoryService() {
  const [{ getDb }, { createCommunityRepository }] = await Promise.all([
    import("../../db"), import("../../lib/db/repositories/communities"),
  ]);
  return createCommunityDirectoryService(createCommunityRepository(getDb()));
}

function validated<T>(read: () => T): T {
  try {
    return read();
  } catch (error) {
    if (error instanceof CommunityMutationError) throw error;
    throw new CommunityMutationError(error instanceof Error ? error.message : "社群资料不正确");
  }
}

function communityId(value: unknown): string {
  if (typeof value !== "string") throw new CommunityMutationError("社群 ID 格式不正确");
  const normalized = value.normalize("NFKC").trim();
  if (!normalized || normalized.length > 120) throw new CommunityMutationError("社群 ID 格式不正确");
  return normalized;
}

/** All write-side identity, states, IDs, and timestamps are assigned at this server boundary. */
export function createCommunityMutationService(
  repository: CommunityMutationRepository,
  createId: () => string = () => crypto.randomUUID(),
): CommunityMutationService {
  return {
    async submitProfile(userId, kind, rawCommunityId, input, now) {
      if (kind !== "create" && kind !== "update") throw new CommunityMutationError("投稿类型不正确");
      const profile = validated(() => validateCommunityProfileInput(input));
      let targetCommunityId: string | null = null;
      if (kind === "create") {
        if (rawCommunityId !== null) throw new CommunityMutationError("新社群投稿不能指定现有社群");
      } else {
        targetCommunityId = communityId(rawCommunityId);
        if (!await repository.isManager(userId, targetCommunityId)) throw new CommunityMutationError("只有已审核负责人可以更新社群资料");
      }
      const record: CommunityProfileSubmissionRecord = {
        id: createId(),
        communityId: targetCommunityId,
        submitterUserId: userId,
        kind,
        name: profile.name,
        summary: profile.summary,
        primaryCity: profile.primaryCity,
        locationMode: profile.locationMode,
        focusTagsJson: JSON.stringify(profile.focusTags),
        officialUrl: profile.officialUrl,
        sourceUrl: profile.sourceUrl,
        sourceLabel: profile.sourceLabel,
        status: "pending",
        submittedAt: now,
        reviewedAt: null,
        reviewedBy: null,
        reviewReason: null,
        createdAt: now,
        updatedAt: now,
      };
      await repository.saveProfileSubmission(record);
      return record;
    },

    async submitClaim(userId, input, now) {
      const claim = validated(() => validateClaimInput(input));
      if (!await repository.isPublishedCommunity(claim.communityId)) throw new CommunityMutationError("社群不存在");
      if (await repository.hasPendingClaim(userId, claim.communityId)) throw new CommunityMutationError("该社群已有认领申请正在审核中，请勿重复提交");
      const record: CommunityClaimRecord = {
        id: createId(),
        communityId: claim.communityId,
        applicantUserId: userId,
        evidence: claim.evidence,
        evidenceUrl: claim.evidenceUrl ?? null,
        status: "pending",
        submittedAt: now,
        reviewedAt: null,
        reviewedBy: null,
        reviewReason: null,
        createdAt: now,
        updatedAt: now,
      };
      if (!await repository.saveClaim(record)) throw new CommunityMutationError("该社群已有认领申请正在审核中，请勿重复提交");
      return record;
    },

    async submitUpdate(userId, input, now) {
      const update = validated(() => validateUpdateInput(input));
      if (!await repository.isManager(userId, update.communityId)) throw new CommunityMutationError("只有已审核负责人可以提交社群动态");
      const record: CommunityUpdateRecord = {
        id: createId(),
        communityId: update.communityId,
        submitterUserId: userId,
        title: update.title,
        summary: update.summary,
        occurredAt: update.occurredAt,
        sourceUrl: update.sourceUrl ?? null,
        status: "pending",
        submittedAt: now,
        reviewedAt: null,
        reviewedBy: null,
        reviewReason: null,
        createdAt: now,
        updatedAt: now,
      };
      await repository.saveUpdate(record);
      return record;
    },

    async setFollow(userId, rawCommunityId, following, now) {
      const targetCommunityId = communityId(rawCommunityId);
      if (typeof following !== "boolean") throw new CommunityMutationError("关注状态格式不正确");
      if (!await repository.isPublishedCommunity(targetCommunityId)) throw new CommunityMutationError("社群不存在");
      await repository.setFollow({ userId, communityId: targetCommunityId, following, createdAt: now });
    },

    listManagedCommunities(userId) {
      return repository.listManagedCommunities(userId);
    },
  };
}

export async function createRuntimeCommunityMutationService() {
  const [{ getDb }, { createCommunityRepository }] = await Promise.all([
    import("../../db"), import("../../lib/db/repositories/communities"),
  ]);
  return createCommunityMutationService(createCommunityRepository(getDb()));
}
