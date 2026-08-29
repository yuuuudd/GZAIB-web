import { asc, eq, ne } from "drizzle-orm";
import { getDb } from "../../../db";
import { memberProfiles, schools, users } from "../../../db/schema";
import { MemberStatusPanel } from "../../../components/admin/MemberStatusPanel";
import { requireAdminPage } from "../admin-session";

export default async function AdminMembersPage() {
  await requireAdminPage();
  const records = await getDb().select({ user: users, profile: memberProfiles, school: schools }).from(users)
    .leftJoin(memberProfiles, eq(memberProfiles.userId, users.id)).leftJoin(schools, eq(schools.id, memberProfiles.schoolId))
    .where(ne(users.id, "demo-admin")).orderBy(asc(users.createdAt));
  const members = records.map(({ user, profile, school }) => ({
    id: user.id, nickname: profile?.nickname ?? "待完善演示成员", ...(school ? { school: school.name } : {}),
    status: user.status, verifiedBuilder: profile?.verifiedBuilder ?? false,
  }));
  return <><header className="admin-page-heading"><div><p className="admin-kicker">成员管理</p><h1>安全状态与社区边界</h1><p>隐藏、恢复与暂停操作都通过共享状态服务，并各写入一条审计记录。</p></div><span className="heading-count">{members.length} 位成员</span></header><MemberStatusPanel members={members} /></>;
}
