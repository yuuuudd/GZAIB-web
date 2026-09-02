import Link from "next/link";
import type { CommunityDirectoryQuery, PublicCommunity } from "../../features/communities/types";

type CommunityDirectoryProps = { communities: PublicCommunity[]; query: CommunityDirectoryQuery };
const categories = ["推荐", "广东", "全国", "高校", "开发者", "创业落地", "线下活动"] as const;

function locationLabel(community: PublicCommunity) {
  if (community.locationMode === "online") return "线上 · 全国";
  return `${community.primaryCity ?? "城市"} · ${community.locationMode === "hybrid" ? "混合" : "本地"}`;
}

function formatDate(timestamp: number) {
  return new Intl.DateTimeFormat("zh-CN", { year: "numeric", month: "long", day: "numeric", timeZone: "Asia/Shanghai" }).format(timestamp);
}

function formatActivityDate(timestamp: number) {
  return new Intl.DateTimeFormat("zh-CN", { month: "long", day: "numeric", weekday: "short", timeZone: "Asia/Shanghai" }).format(timestamp);
}

function communityStatus(community: PublicCommunity) {
  if (community.claimed) return { label: "已认证社群", className: "community-verified" };
  if (community.sourceLabel.includes("平台")) return { label: "平台收录", className: "community-listed" };
  return { label: "待认领", className: "community-unclaimed" };
}

function categoryHref(category: (typeof categories)[number], query: CommunityDirectoryQuery) {
  const params = new URLSearchParams();
  if (category !== "推荐") params.set("category", category);
  for (const key of ["q", "city", "locationMode", "focus"] as const) if (query[key]) params.set(key, query[key]!);
  const search = params.toString();
  return `/communities${search ? `?${search}` : ""}`;
}

export function CommunityDirectory({ communities, query }: CommunityDirectoryProps) {
  const activeFilters = [query.q, query.city, query.locationMode, query.focus].filter(Boolean);
  const cityCount = new Set(communities.map((community) => community.primaryCity).filter(Boolean)).size;
  const activityCount = communities.reduce((total, community) => total + community.updates.length, 0);

  return <section className="community-directory" aria-labelledby="community-directory-title">
    <div className="community-directory-heading"><p className="community-kicker">AI 社群</p><h1 id="community-directory-title">发现正在行动的 AI 社群</h1><p>从城市、线上与关注方向开始，找到值得靠近的共建网络。</p></div>
    <div className="community-discovery-bar"><nav className="community-categories" aria-label="社群分类">{categories.map((category) => <Link className={(!query.category && category === "推荐") || query.category === category ? "is-active" : ""} href={categoryHref(category, query)} key={category}>{category}</Link>)}</nav><div className="community-directory-actions"><Link href="/communities/submit">↗ 推荐一个社群</Link><a href="#community-list">⌾ 认领社群</a></div></div>
    <details className="community-filter-disclosure" open={activeFilters.length > 0}><summary><span className="community-filter-summary"><b>☷ 更多筛选</b><small>{activeFilters.length ? activeFilters.join(" / ") : "搜索 / 城市 / 活动方式 / 关注方向"}</small></span><span className="community-filter-count">{activeFilters.length || 4} 项</span></summary><form className="community-filters" method="get" aria-label="筛选 AI 社群">{query.category && <input name="category" type="hidden" value={query.category} />}<label><span>搜索</span><input name="q" defaultValue={query.q} placeholder="搜索社群或方向" /></label><label><span>城市</span><input name="city" defaultValue={query.city} placeholder="如：广州" /></label><label><span>活动方式</span><select name="locationMode" defaultValue={query.locationMode ?? ""}><option value="">全部方式</option><option value="city">城市线下</option><option value="hybrid">混合活动</option><option value="online">纯线上</option></select></label><label><span>关注方向</span><input name="focus" defaultValue={query.focus} placeholder="如：AI 应用" /></label><button type="submit">应用筛选</button></form></details>
    <aside className="community-overview" aria-label="社群目录概览"><div><strong>{communities.length}</strong><span>已收录社群</span></div><div><strong>{cityCount}</strong><span>覆盖城市</span></div><div><strong>{activityCount}</strong><span>近期活动</span></div><p>广东优先收录 · 全国拓展补充 · 支持社群认领与推荐</p></aside>
    {communities.length ? <div className="community-grid" id="community-list" aria-live="polite">{communities.map((community) => {
      const update = community.updates[0]; const status = communityStatus(community);
      return <article className="community-card" key={community.id}><div className="community-card-heading"><p>● {locationLabel(community)}</p><span className={status.className}>{status.label}</span></div><div className="community-card-intro"><span className="community-mark" aria-hidden="true">{community.name.slice(0, 2)}</span><div><h2><Link href={`/communities/${encodeURIComponent(community.slug)}`}>{community.name}</Link></h2><p>{community.summary}</p></div></div><div className={`community-activity${update ? "" : " is-empty"}`}><span>▣ 近期活动</span>{update ? <Link href={`/communities/${encodeURIComponent(community.slug)}`}>{formatActivityDate(update.occurredAt)}　{update.title} <b>→</b></Link> : <em>暂无近期公开活动</em>}</div><ul aria-label="关注方向">{community.focusTags.slice(0, 4).map((tag) => <li key={tag}>{tag}</li>)}</ul><footer><time dateTime={new Date(community.updatedAt).toISOString()}>最近更新：{formatDate(community.updatedAt)}</time><Link href={`/communities/${encodeURIComponent(community.slug)}`}>查看社群　→</Link></footer></article>;
    })}</div> : <div className="community-empty" role="status"><strong>暂时没有匹配的社群</strong><p>试试清空筛选条件，或换一个城市和方向。</p></div>}
  </section>;
}
