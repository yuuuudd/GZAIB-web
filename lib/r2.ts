import { env } from "cloudflare:workers";

export type AvatarBucket = {
  put(
    key: string,
    body: ReadableStream,
    options?: { httpMetadata: { contentType: string; cacheControl: string } },
  ): Promise<unknown>;
  get(key: string): Promise<{
    body: ReadableStream;
    httpMetadata?: { contentType?: string };
  } | null>;
  delete(key: string): Promise<void>;
};

type PreparedStatement = {
  bind(...values: unknown[]): PreparedStatement;
  all<T>(): Promise<{ results?: T[] }>;
};

type D1Binding = {
  prepare(query: string): PreparedStatement;
  batch(statements: PreparedStatement[]): Promise<unknown>;
};

type AvatarRuntimeBindings = {
  AVATARS?: AvatarBucket;
  DB?: D1Binding;
};

export type AvatarStorageBindings = {
  avatars: Pick<AvatarBucket, "put">;
};

function runtimeBindings(): AvatarRuntimeBindings {
  return env as unknown as AvatarRuntimeBindings;
}

export function getAvatarStorageBindings(): AvatarStorageBindings {
  const { AVATARS } = runtimeBindings();
  if (!AVATARS) throw new Error("Avatar service unavailable");
  return { avatars: AVATARS };
}

function requireAvatarBucket(): AvatarBucket {
  const bucket = runtimeBindings().AVATARS;
  if (!bucket) throw new Error("Avatar service unavailable");
  return bucket;
}

function requireAvatarDb(): D1Binding {
  const db = runtimeBindings().DB;
  if (!db) throw new Error("Avatar service unavailable");
  return db;
}

/** Atomically publishes the new key to existing application/profile records before cleanup begins. */
export async function replaceAvatarReferences(userId: string, objectKey: string): Promise<string[]> {
  const db = requireAvatarDb();
  const previous = await db.prepare(`
    SELECT avatar_key AS avatarKey FROM applications WHERE user_id = ? AND avatar_key IS NOT NULL
    UNION
    SELECT avatar_key AS avatarKey FROM member_profiles WHERE user_id = ? AND avatar_key IS NOT NULL
  `).bind(userId, userId).all<{ avatarKey: string }>();
  const now = Date.now();
  await db.batch([
    db.prepare("UPDATE applications SET avatar_key = ?, updated_at = ? WHERE user_id = ?").bind(objectKey, now, userId),
    db.prepare("UPDATE member_profiles SET avatar_key = ?, updated_at = ? WHERE user_id = ?").bind(objectKey, now, userId),
  ]);
  return (previous.results ?? []).map((row) => row.avatarKey);
}

export async function removeAvatarObject(objectKey: string): Promise<void> {
  await requireAvatarBucket().delete(objectKey);
}

export async function readAvatarObject(objectKey: string): Promise<{ body: BodyInit; contentType?: string } | null> {
  const object = await requireAvatarBucket().get(objectKey);
  return object ? { body: object.body, contentType: object.httpMetadata?.contentType } : null;
}
