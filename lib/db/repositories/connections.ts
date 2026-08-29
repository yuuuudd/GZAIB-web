import { and, count, desc, eq, gte, inArray, lt, or, sql } from "drizzle-orm";
import { applications, blocks, connectionRequests, memberProfiles, notifications, users } from "../../../db/schema";
import type { getDb } from "../../../db";
import type {
  ConnectionCursor,
  ConnectionNotificationPersistence,
  ConnectionRepository,
  ConnectionRequest,
  ConnectionStatus,
  CreateConnectionAtomicInput,
} from "../../../features/connections/types";

type Db = ReturnType<typeof getDb>;
const DAY_MS = 86_400_000;
const PAGE_SIZE = 30;

function transitionStatus(action: "accept" | "decline" | "withdraw"): Extract<ConnectionStatus, "accepted" | "declined" | "withdrawn"> {
  if (action === "accept") return "accepted";
  if (action === "decline") return "declined";
  return "withdrawn";
}

function toRequest(row: typeof connectionRequests.$inferSelect): ConnectionRequest {
  return {
    id: row.id,
    senderId: row.senderId,
    recipientId: row.recipientId,
    message: row.message,
    topic: row.topic,
    status: row.status as ConnectionStatus,
    createdAt: row.createdAt,
    ...(row.resolvedAt === null ? {} : { resolvedAt: row.resolvedAt }),
    updatedAt: row.updatedAt,
  };
}

function pairCondition(leftUserId: string, rightUserId: string) {
  return or(
    and(eq(connectionRequests.senderId, leftUserId), eq(connectionRequests.recipientId, rightUserId)),
    and(eq(connectionRequests.senderId, rightUserId), eq(connectionRequests.recipientId, leftUserId)),
  );
}

function cursorCondition(cursor: ConnectionCursor | undefined) {
  if (!cursor) return undefined;
  return or(
    lt(connectionRequests.createdAt, cursor.createdAt),
    and(eq(connectionRequests.createdAt, cursor.createdAt), lt(connectionRequests.id, cursor.id)),
  );
}

function toNotificationInsert(notification: ConnectionNotificationPersistence, requestId: string) {
  return sql`
    select ${notification.id}, ${notification.userId}, ${notification.type}, ${notification.title}, ${notification.body},
      ${notification.href}, ${notification.dedupeKey}, ${notification.deliveryStatus}, null, ${notification.createdAt}, ${notification.createdAt}
    where exists (select 1 from connection_requests where id = ${requestId})
  `;
}

/**
 * D1 repository for server-owned connection state. Every create guard is repeated
 * in its INSERT … SELECT so two concurrent preflight reads cannot create two pairs.
 */
