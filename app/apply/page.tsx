import { asc, eq } from "drizzle-orm";
import Image from "next/image";
import Link from "next/link";
import { ApplicationForm } from "../../components/forms/ApplicationForm";
import { PrimaryNavigation } from "../../components/navigation/PrimaryNavigation";
import { getDb } from "../../db";
import { schools } from "../../db/schema";

export const dynamic = "force-dynamic";

export default async function ApplyPage() {
  const confirmedSchools = await getDb().select({ id: schools.id, name: schools.name, campus: schools.campus, city: schools.city })
    .from(schools).where(eq(schools.coordinateStatus, "confirmed")).orderBy(asc(schools.name));
  return <main className="brand-shell">
    <header className="brand-header"><Link className="brand-mark" href="/" aria-label="广州AI共创社首页"><Image src="/logo.png" alt="广州AI共创社" width={44} height={44} /><span>广州AI共创社</span></Link><PrimaryNavigation /><Link className="brand-header-action" href="/apply/status">查看申请状态</Link></header>
    <div className="application-shell"><ApplicationForm schools={confirmedSchools} /></div>
  </main>;
}
