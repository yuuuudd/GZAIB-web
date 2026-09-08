import { asc } from "drizzle-orm";
import { ManualMemberForm } from "../../../../components/admin/ManualMemberForm";
import { getDb } from "../../../../db";
import { schools } from "../../../../db/schema";
import { requireAdminPage } from "../../admin-session";

export default async function NewManualMemberPage() {
  await requireAdminPage();
  const schoolRows = await getDb().select({ id: schools.id, name: schools.name, campus: schools.campus, province: schools.province, city: schools.city, coordinateStatus: schools.coordinateStatus }).from(schools).orderBy(asc(schools.name));
  return <ManualMemberForm schools={schoolRows} amapKey={process.env.NEXT_PUBLIC_AMAP_JS_KEY} />;
}
