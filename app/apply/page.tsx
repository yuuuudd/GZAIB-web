import { asc, eq } from "drizzle-orm";
import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { ApplicationForm } from "../../components/forms/ApplicationForm";
import { BrandHomeLink } from "../../components/navigation/BrandHomeLink";
import { PrimaryNavigation } from "../../components/navigation/PrimaryNavigation";
import { getDb } from "../../db";
import { schools, users } from "../../db/schema";
import { accountSignInPath } from "../../features/identity/account-paths";
import { resolveRequestUserId } from "../../features/identity/request-user";
import { createContactCardService } from "../../features/connections/contact-card";
import { createContactCardRepository } from "../../lib/db/repositories/contact-cards";

export const dynamic = "force-dynamic";

export default async function ApplyPage() {
  const userId = await resolveRequestUserId(new Request("https://demo.local/apply", { headers: await headers() })).catch(() => null);
  if (!userId) redirect(accountSignInPath("/apply"));
  const db = getDb();
  const [confirmedSchools, [account], savedContact] = await Promise.all([
    db.select({ id: schools.id, name: schools.name, campus: schools.campus, province: schools.province, city: schools.city }).from(schools).where(eq(schools.coordinateStatus, "confirmed")).orderBy(asc(schools.name)),
    db.select({ email: users.email }).from(users).where(eq(users.id, userId)),
    createContactCardService(createContactCardRepository(db)).getOwnCard(userId).catch(() => undefined),
  ]);
  return <main className="brand-shell">
    <header className="brand-header"><BrandHomeLink /><PrimaryNavigation /><Link className="brand-header-action" href="/apply/status">查看申请状态</Link></header>
    <div className="application-shell"><ApplicationForm schools={confirmedSchools} initialContact={{ ...savedContact, email: savedContact?.email ?? account?.email }} /></div>
  </main>;
}
