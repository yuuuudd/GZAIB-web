import { asc, eq } from "drizzle-orm";
import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { ApplicationForm } from "../../components/forms/ApplicationForm";
import { BrandHomeLink } from "../../components/navigation/BrandHomeLink";
import { PrimaryNavigation } from "../../components/navigation/PrimaryNavigation";
import { getDb } from "../../db";
import { schools } from "../../db/schema";
import { accountSignInPath } from "../../features/identity/account-paths";
import { resolveRequestUserId } from "../../features/identity/request-user";

export const dynamic = "force-dynamic";

export default async function ApplyPage() {
  const userId = await resolveRequestUserId(new Request("https://demo.local/apply", { headers: await headers() })).catch(() => null);
  if (!userId) redirect(accountSignInPath("/apply"));
  const confirmedSchools = await getDb().select({ id: schools.id, name: schools.name, campus: schools.campus, city: schools.city })
    .from(schools).where(eq(schools.coordinateStatus, "confirmed")).orderBy(asc(schools.name));
  return <main className="brand-shell">
    <header className="brand-header"><BrandHomeLink /><PrimaryNavigation /><Link className="brand-header-action" href="/apply/status">查看申请状态</Link></header>
    <div className="application-shell"><ApplicationForm schools={confirmedSchools} /></div>
  </main>;
}
