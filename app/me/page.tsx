import { asc, eq } from "drizzle-orm";
import { headers } from "next/headers";
import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ProfileEditor } from "../../components/forms/ProfileEditor";
import { PrimaryNavigation } from "../../components/navigation/PrimaryNavigation";
import { getDb } from "../../db";
import { memberProfiles, schools } from "../../db/schema";
import { createRuntimeProfileAccessService } from "../../features/directory/profile-access";
import { requireActiveSession } from "../../features/identity/active-account";
import { loadProfileVisibility } from "../../lib/db/repositories/directory";

export const dynamic = "force-dynamic";

export default async function MemberCenterPage() {
  const requestHeaders = await headers();
  let userId: string;
  try { userId = (await requireActiveSession(new Request("https://demo.local/me", { headers: requestHeaders }))).identity.id; }
  catch { redirect("/"); }
  const db = getDb();
  const profile = await (await createRuntimeProfileAccessService()).getOwnProfile(userId);
  const [profileRow, schoolOptions] = await Promise.all([
    db.select({ id: memberProfiles.id, schoolId: memberProfiles.schoolId, publishStatus: memberProfiles.publishStatus }).from(memberProfiles).where(eq(memberProfiles.userId, userId)).then((rows) => rows[0]),
    db.select({ id: schools.id, name: schools.name, campus: schools.campus, city: schools.city }).from(schools).where(eq(schools.coordinateStatus, "confirmed")).orderBy(asc(schools.name)),
  ]);
  return <main className="member-center-shell">
    <header className="brand-header member-page-header"><Link className="brand-mark" href="/" aria-label="广州AI共创社首页"><Image src="/logo.png" alt="广州AI共创社" width={44} height={44} /><span>广州AI共创社</span></Link><PrimaryNavigation /><form action="/api/auth/logout" method="post"><button className="brand-header-action member-logout" type="submit">退出</button></form></header>
    <div className="member-center-content">{profile && profileRow
      ? <ProfileEditor profile={profile} visibility={await loadProfileVisibility(db, profileRow.id)} schools={schoolOptions} currentSchoolId={profileRow.schoolId} published={profileRow.publishStatus === "published"} />
      : <section className="status-card"><p className="section-kicker">成员中心</p><h1>资料尚未通过审核</h1><p>提交申请并通过运营审核后，你可以在这里编辑成员资料、调整公开范围或即时隐藏地图资料。</p><a className="brand-primary-action" href="/apply">填写或查看申请 →</a></section>}
    </div>
  </main>;
}
