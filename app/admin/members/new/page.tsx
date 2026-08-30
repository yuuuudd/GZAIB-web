import { asc } from "drizzle-orm";
import { ManualMemberForm } from "../../../../components/admin/ManualMemberForm";
import { getDb } from "../../../../db";
import { schools } from "../../../../db/schema";
import { requireAdminPage } from "../../admin-session";

export default async function NewManualMemberPage() {
  await requireAdminPage();
  const schoolRows = await getDb().select({ id: schools.id, name: schools.name, campus: schools.campus, city: schools.city, coordinateStatus: schools.coordinateStatus }).from(schools).orderBy(asc(schools.name));
  return <>{schoolRows.length === 0 ? <p className="admin-action-message">还没有可选学校。请先前往 <a href="/admin/schools">学校坐标</a>，用高德搜索或手动坐标补录并确认。</p> : null}<ManualMemberForm schools={schoolRows} /></>;
}
