import { headers } from "next/headers";
import { CommunityDirectory } from "../../components/communities/CommunityDirectory";
import { BrandHomeLink } from "../../components/navigation/BrandHomeLink";
import { PrimaryNavigation } from "../../components/navigation/PrimaryNavigation";
import { createRuntimeCommunityDirectoryService } from "../../features/communities/service";
import { resolveRequestUserId } from "../../features/identity/request-user";

type CommunitySearchValue = string | string[] | undefined;
type CommunitySearchParams = Promise<{ category?: CommunitySearchValue; q?: CommunitySearchValue; city?: CommunitySearchValue; locationMode?: CommunitySearchValue; focus?: CommunitySearchValue }>;

function queryFromSearchParams(searchParams: { category?: CommunitySearchValue; q?: CommunitySearchValue; city?: CommunitySearchValue; locationMode?: CommunitySearchValue; focus?: CommunitySearchValue }) {
  const value = (name: keyof typeof searchParams) => {
    const raw = searchParams[name];
    return (Array.isArray(raw) ? raw[0] : raw)?.trim().slice(0, 100) || undefined;
  };
  const locationMode = value("locationMode");
  const category = value("category");
  return {
    ...(category === "推荐" || category === "广东" || category === "全国" || category === "高校" || category === "开发者" || category === "创业落地" || category === "线下活动" ? { category } : {}),
    ...(value("q") ? { q: value("q") } : {}),
    ...(value("city") ? { city: value("city") } : {}),
    ...(locationMode === "city" || locationMode === "hybrid" || locationMode === "online" ? { locationMode } : {}),
    ...(value("focus") ? { focus: value("focus") } : {}),
  };
}

export default async function CommunitiesPage({ searchParams }: { searchParams: CommunitySearchParams }) {
  const [resolvedSearchParams, requestHeaders, service] = await Promise.all([searchParams, headers(), createRuntimeCommunityDirectoryService().catch(() => null)]);
  const query = queryFromSearchParams(resolvedSearchParams);
  let viewerId: string | undefined;
  try { viewerId = (await resolveRequestUserId(new Request("https://demo.local/communities", { headers: requestHeaders }))) ?? undefined; } catch { viewerId = undefined; }
  const result = service ? await service.list(query, viewerId).catch(() => ({ items: [], citySummaries: [] })) : { items: [], citySummaries: [] };

  return <main className="community-shell"><header className="brand-header community-header"><BrandHomeLink /><PrimaryNavigation active="communities" /><a className="brand-header-action" href="/me">我的</a></header><CommunityDirectory communities={result.items} query={query} /></main>;
}
