import { desc, eq } from "drizzle-orm";
import { getDb } from "../../../db";
import { contributions, memberProfiles, schools } from "../../../db/schema";
import { ContributionReviewPanel } from "../../../components/admin/ContributionReviewPanel";
import { requireAdminPage } from "../admin-session";

export default async function AdminContributionsPage() {
  await requireAdminPage();
  const records = await getDb().select({ contribution: contributions, profile: memberProfiles, school: schools })
    .from(contributions).innerJoin(memberProfiles, eq(memberProfiles.id, contributions.profileId))
    .innerJoin(schools, eq(schools.id, memberProfiles.schoolId)).orderBy(desc(contributions.activityDate));
  const items = records.map(({ contribution, profile, school }) => ({
    id: contribution.id, profileId: profile.id, member: profile.nickname, school: school.name,
    activityKey: contribution.activityKey, title: contribution.title, activityDate: contribution.activityDate,
    role: contribution.role, outcome: contribution.outcome, publicSummary: contribution.publicSummary,
    visibility: contribution.visibility, status: contribution.status,
  }));
  return <><header className="admin-page-heading"><div><p className="admin-kicker">贡献确认</p><h1>让协作留下可信记录</h1><p>只有已确认且本人选择公开的共同活动，才会形成跨校协作连接。</p></div><span className="heading-count">{items.filter((item) => item.status === "pending").length} 条待确认</span></header><ContributionReviewPanel contributions={items} /></>;
}
