import type { ProjectedProfile } from "../../features/directory/types";
import { ConnectButton, type ConnectionCtaState } from "../connections/ConnectButton";
import { BlockButton } from "../safety/BlockButton";
import { ReportDialog } from "../safety/ReportDialog";

function initial(value?: string): string {
  return Array.from(value?.trim() ?? "")[0] ?? "共";
}

function textSection(icon: string, title: string, value?: string) {
  if (!value) return null;
  return <section className="member-detail-row"><span className="member-detail-icon" aria-hidden="true">{icon}</span><h2>{title}</h2><p>{value}</p></section>;
}

export function MemberProfile({ profile, connection = { state: "visitor", dailyRemaining: 0 } }: { profile: ProjectedProfile; connection?: { state: ConnectionCtaState; dailyRemaining: number } }) {
  return <div className="member-profile-layout">
    <div className="member-profile-main">
      <section className="member-profile-hero">
        <div className="member-profile-avatar" role="img" aria-label={`${profile.nickname ?? "共建者"}的头像`}>
          {/* Dynamic owner-uploaded avatar URLs are already normalized and immutable at the API boundary. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {profile.avatarUrl ? <img src={profile.avatarUrl} alt="" width="132" height="132" /> : <span aria-hidden="true">{initial(profile.nickname)}</span>}
          {profile.verifiedBuilder ? <i aria-hidden="true">✓</i> : null}
        </div>
        <div className="member-profile-identity">
          <div className="member-profile-title"><h1>{profile.nickname ?? "共建者"}</h1>{profile.verifiedBuilder ? <span className="profile-verified"><b aria-hidden="true">♢</b> 认证共建者</span> : null}</div>
          <p className="member-profile-school">{[profile.school, profile.city].filter(Boolean).join(" · ")}</p>
          <div className="member-profile-tags">{profile.skills?.map((skill) => <span key={`skill-${skill}`}>{skill}</span>)}{profile.roles?.map((role) => <span className="orange" key={`role-${role}`}>{role}</span>)}</div>
          {profile.intro ? <p className="member-profile-intro">{profile.intro}</p> : null}
        </div>
      </section>
      <div className="member-profile-details">
        {textSection("↯", "我正在做什么", profile.currentFocus)}
        {textSection("▣", "我能提供什么", profile.canOffer)}
        {textSection("●", "我希望认识", profile.wantsToMeet)}
        {profile.contributions?.length ? <section className="member-detail-row member-contributions"><span className="member-detail-icon" aria-hidden="true">▤</span><h2>共建记录</h2><ol>{profile.contributions.map((item) => <li key={item.id}><div><strong>{item.title}</strong><span>{item.role}</span></div><p>{item.publicSummary}</p><time dateTime={new Date(item.activityDate).toISOString()}>{new Date(item.activityDate).toLocaleDateString("zh-CN", { year: "numeric", month: "2-digit" })}</time></li>)}</ol></section> : null}
        {profile.workLinks?.length ? <section className="member-detail-row member-works"><span className="member-detail-icon" aria-hidden="true">↗</span><h2>公开作品</h2><div>{profile.workLinks.map((link) => <a href={link} key={link} target="_blank" rel="noreferrer">查看作品 <span aria-hidden="true">↗</span></a>)}</div></section> : null}
      </div>
    </div>
    <aside className="member-connect-card" aria-labelledby="connect-heading">
      <p className="section-kicker">连接 / 下一阶段</p>
      <h2 id="connect-heading">想认识 {profile.nickname ?? "TA"}？</h2>
      <p>先介绍你是谁，以及为什么想连接。</p>
      <ConnectButton state={connection.state} recipientSlug={profile.slug} recipientName={profile.nickname ?? "TA"} dailyRemaining={connection.dailyRemaining} />
      {connection.state !== "visitor" && connection.state !== "own" ? <details className="member-safety-menu"><summary>更多安全操作</summary><BlockButton memberSlug={profile.slug} name={profile.nickname ?? "该成员"} /><ReportDialog targetMemberSlug={profile.slug} /></details> : null}
      <p id="connect-explanation" className="member-connect-note"><span aria-hidden="true">◇</span> 仅审核通过的成员可以发起连接；请求由对方自行决定是否接受。</p>
      <p className="member-contact-lock"><span aria-hidden="true">▣</span> 联系方式仅在双方同意后交换</p>
    </aside>
  </div>;
}
