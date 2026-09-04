import type { IdentityRole, Session } from "./types";

export const DATABASE_SESSION_COOKIE = "gzaib_session";
export const DATABASE_SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1_000;

export type StoredDatabaseSession = {
  userId: string;
  email: string;
  role: IdentityRole;
  status: string;
  expiresAt: number;
  revokedAt: number | null;
};

export type DatabaseSessionRecord = {
  id: string;
  userId: string;
  tokenHash: string;
  expiresAt: number;
  revokedAt: null;
  createdAt: number;
  lastSeenAt: number;
};

type CookieOptions = { production?: boolean };

function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

function tokenFromRequest(request: Request): string | null {
  const pair = (request.headers.get("cookie") ?? "").split(";").map((part) => part.trim()).find((part) => part.startsWith(`${DATABASE_SESSION_COOKIE}=`));
  const token = pair?.slice(DATABASE_SESSION_COOKIE.length + 1);
  return token && /^[A-Za-z0-9_-]{16,128}$/u.test(token) ? token : null;
}

export async function sessionTokenHash(token: string): Promise<string> {
  return toBase64Url(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token))));
}

export async function createDatabaseSession(userId: string, now = Date.now()): Promise<{ token: string; record: DatabaseSessionRecord }> {
  const token = toBase64Url(crypto.getRandomValues(new Uint8Array(32)));
  return {
    token,
    record: {
      id: crypto.randomUUID(), userId, tokenHash: await sessionTokenHash(token),
      expiresAt: now + DATABASE_SESSION_TTL_MS, revokedAt: null, createdAt: now, lastSeenAt: now,
    },
  };
}

export function serializeDatabaseSessionCookie(token: string, now = Date.now(), options: CookieOptions = {}): string {
  const parts = [
    `${DATABASE_SESSION_COOKIE}=${token}`, "HttpOnly", "Path=/", "SameSite=Lax",
    `Max-Age=${DATABASE_SESSION_TTL_MS / 1_000}`, `Expires=${new Date(now + DATABASE_SESSION_TTL_MS).toUTCString()}`,
  ];
  if (options.production ?? process.env.NODE_ENV === "production") parts.push("Secure");
  return parts.join("; ");
}

export function clearDatabaseSessionCookie(options: CookieOptions = {}): string {
  const parts = [`${DATABASE_SESSION_COOKIE}=`, "HttpOnly", "Path=/", "SameSite=Lax", "Max-Age=0", "Expires=Thu, 01 Jan 1970 00:00:00 GMT"];
  if (options.production ?? process.env.NODE_ENV === "production") parts.push("Secure");
  return parts.join("; ");
}

export async function resolveDatabaseSession(
  request: Request,
  dependencies: { now(): number; loadByTokenHash(hash: string): Promise<StoredDatabaseSession | null> },
): Promise<Session | null> {
  const token = tokenFromRequest(request);
  if (!token) return null;
  const stored = await dependencies.loadByTokenHash(await sessionTokenHash(token));
  if (!stored || stored.revokedAt !== null || stored.expiresAt <= dependencies.now()
    || stored.status === "suspended" || stored.status === "deleted") return null;
  return { identity: { id: stored.userId, role: stored.role, displayName: stored.email }, expiresAt: stored.expiresAt };
}

export async function resolveRuntimeDatabaseSession(request: Request): Promise<Session | null> {
  const { loadPasswordSessionByTokenHash } = await import("../../lib/db/repositories/password-auth");
  return resolveDatabaseSession(request, { now: Date.now, loadByTokenHash: loadPasswordSessionByTokenHash });
}

export async function revokeRuntimeDatabaseSession(request: Request, now = Date.now()): Promise<void> {
  const token = tokenFromRequest(request);
  if (!token) return;
  const { revokePasswordSessionByTokenHash } = await import("../../lib/db/repositories/password-auth");
  await revokePasswordSessionByTokenHash(await sessionTokenHash(token), now);
}
