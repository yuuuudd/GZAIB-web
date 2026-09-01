import { headers } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CommunityProfile } from "../../../components/communities/CommunityProfile";
import { BrandHomeLink } from "../../../components/navigation/BrandHomeLink";
import { PrimaryNavigation } from "../../../components/navigation/PrimaryNavigation";
import { createRuntimeCommunityDirectoryService } from "../../../features/communities/service";
import { resolveRequestUserId } from "../../../features/identity/request-user";

export default async function CommunityPage({ params }: { params: Promise<{ slug: string }> }) {
  const [resolvedParams, requestHeaders, service] = await Promise.all([params, headers(), createRuntimeCommunityDirectoryService()]);
  let viewerId: string | undefined;
  try { viewerId = (await resolveRequestUserId(new Request(`https://demo.local/communities/${resolvedParams.slug}`, { headers: requestHeaders }))) ?? undefined; } catch { viewerId = undefined; }
  const community = await service.getBySlug(resolvedParams.slug, viewerId);
  if (!community) notFound();

  return <main className="community-shell"><header className="brand-header community-header"><BrandHomeLink /><PrimaryNavigation active="communities" /><Link className="brand-header-action" href="/apply">申请加入</Link></header><div className="community-page-content"><nav className="community-breadcrumb" aria-label="面包屑"><Link href="/communities">AI 社群</Link><span aria-hidden="true">/</span><strong>{community.name}</strong></nav><CommunityProfile community={community} isLoggedIn={Boolean(viewerId)} /></div></main>;
}
