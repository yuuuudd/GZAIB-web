import { and, eq, isNull } from "drizzle-orm";
import { getDb } from "../../../db";
import { sessions, users } from "../../../db/schema";
import type { DatabaseSessionRecord, StoredDatabaseSession } from "../../../features/identity/database-session";

export async function loadPasswordSessionByTokenHash(tokenHash: string): Promise<StoredDatabaseSession | null> {
  const [row] = await getDb().select({
    userId: sessions.userId, email: users.email, role: users.role, status: users.status,
    expiresAt: sessions.expiresAt, revokedAt: sessions.revokedAt,
  }).from(sessions).innerJoin(users, eq(users.id, sessions.userId)).where(eq(sessions.tokenHash, tokenHash));
  return row ?? null;
}

export async function insertPasswordSession(record: DatabaseSessionRecord): Promise<void> {
  await getDb().insert(sessions).values(record);
}

export async function revokePasswordSessionByTokenHash(tokenHash: string, now: number): Promise<void> {
  await getDb().update(sessions).set({ revokedAt: now }).where(and(eq(sessions.tokenHash, tokenHash), isNull(sessions.revokedAt)));
}
