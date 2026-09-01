import type { PublicCommunity } from "../../features/communities/types";
import { CommunityActions } from "./CommunityActions";

type CommunityProfileProps = {
  community: PublicCommunity;
  isLoggedIn: boolean;
};

function officialDomain(officialUrl: string) {
  return new URL(officialUrl).hostname.replace(/^www\./, "");
}

function formatDate(timestamp: number) {
  return new Intl.DateTimeFormat("zh-CN", { month: "long", day: "numeric", timeZone: "Asia/Shanghai" }).format(timestamp);
}

export function CommunityProfile({ community, isLoggedIn }: CommunityProfileProps) {
  const location = community.locationMode === "online" ? "纯线上" : community.primaryCity ?? "城市社群";
  return <article className="community-profile">
    <header className="community-profile-header"><p className="community-kicker">AI 社群 · {location}</p><div><h1>{community.name}</h1><span className={community.claimed ? "community-claimed" : "community-unclaimed"}>{community.claimed ? "已认领" : "待认领"}</span></div></header>
    <section className="community-profile-intro" aria-label="社群简介"><p>{community.summary}</p><ul>{community.focusTags.map((tag) => <li key={tag}>{tag}</li>)}</ul></section>
    <section aria-label="社群操作：关注社群、官方入口与联系负责人"><CommunityActions communityId={community.id} officialUrl={community.officialUrl} officialDomain={officialDomain(community.officialUrl)} contactSlug={community.contactSlug} isLoggedIn={isLoggedIn} initiallyFollowed={community.followed ?? false} followEnabled={isLoggedIn} /></section>
    <section className="community-updates" aria-labelledby="community-updates-title"><div><p className="community-kicker">公开动态</p><h2 id="community-updates-title">最近动态</h2></div>{community.updates.length ? <ol>{community.updates.slice(0, 3).map((update) => <li key={update.id}><time dateTime={new Date(update.occurredAt).toISOString()}>{formatDate(update.occurredAt)}</time><div><h3>{update.title}</h3><p>{update.summary}</p>{update.sourceUrl ? <a href={update.sourceUrl} target="_blank" rel="noopener noreferrer external">查看来源</a> : null}</div></li>)}</ol> : <p className="community-updates-empty" role="status">暂时还没有公开动态。</p>}</section>
    <aside className="community-coming-soon"><strong>活动与赛事即将接入</strong><p>这里将汇集社群正在发起的公开行动机会。</p></aside>
  </article>;
}
