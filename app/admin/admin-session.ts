import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { requireAdmin } from "../../features/admin/authorization";
import { isDemoMode } from "../../features/identity/demo-auth";
import { verifyDemoSession } from "../../features/identity/session";

/** Server-component guard. Pages must call this before loading any private admin data. */
export async function requireAdminPage(): Promise<"demo-admin"> {
  if (!isDemoMode()) redirect("/");
  const requestHeaders = await headers();
  try {
    return requireAdmin(await verifyDemoSession(requestHeaders.get("cookie") ?? ""));
  } catch {
    redirect("/");
  }
}
