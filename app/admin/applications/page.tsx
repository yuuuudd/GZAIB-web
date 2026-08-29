import { asc, eq } from "drizzle-orm";
import { getDb } from "../../../db";
import { applications, schools } from "../../../db/schema";
import { ApplicationReviewPanel, type ReviewApplicationItem } from "../../../components/admin/ApplicationReviewPanel";
import { safeJsonArray } from "../../../lib/db/repositories/directory";
import { requireAdminPage } from "../admin-session";

function visibility(value: string): Record<string, string> {
  try { const parsed: unknown = JSON.parse(value); return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as Record<string, string> : {}; }
  catch { return {}; }
}

export default async function AdminApplicationsPage() {
  await requireAdminPage();
  const rows = await getDb().select({ application: applications, school: schools }).from(applications)
    .innerJoin(schools, eq(schools.id, applications.schoolId))
    .where(eq(applications.status, "pending")).orderBy(asc(applications.submittedAt));
  const items: ReviewApplicationItem[] = rows.map(({ application, school }) => ({
    id: application.id, nickname: application.nickname, ...(application.realName ? { realName: application.realName } : {}),
    school: school.name, campus: school.campus, city: school.city, intro: application.intro,
    ...(application.major ? { major: application.major } : {}), ...(application.grade ? { grade: application.grade } : {}),
    skills: safeJsonArray(application.skillsJson), roles: safeJsonArray(application.rolesJson),
    visibility: visibility(application.visibilityJson), ...(application.submittedAt ? { submittedAt: application.submittedAt } : {}),
    coordinateStatus: school.coordinateStatus,
  }));
  return <><header className="admin-page-heading"><div><p className="admin-kicker">成员申请</p><h1>审核公开资料</h1><p>私密申请资料只在服务端固定运营员会话通过后读取。</p></div><span className="heading-count">{items.length} 条待审核</span></header><ApplicationReviewPanel applications={items} /></>;
}
