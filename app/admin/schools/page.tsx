import { asc } from "drizzle-orm";
import { SchoolCoordinatePanel } from "../../../components/admin/SchoolCoordinatePanel";
import { getDb } from "../../../db";
import { schools } from "../../../db/schema";
import { requireAdminPage } from "../admin-session";

export default async function AdminSchoolsPage() {
  await requireAdminPage();
  const records = await getDb().select().from(schools).orderBy(asc(schools.province), asc(schools.city), asc(schools.name));
  return <><header className="admin-page-heading"><div><p className="admin-kicker">学校坐标</p><h1>只点亮学校，不定位个人</h1><p>通过高德搜索或手动补录学校位置，保存后即可用于成员地图。</p></div><span className="heading-count">{records.length} 所学校</span></header><SchoolCoordinatePanel schools={records} amapKey={process.env.NEXT_PUBLIC_AMAP_JS_KEY} /></>;
}
