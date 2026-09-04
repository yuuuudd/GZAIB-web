import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { resolveRequestUserId } from "../../../features/identity/request-user";
import { createRuntimeSafetyService } from "../../../features/safety/service";
import { UnblockList } from "../../../components/safety/UnblockList";
import { accountSignInPath } from "../../../features/identity/account-paths";
export const dynamic = "force-dynamic";
export default async function BlockedPage() {
  let userId: string | null;
  try { userId = await resolveRequestUserId(new Request("https://demo.local/me/blocked", { headers: await headers() })); } catch { redirect("/"); }
  if (!userId) redirect(accountSignInPath("/me/blocked"));
  const items = await (await createRuntimeSafetyService()).listBlockedUsers(userId);
  return <main className="member-center-shell"><header className="member-page-header"><Link href="/me">成员中心</Link></header><section className="member-center-content"><p className="section-kicker">隐私与安全</p><h1>已拉黑成员</h1><p>解除拉黑不会恢复此前的连接请求或联系方式访问。</p><UnblockList initialItems={items} /></section></main>;
}
