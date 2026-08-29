import { and, eq, inArray, or } from "drizzle-orm";
import { applications, blocks, connectionRequests, contactCards, memberProfiles, users } from "../../../db/schema";
import type { getDb } from "../../../db";
import type { ContactCardRepository } from "../../../features/connections/contact-card";

type Db = ReturnType<typeof getDb>;

function pairCondition(leftUserId: string, rightUserId: string) {
  return or(
    and(eq(connectionRequests.senderId, leftUserId), eq(connectionRequests.recipientId, rightUserId)),
    and(eq(connectionRequests.senderId, rightUserId), eq(connectionRequests.recipientId, leftUserId)),
  );
}

/** D1 storage persists only ciphertext and its update timestamp; relationship data is read live. */
export function createContactCardRepository(db: Db): ContactCardRepository {
  return {
    async save(userId, encryptedPayload, updatedAt) {
      await db.insert(contactCards).values({ userId, encryptedPayload, updatedAt }).onConflictDoUpdate({
        target: contactCards.userId,
        set: { encryptedPayload, updatedAt },
      });
    },
    async get(userId) {
      const [row] = await db.select({ encryptedPayload: contactCards.encryptedPayload, updatedAt: contactCards.updatedAt })
        .from(contactCards).where(eq(contactCards.userId, userId));
      return row;
    },
    async getAccess(viewerId, ownerId) {
      const [acceptedRows, blockRows, accountRows] = await Promise.all([
        db.select({ id: connectionRequests.id }).from(connectionRequests).where(and(eq(connectionRequests.status, "accepted"), pairCondition(viewerId, ownerId))).limit(1),
        db.select({ blockerId: blocks.blockerId }).from(blocks).where(or(
          and(eq(blocks.blockerId, viewerId), eq(blocks.blockedId, ownerId)),
          and(eq(blocks.blockerId, ownerId), eq(blocks.blockedId, viewerId)),
        )).limit(1),
        db.select({ id: users.id }).from(users)
          .innerJoin(applications, eq(applications.userId, users.id))
          .innerJoin(memberProfiles, eq(memberProfiles.userId, users.id))
          .where(and(
            inArray(users.id, [viewerId, ownerId]),
            eq(users.status, "active"),
            eq(applications.status, "approved"),
            eq(memberProfiles.publishStatus, "published"),
          )),
      ]);
      return {
        accepted: acceptedRows.length > 0,
        blocked: blockRows.length > 0,
        viewerCanAccessContacts: accountRows.some((row) => row.id === viewerId),
        ownerCanAccessContacts: accountRows.some((row) => row.id === ownerId),
      };
    },
  };
}
