import type { Session } from "./types";
import { requireSession } from "./session";

export class InactiveAccountError extends Error {
  constructor() {
    super("Account is inactive");
    this.name = "InactiveAccountError";
  }
}

export type ActiveAccountBoundaryDependencies = {
  requireSignedSession(request: Request): Promise<Session>;
  getAccountStatus(userId: string): Promise<string | undefined>;
};

/** Re-checks durable account state on every authenticated request; signed demo cookies alone are insufficient. */
export function createActiveAccountBoundary(dependencies: ActiveAccountBoundaryDependencies) {
  return async function requireActiveAccount(request: Request): Promise<Session> {
    const session = await dependencies.requireSignedSession(request);
    const status = await dependencies.getAccountStatus(session.identity.id);
    if (!status || status === "suspended" || status === "deleted") throw new InactiveAccountError();
    return session;
  };
}

export async function requireActiveSession(request: Request): Promise<Session> {
  const [{ getDb }, schema, { eq }] = await Promise.all([import("../../db"), import("../../db/schema"), import("drizzle-orm")]);
  const db = getDb();
  return createActiveAccountBoundary({
    requireSignedSession: requireSession,
    async getAccountStatus(userId) {
      const [account] = await db.select({ status: schema.users.status }).from(schema.users).where(eq(schema.users.id, userId));
      return account?.status;
    },
  })(request);
}
