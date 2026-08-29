import { asc } from "drizzle-orm";
import { getDb } from "../../../db";
import { schools } from "../../../db/schema";
import { SchoolCoordinatePanel } from "../../../components/admin/SchoolCoordinatePanel";
import { requireAdminPage } from "../admin-session";

export default async function AdminSchoolsPage() {
  await requireAdminPage();
  const records = await getDb().select().from(schools).orderBy(asc(schools.city), asc(schools.name));
  return <><header className="admin-page-heading"><div><p className="admin-kicker">学校坐标</p><h1>只点亮学校，不定位个人</h1><p>地理编码只生成候选；运营员确认前不会进入公开地图。</p></div><span className="heading-count">{records.filter((record) => record.coordinateStatus === "confirmed").length} 所已确认</span></header><SchoolCoordinatePanel schools={records} /></>;
}
