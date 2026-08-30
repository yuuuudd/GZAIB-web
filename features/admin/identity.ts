export type TrustedChatGPTUser = { userId: string; email: string };
export type RuntimeAdmin = { id: string; email: string };

/** IDs issued by the only two trusted admin boundaries: demo session or ChatGPT allowlist. */
export function isAuthorizedAdminId(value: string): boolean {
  return value === "demo-admin" || value.startsWith("chatgpt:");
}

function allowedEmails(value: string): Set<string> {
  return new Set(value.split(",").map((email) => email.trim().toLowerCase()).filter(Boolean));
}

/** Accepts only an identity provided by the trusted hosting layer and matched server-side. */
export function authorizeChatGPTAdmin(user: TrustedChatGPTUser | null, allowlist = process.env.ADMIN_EMAILS ?? ""): RuntimeAdmin {
  const email = user?.email.trim().toLowerCase();
  if (!user?.userId || !email || !allowedEmails(allowlist).has(email)) throw new Error("Forbidden");
  return { id: `chatgpt:${user.userId}`, email };
}

/** Persist the approved operator before an audited admin action uses their user ID. */
export async function ensureRuntimeAdminAccount(admin: RuntimeAdmin, now = Date.now()): Promise<void> {
  const [{ getDb }, schema] = await Promise.all([import("../../db"), import("../../db/schema")]);
  await getDb().insert(schema.users).values({
    id: admin.id,
    email: admin.email,
    role: "admin",
    status: "active",
    createdAt: now,
    updatedAt: now,
  }).onConflictDoUpdate({
    target: schema.users.id,
    set: { email: admin.email, role: "admin", status: "active", updatedAt: now },
  });
}
