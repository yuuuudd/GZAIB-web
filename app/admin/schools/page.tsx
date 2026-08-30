import { asc } from "drizzle-orm";
import { SchoolCoordinatePanel } from "../../../components/admin/SchoolCoordinatePanel";
import { getDb } from "../../../db";
import { schools } from "../../../db/schema";
import { requireAdminPage } from "../admin-session";

export default async function AdminSchoolsPage() {
  await requireAdminPage();
  const records = await getDb().select().from(schools).orderBy(asc(schools.city), asc(schools.name));
  const confirmed = records.filter((record) => record.coordinateStatus === "confirmed").length;
  return <><header className="admin-page-heading"><div><p className="admin-kicker">学校坐标</p><h1>只点亮学校，不定位个人</h1><p>高德搜索与手动补录均先保存为候选；确认后才会进入公开地图。</p></div><span className="heading-count">{confirmed} 所已确认</span></header><SchoolCoordinatePanel schools={records} amapKey={process.env.NEXT_PUBLIC_AMAP_JS_KEY} /></>;
}
