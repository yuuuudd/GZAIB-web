import { headers } from "next/headers";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { MemberProfile } from "../../../components/directory/MemberProfile";
import { createRuntimeProfileAccessService, resolveRuntimeProfileViewer } from "../../../features/directory/profile-access";

export const dynamic = "force-dynamic";

export default async function MemberProfilePage({ params }: { params: Promise<{ slug: string }> }) {
  const requestHeaders = await headers();
  const request = new Request("https://demo.local/members/profile", { headers: requestHeaders });
  const profile = await (await createRuntimeProfileAccessService()).getProfile(
    (await params).slug,
    await resolveRuntimeProfileViewer(request),
  );
  if (!profile) notFound();
  return <main className="member-page-shell">
    <header className="brand-header member-page-header"><Link className="brand-mark" href="/" aria-label="广州AI共创社首页"><Image src="/logo.png" alt="广州AI共创社" width={44} height={44} /><span>广州AI共创社</span></Link><nav className="brand-nav" aria-label="主导航"><Link className="brand-nav-active" href="/#map">共建地图</Link><Link href="/#how-it-works">如何点亮</Link><Link href="/#about">关于我们</Link></nav><Link className="brand-header-action" href="/me">我的资料</Link></header>
    <div className="member-page-content"><nav className="member-breadcrumb" aria-label="面包屑"><Link href="/">共建地图</Link><span aria-hidden="true">/</span><span>{profile.school ?? "成员"}</span><span aria-hidden="true">/</span><strong>{profile.nickname ?? "共建者"}</strong></nav><MemberProfile profile={profile} /></div>
  </main>;
}
