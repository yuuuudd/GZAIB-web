import { and, eq, isNull } from "drizzle-orm";
import { getDb } from "../../../db";
import { sessions, users } from "../../../db/schema";
import type { DatabaseSessionRecord, StoredDatabaseSession } from "../../../features/identity/database-session";
import { passwordCredentials } from "../../../db/schema";
import type { createPasswordAccountRecords } from "../../../features/identity/password-auth";

export async function insertPasswordAccount(records: ReturnType<typeof createPasswordAccountRecords>): Promise<void> {
  const db = getDb();
  await db.batch([db.insert(users).values(records.user), db.insert(passwordCredentials).values(records.credential)]);
}

export type PasswordAccount = { userId: string; hash: string; salt: string; iterations: number };

export async function loadRuntimePasswordAccount(email: string): Promise<PasswordAccount | null> {
  const [row] = await getDb().select({
    userId: users.id, hash: passwordCredentials.passwordHash, salt: passwordCredentials.salt, iterations: passwordCredentials.iterations,
  }).from(users).innerJoin(passwordCredentials, eq(passwordCredentials.userId, users.id)).where(and(eq(users.email, email), eq(users.status, "active")));
  return row ?? null;
}

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
