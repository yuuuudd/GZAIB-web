import { users } from "../../../db/schema";
import type { getDb } from "../../../db";
import type { DemoIdentity } from "../../../features/identity/types";

type Db = ReturnType<typeof getDb>;

/** Stores only deterministic, non-contact demo records required by the existing users schema. */
export async function ensureDemoIdentity(db: Db, identity: DemoIdentity, now: number): Promise<void> {
  const syntheticAddress = `${identity.id}@demo.invalid`;
  await db.insert(users).values({
    id: identity.id,
    email: syntheticAddress,
    role: identity.role,
    status: "active",
    createdAt: now,
    updatedAt: now,
  }).onConflictDoUpdate({
    target: users.id,
    set: {
      email: syntheticAddress,
      role: identity.role,
      status: "active",
      updatedAt: now,
    },
  });
}
