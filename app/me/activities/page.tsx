import { desc, eq } from "drizzle-orm";
import { headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { BrandHomeLink } from "../../../components/navigation/BrandHomeLink";
import { PrimaryNavigation } from "../../../components/navigation/PrimaryNavigation";
import { getDb } from "../../../db";
import { activityProposals } from "../../../db/schema";
import { resolveRequestUserId } from "../../../features/identity/request-user";
import { accountSignInPath } from "../../../features/identity/account-paths";

const statusLabels = { pending: "等待联系", changes_requested: "需要补充", accepted: "进入共建", declined: "暂未推进" };

export const dynamic = "force-dynamic";

export default async function MyActivityProposalsPage() {
  let userId: string | null;
  try { userId = await resolveRequestUserId(new Request("https://demo.local/me/activities", { headers: await headers() })); }
  catch { redirect("/"); }
  if (!userId) redirect(accountSignInPath("/me/activities"));
  const proposals = await getDb().select().from(activityProposals).where(eq(activityProposals.userId, userId)).orderBy(desc(activityProposals.submittedAt));
  return <main className="member-center-shell"><header className="brand-header member-page-header"><BrandHomeLink /><PrimaryNavigation active="events" /><Link className="brand-header-action" href="/events/submit">申请共建活动</Link></header><div className="member-center-content"><section className="status-card"><p className="section-kicker">我的共创空间</p><h1>我的活动申请</h1><p>运营团队会通过你的账号邮箱联系你。</p></section><div className="activity-proposal-list">{proposals.length ? proposals.map((proposal) => <article key={proposal.id}><span>{statusLabels[proposal.status]}</span><h2>{proposal.title}</h2><p>{proposal.summary}</p></article>) : <p>还没有活动申请。想做点什么，就从一个简单想法开始。</p>}</div></div></main>;
}
