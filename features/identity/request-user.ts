import { isDemoMode } from "./demo-auth";
import { resolveOptionalActiveSession } from "./active-account";

export type ChatGPTAccount = { id: string; email: string };

export type RequestUserDependencies = {
  isDemoMode(): boolean;
  requireDemoSession(request: Request): Promise<{ identity: { id: string } } | null>;
  ensureChatGPTAccount(account: ChatGPTAccount): Promise<void>;
};

function chatGPTAccountFromHeaders(headers: Headers): ChatGPTAccount | null {
  const userId = headers.get("oai-authenticated-user-id")?.trim();
  const email = headers.get("oai-authenticated-user-email")?.trim().toLowerCase();
  return userId && email ? { id: `chatgpt:${userId}`, email } : null;
}

export async function ensureRuntimeChatGPTAccount(account: ChatGPTAccount, now = Date.now()): Promise<void> {
  const [{ getDb }, schema, { eq }] = await Promise.all([import("../../db"), import("../../db/schema"), import("drizzle-orm")]);
  const db = getDb();
  await db.insert(schema.users).values({ id: account.id, email: account.email, role: "member", status: "active", createdAt: now, updatedAt: now }).onConflictDoUpdate({
    target: schema.users.id,
    set: { email: account.email, updatedAt: now },
  });
  const [stored] = await db.select({ status: schema.users.status }).from(schema.users).where(eq(schema.users.id, account.id));
  if (!stored || stored.status === "suspended" || stored.status === "deleted") throw new Error("Account is inactive");
}

export async function resolveRequestUserId(request: Request, dependencies: RequestUserDependencies = {
  isDemoMode,
  requireDemoSession: resolveOptionalActiveSession,
  ensureChatGPTAccount: ensureRuntimeChatGPTAccount,
}): Promise<string | null> {
  if (dependencies.isDemoMode()) return (await dependencies.requireDemoSession(request))?.identity.id ?? null;
  const account = chatGPTAccountFromHeaders(request.headers);
  if (!account) return null;
  await dependencies.ensureChatGPTAccount(account);
  return account.id;
}
