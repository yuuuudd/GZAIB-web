import { asc, eq } from "drizzle-orm";
import { getDb } from "../../../db";
import { memberProfiles, schools, users } from "../../../db/schema";
import { MemberStatusPanel } from "../../../components/admin/MemberStatusPanel";
import { safeJsonArray } from "../../../lib/db/repositories/directory";
import { requireAdminPage } from "../admin-session";

export default async function AdminMembersPage() {
  await requireAdminPage();
  const records = await getDb().select({ user: users, profile: memberProfiles, school: schools }).from(users)
    .leftJoin(memberProfiles, eq(memberProfiles.userId, users.id)).leftJoin(schools, eq(schools.id, memberProfiles.schoolId))
    .where(eq(users.role, "member")).orderBy(asc(users.createdAt));
  const members = records.map(({ user, profile, school }) => ({
    id: user.id, email: user.email, nickname: profile?.nickname ?? "待完善演示成员", realName: profile?.realName ?? undefined,
    school: school?.name, campus: school?.campus, city: school?.city, major: profile?.major ?? undefined, grade: profile?.grade ?? undefined,
    intro: profile?.intro, skills: safeJsonArray(profile?.skillsJson), interests: safeJsonArray(profile?.interestsJson),
    roles: safeJsonArray(profile?.rolesJson), workLinks: safeJsonArray(profile?.workLinksJson), currentFocus: profile?.currentFocus ?? undefined,
    canOffer: profile?.canOffer ?? undefined, wantsToMeet: profile?.wantsToMeet ?? undefined, slug: profile?.slug,
    status: user.status, publishStatus: profile?.publishStatus, verifiedBuilder: profile?.verifiedBuilder ?? false,
    adminManaged: profile?.adminManaged ?? false, createdAt: new Date(user.createdAt).toISOString().slice(0, 10),
  }));
  return <><header className="admin-page-heading"><div><p className="admin-kicker">成员管理</p><h1>成员资料与账号状态</h1><p>查看完整资料，并对隐藏、恢复、暂停和删除操作保留审计记录。</p></div><span className="heading-count">{members.length} 位成员</span></header><MemberStatusPanel members={members} /></>;
}
