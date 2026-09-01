import Link from "next/link";
import type { PublicCommunity } from "../../features/communities/types";

type CommunityDirectoryProps = {
  communities: PublicCommunity[];
  query: { q?: string; city?: string; locationMode?: string; focus?: string };
};

function locationLabel(community: PublicCommunity) {
  if (community.locationMode === "online") return "纯线上";
  if (community.locationMode === "hybrid") return community.primaryCity ? `${community.primaryCity} · 混合` : "混合活动";
  return community.primaryCity ?? "城市社群";
}

function formatDate(timestamp: number) {
  return new Intl.DateTimeFormat("zh-CN", { year: "numeric", month: "short", day: "numeric", timeZone: "Asia/Shanghai" }).format(timestamp);
}

export function CommunityDirectory({ communities, query }: CommunityDirectoryProps) {
  return <section className="community-directory" aria-labelledby="community-directory-title">
    <div className="community-directory-heading"><p className="community-kicker">AI 社群</p><h1 id="community-directory-title">发现正在行动的 AI 社群</h1><p>从城市、线上与关注方向开始，找到值得靠近的共建网络。</p></div>
    <form className="community-filters" method="get" aria-label="筛选 AI 社群">
      <label><span>搜索</span><input name="q" defaultValue={query.q} placeholder="搜索社群或方向" /></label>
      <label><span>城市</span><input name="city" defaultValue={query.city} placeholder="如：广州" /></label>
      <label><span>活动方式</span><select name="locationMode" defaultValue={query.locationMode ?? ""}><option value="">全部方式</option><option value="city">城市线下</option><option value="hybrid">混合活动</option><option value="online">纯线上</option></select></label>
      <label><span>关注方向</span><input name="focus" defaultValue={query.focus} placeholder="如：AI 应用" /></label>
      <button type="submit">筛选社群</button>
    </form>
    {communities.length ? <div className="community-grid" aria-live="polite">{communities.map((community) => <article className="community-card" key={community.id}>
      <div className="community-card-heading"><p>{locationLabel(community)}</p><span className={community.claimed ? "community-claimed" : "community-unclaimed"}>{community.claimed ? "已认领" : "待认领"}</span></div>
      <h2><Link href={`/communities/${encodeURIComponent(community.slug)}`}>{community.name}</Link></h2>
      <p>{community.summary}</p>
      <ul aria-label="关注方向">{community.focusTags.slice(0, 3).map((tag) => <li key={tag}>{tag}</li>)}</ul>
      <time dateTime={new Date(community.updatedAt).toISOString()}>最近更新：{formatDate(community.updatedAt)}</time>
    </article>)}</div> : <div className="community-empty" role="status"><strong>暂时没有匹配的社群</strong><p>试试清空筛选条件，或换一个城市和方向。</p></div>}
  </section>;
}