export function createConnectionRepository(db: Db): ConnectionRepository {
  return {
    async getCreateContext(senderId, recipientId, input, now) {
      const since = now - DAY_MS;
      const [senderRows, recipientRows, blockRows, pendingRows, countRows] = await Promise.all([
        db.select({
          status: users.status,
          applicationStatus: applications.status,
          publishStatus: memberProfiles.publishStatus,
        }).from(users)
          .leftJoin(applications, eq(applications.userId, users.id))
          .leftJoin(memberProfiles, eq(memberProfiles.userId, users.id))
          .where(eq(users.id, senderId)),
        db.select({ id: users.id }).from(users)
          .innerJoin(applications, eq(applications.userId, users.id))
          .innerJoin(memberProfiles, eq(memberProfiles.userId, users.id))
          .where(and(
            eq(users.id, recipientId),
            inArray(users.status, ["active", "connection_suspended"]),
            eq(applications.status, "approved"),
            eq(memberProfiles.publishStatus, "published"),
          )),
        db.select({ blockerId: blocks.blockerId }).from(blocks).where(or(
          and(eq(blocks.blockerId, senderId), eq(blocks.blockedId, recipientId)),
          and(eq(blocks.blockerId, recipientId), eq(blocks.blockedId, senderId)),
        )),
        db.select({ id: connectionRequests.id }).from(connectionRequests).where(and(
          eq(connectionRequests.status, "pending"),
          pairCondition(senderId, recipientId),
        )),
        db.select({ value: count() }).from(connectionRequests).where(and(
          eq(connectionRequests.senderId, senderId),
          gte(connectionRequests.createdAt, since),
        )),
      ]);
      return {
        senderId,
        recipientId,
        senderStatus: senderRows[0]?.status ?? "missing",
        senderApproved: senderRows[0]?.applicationStatus === "approved",
        senderPublished: senderRows[0]?.publishStatus === "published",
        recipientPublished: recipientRows.length > 0,
        blockedEitherDirection: blockRows.length > 0,
        pendingEitherDirection: pendingRows.length > 0,
        requestsInLast24Hours: Number(countRows[0]?.value ?? 0),
        topic: input.topic,
        message: input.message,
      };
    },

    async createRequestAtomic(input: CreateConnectionAtomicInput) {
      const request = input.request;
      const insertRequest = db.insert(connectionRequests).select(sql`
        select ${request.id}, ${request.senderId}, ${request.recipientId}, ${request.message}, ${request.topic}, 'pending',
          ${request.createdAt}, null, ${request.updatedAt}
        from ${users}
        where ${users.id} = ${request.senderId}
          and ${users.status} = 'active'
          and ${request.senderId} <> ${request.recipientId}
          and exists (
            select 1 from applications sender_application
            inner join member_profiles sender_profile on sender_profile.user_id = sender_application.user_id
            where sender_application.user_id = ${users.id}
              and sender_application.status = 'approved'
              and sender_profile.publish_status = 'published'
          )
          and exists (
            select 1 from users recipient
            inner join applications recipient_application on recipient_application.user_id = recipient.id
            inner join member_profiles recipient_profile on recipient_profile.user_id = recipient.id
            where recipient.id = ${request.recipientId}
              and recipient.status in ('active', 'connection_suspended')
              and recipient_application.status = 'approved'
              and recipient_profile.publish_status = 'published'
          )
          and not exists (
            select 1 from blocks current_block
            where (current_block.blocker_id = ${request.senderId} and current_block.blocked_id = ${request.recipientId})
               or (current_block.blocker_id = ${request.recipientId} and current_block.blocked_id = ${request.senderId})
          )
          and not exists (
            select 1 from connection_requests pending_request
            where pending_request.status = 'pending'
              and ((pending_request.sender_id = ${request.senderId} and pending_request.recipient_id = ${request.recipientId})
                or (pending_request.sender_id = ${request.recipientId} and pending_request.recipient_id = ${request.senderId}))
          )
          and (select count(*) from connection_requests daily_request
            where daily_request.sender_id = ${request.senderId}
              and daily_request.created_at >= ${request.createdAt - DAY_MS}) < 5
      `);
      const notificationInserts = input.notifications.map((notification) => db.insert(notifications)
        .select(toNotificationInsert(notification, request.id))
        .onConflictDoNothing());
      const results = await db.batch([insertRequest, ...notificationInserts] as never) as Array<{ meta?: { changes?: number } }>;
      return { created: (results[0]?.meta?.changes ?? 0) === 1 };
    },

    async getRequest(requestId) {
      const [row] = await db.select().from(connectionRequests).where(eq(connectionRequests.id, requestId));
      return row ? toRequest(row) : undefined;
    },

    async resolveRequestAtomic(input) {
      const status = transitionStatus(input.action);
      const actorCondition = input.action === "withdraw"
        ? eq(connectionRequests.senderId, input.actorId)
        : eq(connectionRequests.recipientId, input.actorId);
      const update = db.update(connectionRequests).set({
        status,
        resolvedAt: input.now,
        updatedAt: input.now,
      }).where(and(
        eq(connectionRequests.id, input.requestId),
        eq(connectionRequests.status, "pending"),
        actorCondition,
      ));
      const notificationInserts = input.notifications.map((notification) => db.insert(notifications).select(sql`
        select ${notification.id}, ${notification.userId}, ${notification.type}, ${notification.title}, ${notification.body},
          ${notification.href}, ${notification.dedupeKey}, ${notification.deliveryStatus}, null, ${notification.createdAt}, ${notification.createdAt}
        where exists (
          select 1 from connection_requests
          where id = ${input.requestId} and status = ${status} and resolved_at = ${input.now}
        )
      `).onConflictDoNothing());
      const results = await db.batch([update, ...notificationInserts] as never) as Array<{ meta?: { changes?: number } }>;
      if ((results[0]?.meta?.changes ?? 0) !== 1) return undefined;
      return this.getRequest(input.requestId);
    },

    async listRequests(userId, box, cursor) {
      const boxCondition = box === "received"
        ? eq(connectionRequests.recipientId, userId)
        : box === "sent"
          ? eq(connectionRequests.senderId, userId)
          : and(eq(connectionRequests.status, "accepted"), or(
            eq(connectionRequests.senderId, userId), eq(connectionRequests.recipientId, userId),
          ));
      const rows = await db.select().from(connectionRequests).where(and(boxCondition, cursorCondition(cursor)))
        .orderBy(desc(connectionRequests.createdAt), desc(connectionRequests.id)).limit(PAGE_SIZE + 1);
      const page = rows.slice(0, PAGE_SIZE).map(toRequest);
      const hasMore = rows.length > PAGE_SIZE;
      const last = page.at(-1);
      return {
        items: page,
        ...(hasMore && last ? { nextCursor: { createdAt: last.createdAt, id: last.id } } : {}),
      };
    },

    async hasAcceptedRelationship(leftUserId, rightUserId) {
      const [row] = await db.select({ id: connectionRequests.id }).from(connectionRequests).where(and(
        eq(connectionRequests.status, "accepted"),
        pairCondition(leftUserId, rightUserId),
      )).limit(1);
      return Boolean(row);
    },
  };
}
