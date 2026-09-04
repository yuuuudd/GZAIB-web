import { asc, eq } from "drizzle-orm";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { ProfileEditor } from "../../components/forms/ProfileEditor";
import { BrandHomeLink } from "../../components/navigation/BrandHomeLink";
import { PrimaryNavigation } from "../../components/navigation/PrimaryNavigation";
import { getDb } from "../../db";
import { memberProfiles, schools } from "../../db/schema";
import { createContactCardService } from "../../features/connections/contact-card";
import { createRuntimeProfileAccessService } from "../../features/directory/profile-access";
import { resolveRequestUserId } from "../../features/identity/request-user";
import { createContactCardRepository } from "../../lib/db/repositories/contact-cards";
import { loadProfileVisibility } from "../../lib/db/repositories/directory";
import { accountSignInPath } from "../../features/identity/account-paths";

export const dynamic = "force-dynamic";

export default async function MemberCenterPage() {
  const requestHeaders = await headers();
  let userId: string | null;
  try { userId = await resolveRequestUserId(new Request("https://demo.local/me", { headers: requestHeaders })); }
  catch { redirect("/"); }
  if (!userId) redirect(accountSignInPath("/me"));
  const db = getDb();
  const profileAccess = await createRuntimeProfileAccessService();
  const [profile, profileRow, schoolOptions, contactCard] = await Promise.all([
    profileAccess.getOwnProfile(userId),
    db.select({ id: memberProfiles.id, schoolId: memberProfiles.schoolId, publishStatus: memberProfiles.publishStatus }).from(memberProfiles).where(eq(memberProfiles.userId, userId)).then((rows) => rows[0]),
    db.select({ id: schools.id, name: schools.name, campus: schools.campus, city: schools.city }).from(schools).where(eq(schools.coordinateStatus, "confirmed")).orderBy(asc(schools.name)),
    Promise.resolve().then(() => createContactCardService(createContactCardRepository(db)).getOwnCard(userId)).catch(() => undefined),
  ]);
  return <main className="member-center-shell">
    <header className="brand-header member-page-header"><BrandHomeLink /><PrimaryNavigation active="me" /><form action="/api/auth/logout" method="post"><button className="brand-header-action member-logout" type="submit">退出</button></form></header>
    <div className="member-center-content">{profile && profileRow
      ? <ProfileEditor profile={profile} visibility={await loadProfileVisibility(db, profileRow.id)} schools={schoolOptions} currentSchoolId={profileRow.schoolId} published={profileRow.publishStatus === "published"} contactCard={contactCard} />
      : <section className="status-card"><p className="section-kicker">我的共创空间</p><h1>资料尚未通过审核</h1><p>提交申请并通过运营审核后，你可以在这里编辑成员资料、调整公开范围或即时隐藏地图资料。</p><div className="brand-hero-actions"><a className="brand-primary-action" href="/apply">填写或查看申请 →</a><a className="brand-secondary-action" href="/events/submit">申请共建活动 →</a></div></section>}
    </div>
  </main>;
}
