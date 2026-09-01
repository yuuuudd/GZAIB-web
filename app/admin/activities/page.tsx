import { asc, eq } from "drizzle-orm";
import { getDb } from "../../../db";
import { activityProposals, users } from "../../../db/schema";

export default async function AdminActivityProposalsPage() {
  const rows = await getDb().select({ proposal: activityProposals, email: users.email }).from(activityProposals).innerJoin(users, eq(users.id, activityProposals.userId)).orderBy(asc(activityProposals.submittedAt));
  return <><header className="admin-page-heading"><div><p className="admin-kicker">活动共建</p><h1>活动申请</h1><p>联系方式来自申请人的账号邮箱，不在公开页面展示。</p></div><span className="heading-count">{rows.length} 条</span></header><div className="admin-list-card">{rows.map(({ proposal, email }) => <article key={proposal.id}><div><strong>{proposal.title}</strong><span>{proposal.stage} · {proposal.status}</span><small>{email}</small><p>{proposal.summary}</p></div></article>)}</div></>;
}
