"use client";

import { useEffect, useState } from "react";
import type { DirectoryMemberPreview } from "../../features/directory/service";
import type { ProjectedProfile } from "../../features/directory/types";
import { ConnectButton, type ConnectionCtaState } from "../connections/ConnectButton";
import { mapConnectionCardState } from "../connections/map-card-state";

type ConnectionItem = { request: { status: string }; counterpartSlug?: string; unlockedContactCard?: { wechat?: string; email?: string; otherLabel?: string; otherValue?: string } };

function initial(value: string) { return Array.from(value)[0] ?? "共"; }

export function MapMemberProfileCard({ member, onClose }: { member: DirectoryMemberPreview; onClose(): void }) {
  const [profile, setProfile] = useState<ProjectedProfile>();
  const [connectionCta, setConnectionCta] = useState<ConnectionCtaState>("unavailable");
  const [dailyRemaining, setDailyRemaining] = useState(0);
  const [connectionStatus, setConnectionStatus] = useState<string>();
  const [contact, setContact] = useState<ConnectionItem["unlockedContactCard"]>();
  const [sent, setSent] = useState(false);
  const [showContact, setShowContact] = useState(false);
  const [connectedNotice, setConnectedNotice] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    void fetch(`/api/members/${encodeURIComponent(member.slug)}`, { signal: controller.signal })
      .then(async (response) => response.ok ? response.json() as Promise<{ profile?: ProjectedProfile; connection?: { state: ConnectionCtaState; dailyRemaining: number } }> : {})
      .then((data) => { setProfile(data.profile); setConnectionCta(data.connection?.state ?? "unavailable"); setDailyRemaining(data.connection?.dailyRemaining ?? 0); })
      .catch(() => undefined);
    return () => controller.abort();
  }, [member.slug]);

  useEffect(() => {
    let cancelled = false;
    const refresh = async () => {
      try {
        const pages = await Promise.all(["sent", "accepted"].map(async (box) => {
          const response = await fetch(`/api/connections?box=${box}`);
          return response.ok ? response.json() as Promise<{ items?: ConnectionItem[] }> : {};
        }));
        if (cancelled) return;
        const item = pages.flatMap((page) => page.items ?? []).find((entry) => entry.counterpartSlug === member.slug);
        if (item) {
          if (connectionStatus === "pending" && item.request.status === "accepted") setConnectedNotice(true);
          setConnectionStatus(item.request.status); setContact(item.unlockedContactCard);
        }
      } catch { /* Visitors keep the ready state; the existing endpoint remains authoritative on submit. */ }
    };
    void refresh();
    const timer = window.setInterval(() => void refresh(), 30000);
    return () => { cancelled = true; window.clearInterval(timer); };
  }, [member.slug, sent]);

  const shown = profile ?? member;
  const state = sent ? "waiting" : mapConnectionCardState(connectionStatus, connectionCta);
  const contactEntries = contact ? [["微信", contact.wechat], ["邮箱", contact.email], [contact.otherLabel ?? "其他联系方式", contact.otherValue]].filter((entry): entry is [string, string] => Boolean(entry[1])) : [];
  return <aside className="map-member-profile" aria-label={`${shown.nickname ?? member.nickname}的公开资料`}>
    <button className="map-member-profile-close" type="button" onClick={onClose} aria-label="关闭成员资料">×</button>
    <header className="map-member-profile-hero">
      <div className="map-member-profile-avatar">{shown.avatarUrl ? <img src={shown.avatarUrl} alt="" /> : initial(shown.nickname ?? member.nickname)}</div>
      <div><div className="map-member-profile-name"><h2>{shown.nickname ?? member.nickname}</h2><span>{shown.verifiedBuilder ? "共建者" : "社群成员"}</span></div><p>{[shown.school, shown.city].filter(Boolean).join(" · ")}</p><small>{shown.intro ?? "正在完善公开介绍。"}</small></div>
    </header>
    <div className="map-member-profile-body">
      <section><h3>技能方向</h3><div className="map-member-tags">{shown.skills?.map((skill) => <span key={skill}>{skill}</span>)}</div></section>
      {([ ["我正在做什么", shown.currentFocus], ["我能提供什么", shown.canOffer], ["我希望认识谁", shown.wantsToMeet] ] as const).map(([title, value]) => value ? <section key={title}><h3>{title}</h3><p>{value}</p></section> : null)}
      {shown.roles?.length ? <section><h3>参与角色</h3><div className="map-member-tags roles">{shown.roles.map((role) => <span key={role}>{role}</span>)}</div></section> : null}
    </div>
    <footer className="map-member-profile-actions">
      {["eligible", "visitor", "own", "unavailable"].includes(state) ? <ConnectButton state={state as ConnectionCtaState} recipientSlug={member.slug} recipientName={shown.nickname ?? member.nickname} dailyRemaining={dailyRemaining} label="发起连接" onSent={() => setSent(true)} /> : null}
      {state === "waiting" ? <button className="connection-cta" type="button" disabled>等待对方确认</button> : null}
      {state === "declined" ? <p className="map-connection-neutral">对方暂未接受此次连接</p> : null}
      {state === "connected" ? <button className="connection-cta" type="button" onClick={() => setShowContact(true)}>查看联系方式</button> : null}
      <button className="map-member-secondary" type="button" onClick={onClose}>关闭</button>
      <p>🔒 联系方式仅在双方同意后交换</p>
    </footer>
    {sent ? <section className="map-connection-status" role="status"><i>✓</i><h3>连接申请已发送</h3><p>已向 {shown.nickname ?? member.nickname} 发送申请，正在等待对方同意。</p><button type="button" onClick={() => setSent(false)}>我知道了</button></section> : null}
    {connectedNotice ? <section className="map-connection-status" role="status"><i>↗</i><h3>你们已成为互联成员！</h3><p>现在可以交换联系方式，开始交流合作。</p><button type="button" onClick={() => { setConnectedNotice(false); setShowContact(true); }}>查看联系方式</button></section> : null}
    {showContact ? <section className="map-connection-status map-contact-status" role="dialog" aria-label="联系方式"><i>↗</i><h3>你们已成为互联成员！</h3>{contactEntries.length ? <dl>{contactEntries.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl> : <p>对方暂未提供可交换的联系方式。</p>}<button type="button" onClick={() => setShowContact(false)}>我知道了</button></section> : null}
  </aside>;
}
