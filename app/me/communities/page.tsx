import { headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { CommunitySubmissionForm } from "../../../components/communities/CommunitySubmissionForm";
import { BrandHomeLink } from "../../../components/navigation/BrandHomeLink";
import { PrimaryNavigation } from "../../../components/navigation/PrimaryNavigation";
import { createRuntimeCommunityMutationService } from "../../../features/communities/service";
import { resolveRequestUserId } from "../../../features/identity/request-user";
import { accountSignInPath } from "../../../features/identity/account-paths";

export const dynamic = "force-dynamic";

export default async function ManagedCommunitiesPage() {
  const requestHeaders = await headers();
  let userId: string | null = null;
  try { userId = await resolveRequestUserId(new Request("https://demo.local/me/communities", { headers: requestHeaders })); } catch { redirect("/"); }
  if (!userId) redirect(accountSignInPath("/me/communities"));
  const managed = await (await createRuntimeCommunityMutationService()).listManagedCommunities(userId).catch(() => []);

  return <main className="member-center-shell">
    <header className="brand-header member-page-header"><BrandHomeLink /><PrimaryNavigation active="communities" /><Link className="brand-header-action" href="/communities/submit">提交新社群</Link></header>
    <div className="member-center-content"><section className="status-card"><p className="section-kicker">负责人工作台</p><h1>我的社群</h1><p>资料与动态提交后仍需运营审核，公开页面不会立即变化。</p></section>
      {managed.length ? managed.map((community) => <article key={community.id} className="community-submission-group"><header><h2>{community.name}</h2><Link href={`/communities/${community.slug}`}>查看公开页面</Link></header><CommunitySubmissionForm mode="profile-update" community={community} /><CommunitySubmissionForm mode="update" community={community} /></article>) : <section className="status-card"><h2>暂时没有已管理社群</h2><p>如果你是现有社群负责人，可以提交认领申请。</p></section>}
      <CommunitySubmissionForm mode="claim" />
    </div>
  </main>;
}
