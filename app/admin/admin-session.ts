import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { requireAdmin } from "../../features/admin/authorization";
import { authorizeChatGPTAdmin, ensureRuntimeAdminAccount } from "../../features/admin/identity";
import { getChatGPTUser } from "../chatgpt-auth";
import { isDemoMode } from "../../features/identity/demo-auth";
import { requireActiveSession } from "../../features/identity/active-account";

/** Server-component guard. Pages must call this before loading any private admin data. */
export async function requireAdminPage(): Promise<string> {
  try {
    if (!isDemoMode()) {
      const user = await getChatGPTUser();
      const admin = authorizeChatGPTAdmin(user, process.env.ADMIN_EMAILS ?? "");
      await ensureRuntimeAdminAccount(admin);
      return admin.id;
    }
    const requestHeaders = await headers();
    return requireAdmin(await requireActiveSession(new Request("https://demo.local/admin", { headers: requestHeaders })));
  } catch {
    redirect("/");
  }
}
