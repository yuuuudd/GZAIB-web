import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { requireAdmin } from "../../features/admin/authorization";
import { authorizeChatGPTAdmin, ensureRuntimeAdminAccount } from "../../features/admin/identity";
import { getChatGPTUser } from "../chatgpt-auth";
import { isDemoMode } from "../../features/identity/demo-auth";
import { requireActiveSession } from "../../features/identity/active-account";
import { resolveRuntimeDatabaseSession } from "../../features/identity/database-session";
import { accountSignInPath } from "../../features/identity/account-paths";

/** Server-component guard. Pages must call this before loading any private admin data. */
export async function requireAdminPage(): Promise<string> {
  const requestHeaders = await headers();
  if (isDemoMode()) {
    try {
      return requireAdmin(await requireActiveSession(new Request("https://demo.local/admin", { headers: requestHeaders })));
    } catch { redirect("/"); }
  }
  let account;
  try { account = await resolveRuntimeDatabaseSession(new Request("https://site.local/admin", { headers: requestHeaders })); }
  catch { redirect("/"); }
  if (account) {
    if (account.identity.role === "admin") return account.identity.id;
    redirect("/");
  }
  if (process.env.AUTH_MODE === "local") redirect(accountSignInPath("/admin", "local"));
  try {
      const user = await getChatGPTUser();
      const admin = authorizeChatGPTAdmin(user, process.env.ADMIN_EMAILS ?? "");
      await ensureRuntimeAdminAccount(admin);
      return admin.id;
  } catch {
    redirect("/");
  }
}
