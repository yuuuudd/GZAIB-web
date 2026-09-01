import { and, asc, desc, eq, inArray, lte, sql } from "drizzle-orm";
import { auditLogs, communities, communityClaims, communityFollows, communityManagers, communityProfileSubmissions, communityUpdates, memberProfiles, users } from "../../../db/schema";
import type { getDb } from "../../../db";
import type { CommunityAdminRepository, CommunityReviewField, PendingCommunityReviews } from "../../../features/admin/communities";
import type { CommunityDirectoryRepository, CommunityMutationRepository } from "../../../features/communities/service";

type Db = ReturnType<typeof getDb>;
const COMMUNITY_QUERY_ID_CHUNK_SIZE = 90;

function chunks<T>(values: T[]): T[][] {
  const result: T[][] = [];
  for (let index = 0; index < values.length; index += COMMUNITY_QUERY_ID_CHUNK_SIZE) {
    result.push(values.slice(index, index + COMMUNITY_QUERY_ID_CHUNK_SIZE));
  }
  return result;
}

/** Public reads constrain publication in SQL; admin review methods remain separately authorization-gated. */
function tags(value: string | null): string {
  if (!value) return "";
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string").join("、") : "";
  } catch {
    return "";
  }
}

function field(label: string, previous: string | null | undefined, proposed: string | null): CommunityReviewField {
  return { label, previous: previous ?? null, proposed: proposed ?? "纯线上" };
}

