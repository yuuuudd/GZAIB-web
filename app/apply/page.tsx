import { asc, eq } from "drizzle-orm";
import { ApplicationForm } from "../../components/forms/ApplicationForm";
import { getDb } from "../../db";
import { schools } from "../../db/schema";

export const dynamic = "force-dynamic";

export default async function ApplyPage() {
  const confirmedSchools = await getDb().select({ id: schools.id, name: schools.name, campus: schools.campus, city: schools.city })
    .from(schools).where(eq(schools.coordinateStatus, "confirmed")).orderBy(asc(schools.name));
  return <main className="brand-shell">
    <header className="brand-header"><a className="brand-mark" href="/" aria-label="广州AI共创社首页"><img src="/logo.png" alt="广州AI共创社" width="44" height="44" /><span>广州AI共创社</span></a><nav className="brand-nav" aria-label="主导航"><a href="/">共建地图</a><a href="/apply">申请点亮</a></nav><a className="brand-header-action" href="/apply/status">查看申请状态</a></header>
    <div className="application-shell"><ApplicationForm schools={confirmedSchools} /></div>
  </main>;
}
