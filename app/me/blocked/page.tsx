import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { requireActiveSession } from "../../../features/identity/active-account";
import { createRuntimeSafetyService } from "../../../features/safety/service";
import { UnblockList } from "../../../components/safety/UnblockList";
export const dynamic = "force-dynamic";
export default async function BlockedPage() {
  let session;
  try { session = await requireActiveSession(new Request("https://demo.local/me/blocked", { headers: await headers() })); } catch { redirect("/"); }
  const items = await (await createRuntimeSafetyService()).listBlockedUsers(session.identity.id);
  return <main className="member-center-shell"><header className="member-page-header"><Link href="/me">成员中心</Link></header><section className="member-center-content"><p className="section-kicker">隐私与安全</p><h1>已拉黑成员</h1><p>解除拉黑不会恢复此前的连接请求或联系方式访问。</p><UnblockList initialItems={items} /></section></main>;
}