export function createCommunityRepository(db: Db): CommunityDirectoryRepository & CommunityMutationRepository & CommunityAdminRepository {
  return {
    async listPublished(limit) {
      return db.select().from(communities)
        .where(eq(communities.publishStatus, "published"))
        .orderBy(desc(communities.updatedAt), asc(communities.name), asc(communities.slug))
        .limit(Math.min(Math.max(limit, 0), 2_000));
    },
    async findPublishedBySlug(slug) {
      const [community] = await db.select().from(communities).where(and(
        eq(communities.slug, slug),
        eq(communities.publishStatus, "published"),
      ));
      return community;
    },
    async listPublishedUpdates(communityIds, limitPerCommunity) {
      if (!communityIds.length || limitPerCommunity < 1) return [];
      const loadChunk = async (ids: string[]) => {
        const ranked = db.$with("ranked_community_updates").as(db.select({
          id: communityUpdates.id,
          communityId: communityUpdates.communityId,
          submitterUserId: communityUpdates.submitterUserId,
          title: communityUpdates.title,
          summary: communityUpdates.summary,
          occurredAt: communityUpdates.occurredAt,
          sourceUrl: communityUpdates.sourceUrl,
          status: communityUpdates.status,
          submittedAt: communityUpdates.submittedAt,
          reviewedAt: communityUpdates.reviewedAt,
          reviewedBy: communityUpdates.reviewedBy,
          reviewReason: communityUpdates.reviewReason,
          createdAt: communityUpdates.createdAt,
          updatedAt: communityUpdates.updatedAt,
          rank: sql<number>`row_number() over (partition by ${communityUpdates.communityId} order by ${communityUpdates.occurredAt} desc, ${communityUpdates.id} asc)`.as("rank"),
        }).from(communityUpdates)
          .innerJoin(communities, eq(communities.id, communityUpdates.communityId))
          .where(and(
            inArray(communityUpdates.communityId, ids),
            eq(communityUpdates.status, "published"),
            eq(communities.publishStatus, "published"),
          )),
        );
        return db.with(ranked).select().from(ranked)
          .where(lte(ranked.rank, limitPerCommunity))
          .orderBy(asc(ranked.communityId), desc(ranked.occurredAt), asc(ranked.id));
      };
      const batches: Awaited<ReturnType<typeof loadChunk>>[] = [];
      for (const ids of chunks(communityIds)) batches.push(await loadChunk(ids));
      const rows = batches.flat().sort((left, right) => left.communityId.localeCompare(right.communityId)
        || right.occurredAt - left.occurredAt || left.id.localeCompare(right.id));
      return rows.map(({ rank, ...update }) => {
        void rank;
        return update;
      });
    },
    async listManagerContacts(communityIds) {
      if (!communityIds.length) return [];
      const loadChunk = (ids: string[]) => db.select({ communityId: communityManagers.communityId, memberSlug: memberProfiles.slug })
          .from(communityManagers)
          .innerJoin(communities, eq(communities.id, communityManagers.communityId))
          .innerJoin(users, eq(users.id, communityManagers.userId))
          .innerJoin(memberProfiles, eq(memberProfiles.userId, communityManagers.userId))
          .where(and(
            inArray(communityManagers.communityId, ids),
            eq(communities.publishStatus, "published"),
            eq(memberProfiles.publishStatus, "published"),
            inArray(users.status, ["active", "connection_suspended"]),
          ))
          .orderBy(asc(memberProfiles.slug));
      const batches: Awaited<ReturnType<typeof loadChunk>>[] = [];
      for (const ids of chunks(communityIds)) batches.push(await loadChunk(ids));
      return batches.flat().sort((left, right) => left.memberSlug.localeCompare(right.memberSlug)
        || left.communityId.localeCompare(right.communityId));
    },
    async listClaimedCommunityIds(communityIds) {
      if (!communityIds.length) return [];
      const ids: string[] = [];
      for (const communityIdChunk of chunks(communityIds)) {
        const rows = await db.select({ communityId: communityClaims.communityId }).from(communityClaims)
          .innerJoin(communities, eq(communities.id, communityClaims.communityId))
          .where(and(
            inArray(communityClaims.communityId, communityIdChunk),
            eq(communityClaims.status, "approved"),
            eq(communities.publishStatus, "published"),
          ));
        ids.push(...rows.map((row) => row.communityId));
      }
      return ids.sort();
    },
    async listFollowedCommunityIds(userId, communityIds) {
      if (!communityIds.length) return [];
      const ids: string[] = [];
      for (const communityIdChunk of chunks(communityIds)) {
        const rows = await db.select({ communityId: communityFollows.communityId }).from(communityFollows)
          .innerJoin(communities, eq(communities.id, communityFollows.communityId))
          .where(and(
            eq(communityFollows.userId, userId),
            inArray(communityFollows.communityId, communityIdChunk),
            eq(communities.publishStatus, "published"),
          ));
        ids.push(...rows.map((row) => row.communityId));
      }
      return ids.sort();
    },
    async isPublishedCommunity(id) {
      const [community] = await db.select({ id: communities.id }).from(communities).where(and(
        eq(communities.id, id),
        eq(communities.publishStatus, "published"),
      ));
      return Boolean(community);
    },
    async isManager(userId, communityId) {
      const [manager] = await db.select({ userId: communityManagers.userId }).from(communityManagers).where(and(
        eq(communityManagers.userId, userId),
        eq(communityManagers.communityId, communityId),
      ));
      return Boolean(manager);
    },
    async hasPendingClaim(userId, communityId) {
      const [claim] = await db.select({ id: communityClaims.id }).from(communityClaims).where(and(
        eq(communityClaims.applicantUserId, userId),
        eq(communityClaims.communityId, communityId),
        eq(communityClaims.status, "pending"),
      ));
      return Boolean(claim);
    },
    async saveProfileSubmission(record) {
      await db.insert(communityProfileSubmissions).values(record);
    },
    async saveClaim(record) {
      const inserted = await db.insert(communityClaims).values(record).onConflictDoNothing().returning({ id: communityClaims.id });
      return inserted.length === 1;
    },
    async saveUpdate(record) {
      await db.insert(communityUpdates).values(record);
    },
    async setFollow({ userId, communityId, following, createdAt }) {
      if (following) {
        await db.insert(communityFollows).values({ userId, communityId, createdAt }).onConflictDoNothing();
        return;
      }
      await db.delete(communityFollows).where(and(
        eq(communityFollows.userId, userId),
        eq(communityFollows.communityId, communityId),
      ));
    },
    async listManagedCommunities(userId) {
      return db.select({
        id: communities.id,
        slug: communities.slug,
        name: communities.name,
        publishStatus: communities.publishStatus,
      }).from(communityManagers)
        .innerJoin(communities, eq(communities.id, communityManagers.communityId))
        .where(eq(communityManagers.userId, userId))
        .orderBy(asc(communities.name), asc(communities.slug));
    },
    async reviewAtomic(input) {
      const source = input.kind === "profile"
        ? communityProfileSubmissions
        : input.kind === "claim" ? communityClaims : communityUpdates;
      const profileTargetExists = input.kind === "profile" && input.status === "approved"
        ? sql`and (${communityProfileSubmissions.kind} = 'create' or (${communityProfileSubmissions.kind} = 'update' and exists (
            select 1 from ${communities} where ${communities.id} = ${communityProfileSubmissions.communityId}
          )))`
        : sql``;
      const gateAudit = db.insert(auditLogs).select(sql`
        select ${input.audit.id}, ${input.audit.actorUserId}, ${input.audit.targetType}, ${input.audit.targetId},
          ${input.audit.action}, ${input.audit.diffJson}, ${input.audit.createdAt}
        from ${source}
        where ${source.id} = ${input.id} and ${source.status} = 'pending' ${profileTargetExists}
      `);
      const auditExists = sql`exists (select 1 from ${auditLogs} where ${auditLogs.id} = ${input.audit.id})`;
      const operations: unknown[] = [gateAudit];

      if (input.kind === "profile") {
        if (input.status !== "approved" && input.status !== "changes_requested" && input.status !== "rejected") {
          throw new Error("Invalid profile review transition");
        }
        if (input.status === "approved") {
          if (!input.newCommunity) throw new Error("Missing server-owned community identity");
          operations.push(
            db.insert(communities).select(sql`
              select ${input.newCommunity.id}, ${input.newCommunity.slug},
                ${communityProfileSubmissions.name}, ${communityProfileSubmissions.summary}, ${communityProfileSubmissions.primaryCity},
                ${communityProfileSubmissions.locationMode}, ${communityProfileSubmissions.focusTagsJson},
                ${communityProfileSubmissions.officialUrl}, ${communityProfileSubmissions.sourceUrl}, ${communityProfileSubmissions.sourceLabel},
                'published', ${input.reviewedAt}, ${input.reviewedAt}, ${input.reviewedAt}
              from ${communityProfileSubmissions}
              where ${communityProfileSubmissions.id} = ${input.id}
                and ${communityProfileSubmissions.kind} = 'create' and ${auditExists}
            `),
            db.update(communities).set({
              name: sql`(select ${communityProfileSubmissions.name} from ${communityProfileSubmissions} where ${communityProfileSubmissions.id} = ${input.id})`,
              summary: sql`(select ${communityProfileSubmissions.summary} from ${communityProfileSubmissions} where ${communityProfileSubmissions.id} = ${input.id})`,
              primaryCity: sql`(select ${communityProfileSubmissions.primaryCity} from ${communityProfileSubmissions} where ${communityProfileSubmissions.id} = ${input.id})`,
              locationMode: sql`(select ${communityProfileSubmissions.locationMode} from ${communityProfileSubmissions} where ${communityProfileSubmissions.id} = ${input.id})`,
              focusTagsJson: sql`(select ${communityProfileSubmissions.focusTagsJson} from ${communityProfileSubmissions} where ${communityProfileSubmissions.id} = ${input.id})`,
              officialUrl: sql`(select ${communityProfileSubmissions.officialUrl} from ${communityProfileSubmissions} where ${communityProfileSubmissions.id} = ${input.id})`,
              sourceUrl: sql`(select ${communityProfileSubmissions.sourceUrl} from ${communityProfileSubmissions} where ${communityProfileSubmissions.id} = ${input.id})`,
              sourceLabel: sql`(select ${communityProfileSubmissions.sourceLabel} from ${communityProfileSubmissions} where ${communityProfileSubmissions.id} = ${input.id})`,
              publishStatus: "published",
              publishedAt: sql`coalesce(${communities.publishedAt}, ${input.reviewedAt})`,
              updatedAt: input.reviewedAt,
            }).where(and(
              eq(communities.id, sql`(select ${communityProfileSubmissions.communityId} from ${communityProfileSubmissions} where ${communityProfileSubmissions.id} = ${input.id} and ${communityProfileSubmissions.kind} = 'update')`),
              auditExists,
            )),
          );
        }
        operations.push(db.update(communityProfileSubmissions).set({
          communityId: input.status === "approved" && input.newCommunity
            ? sql`case when ${communityProfileSubmissions.kind} = 'create' then ${input.newCommunity.id} else ${communityProfileSubmissions.communityId} end`
            : communityProfileSubmissions.communityId,
          status: input.status,
          reviewedBy: input.reviewedBy,
          reviewedAt: input.reviewedAt,
          reviewReason: input.reviewReason,
          updatedAt: input.reviewedAt,
        }).where(and(
          eq(communityProfileSubmissions.id, input.id),
          eq(communityProfileSubmissions.status, "pending"),
          auditExists,
        )));
      } else if (input.kind === "claim") {
        if (input.status !== "approved" && input.status !== "changes_requested" && input.status !== "rejected") {
          throw new Error("Invalid claim review transition");
        }
        if (input.status === "approved") {
          operations.push(db.insert(communityManagers).select(sql`
            select ${communityClaims.communityId}, ${communityClaims.applicantUserId}, 'owner', ${input.reviewedAt}
            from ${communityClaims}
            where ${communityClaims.id} = ${input.id} and ${auditExists}
          `).onConflictDoNothing());
        }
        operations.push(db.update(communityClaims).set({
          status: input.status,
          reviewedBy: input.reviewedBy,
          reviewedAt: input.reviewedAt,
          reviewReason: input.reviewReason,
          updatedAt: input.reviewedAt,
        }).where(and(eq(communityClaims.id, input.id), eq(communityClaims.status, "pending"), auditExists)));
      } else {
        if (input.status !== "published" && input.status !== "changes_requested" && input.status !== "rejected") {
          throw new Error("Invalid update review transition");
        }
        operations.push(db.update(communityUpdates).set({
          status: input.status,
          reviewedBy: input.reviewedBy,
          reviewedAt: input.reviewedAt,
          reviewReason: input.reviewReason,
          updatedAt: input.reviewedAt,
        }).where(and(eq(communityUpdates.id, input.id), eq(communityUpdates.status, "pending"), auditExists)));
      }

      const results = await db.batch(operations as never) as Array<{ meta?: { changes?: number } }>;
      return { transitioned: (results[0]?.meta?.changes ?? 0) === 1 };
    },
    async listPendingReviews(): Promise<PendingCommunityReviews> {
      const [profileRows, claimRows, updateRows] = await Promise.all([
        db.select({
          submission: communityProfileSubmissions,
          current: communities,
          email: users.email,
          nickname: memberProfiles.nickname,
        }).from(communityProfileSubmissions)
          .innerJoin(users, eq(users.id, communityProfileSubmissions.submitterUserId))
          .leftJoin(memberProfiles, eq(memberProfiles.userId, communityProfileSubmissions.submitterUserId))
          .leftJoin(communities, eq(communities.id, communityProfileSubmissions.communityId))
          .where(eq(communityProfileSubmissions.status, "pending"))
          .orderBy(asc(communityProfileSubmissions.submittedAt), asc(communityProfileSubmissions.id)),
        db.select({
          claim: communityClaims,
          communityName: communities.name,
          email: users.email,
          nickname: memberProfiles.nickname,
        }).from(communityClaims)
          .innerJoin(communities, eq(communities.id, communityClaims.communityId))
          .innerJoin(users, eq(users.id, communityClaims.applicantUserId))
          .leftJoin(memberProfiles, eq(memberProfiles.userId, communityClaims.applicantUserId))
          .where(eq(communityClaims.status, "pending"))
          .orderBy(asc(communityClaims.submittedAt), asc(communityClaims.id)),
        db.select({
          update: communityUpdates,
          communityName: communities.name,
          email: users.email,
          nickname: memberProfiles.nickname,
        }).from(communityUpdates)
          .innerJoin(communities, eq(communities.id, communityUpdates.communityId))
          .innerJoin(users, eq(users.id, communityUpdates.submitterUserId))
          .leftJoin(memberProfiles, eq(memberProfiles.userId, communityUpdates.submitterUserId))
          .where(eq(communityUpdates.status, "pending"))
          .orderBy(asc(communityUpdates.submittedAt), asc(communityUpdates.id)),
      ]);
      return {
        profiles: profileRows.map(({ submission, current, email, nickname }) => ({
          kind: "profile" as const,
          id: submission.id,
          submissionKind: submission.kind,
          communityId: submission.communityId,
          title: submission.name,
          sourceUrl: submission.sourceUrl,
          sourceLabel: submission.sourceLabel,
          submitter: nickname ?? email,
          submitterEmail: email,
          submittedAt: submission.submittedAt,
          fields: [
            field("名称", current?.name, submission.name),
            field("简介", current?.summary, submission.summary),
            field("主要城市", current?.primaryCity, submission.primaryCity),
            field("地点模式", current?.locationMode, submission.locationMode),
            field("关注方向", tags(current?.focusTagsJson ?? null), tags(submission.focusTagsJson)),
            field("官方入口", current?.officialUrl, submission.officialUrl),
            field("来源", current ? `${current.sourceLabel} · ${current.sourceUrl}` : null, `${submission.sourceLabel} · ${submission.sourceUrl}`),
          ],
        })),
        claims: claimRows.map(({ claim, communityName, email, nickname }) => ({
          kind: "claim" as const,
          id: claim.id,
          communityId: claim.communityId,
          title: communityName,
          evidence: claim.evidence,
          evidenceUrl: claim.evidenceUrl,
          submitter: nickname ?? email,
          submitterEmail: email,
          submittedAt: claim.submittedAt,
        })),
        updates: updateRows.map(({ update, communityName, email, nickname }) => ({
          kind: "update" as const,
          id: update.id,
          communityId: update.communityId,
          communityName,
          title: update.title,
          summary: update.summary,
          occurredAt: update.occurredAt,
          sourceUrl: update.sourceUrl,
          submitter: nickname ?? email,
          submitterEmail: email,
          submittedAt: update.submittedAt,
        })),
      };
    },
  };
}
