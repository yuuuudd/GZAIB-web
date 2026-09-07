"use client";

import { useCallback, useEffect, useState } from "react";
import { ConnectionCard, type ConnectionView } from "./ConnectionCard";

type Box = "new" | "accepted";
type InboxItem = ConnectionView & { direction?: "received" | "sent" };
const labels: Record<Box, string> = { new: "新的朋友", accepted: "好友列表" };

export function ConnectionInbox({ initialBox = "new" }: { initialBox?: Box }) {
  const [box, setBox] = useState<Box>(initialBox);
  const [items, setItems] = useState<InboxItem[]>([]);
  const [nextCursor, setNextCursor] = useState<string | undefined>();
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string>();
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<InboxItem>();
  const load = useCallback(async (target: Box, cursor?: string) => {
    setLoading(true); setError("");
    try {
      if (target === "new") {
        // ponytail: newest 30 per direction is enough for launch; add dual-cursor pagination when real usage reaches this ceiling.
        const responses = await Promise.all(["received", "sent"].map((direction) => fetch(`/api/connections?box=${direction}`, { cache: "no-store" })));
        const pages = await Promise.all(responses.map((response) => response.json() as Promise<{ items?: ConnectionView[]; error?: string }>));
        const failed = responses.findIndex((response) => !response.ok);
        if (failed >= 0) throw new Error(pages[failed]?.error ?? "加载失败");
        setItems(pages.flatMap((page, index) => (page.items ?? []).map((item) => ({ ...item, direction: index === 0 ? "received" as const : "sent" as const }))).sort((left, right) => right.request.createdAt - left.request.createdAt));
        setNextCursor(undefined);
      } else {
        const response = await fetch(`/api/connections?box=accepted${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`, { cache: "no-store" });
        const data = await response.json() as { items?: ConnectionView[]; nextCursor?: string; error?: string };
        if (!response.ok) throw new Error(data.error ?? "加载失败");
        setItems((current) => cursor ? [...current, ...(data.items ?? [])] : (data.items ?? [])); setNextCursor(data.nextCursor);
      }
    } catch (cause) { setError(cause instanceof Error ? cause.message : "加载失败"); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void Promise.resolve().then(() => load(box)); }, [box, load]);
  async function resolve(item: ConnectionView, action: "accept" | "decline" | "withdraw") {
    setBusyId(item.request.id); setError("");
    try {
      const response = await fetch(`/api/connections/${encodeURIComponent(item.request.id)}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ action }) });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error ?? "操作失败");
      setSelected(undefined);
      await load(box);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "操作失败"); }
    finally { setBusyId(undefined); }
  }
  return <section className="connection-inbox" aria-labelledby="connection-inbox-title"><header><div><p className="section-kicker">一起认识，一起共创</p><h1 id="connection-inbox-title">我的连接</h1><p>在这里遇见伙伴，让一个想法有新的开始。</p></div><a className="connection-explore" href="/map">去发现共创伙伴 <span aria-hidden="true">↗</span></a></header><p className="connection-privacy-note"><span aria-hidden="true">◇</span> 联系方式仅在双方同意后交换</p><div className="connection-tabs" role="tablist" aria-label="连接请求分类">{(Object.keys(labels) as Box[]).map((value) => <button key={value} role="tab" aria-selected={box === value} type="button" onClick={() => setBox(value)}>{labels[value]}</button>)}</div>{error ? <p className="connection-error" role="alert">{error}</p> : null}{loading ? <p className="connection-empty" role="status">正在加载连接请求…</p> : items.length === 0 ? <div className="connection-empty"><span className="connection-empty-mark" aria-hidden="true">↗</span><h2>{box === "new" ? "下一位共创伙伴，等你认识" : "让连接从一次交流开始"}</h2><p>{box === "new" ? "收到和发出的连接申请，都会出现在这里。" : "双方接受连接后，就能在这里找到彼此。"}</p><a href="/map">去共建地图看看 <span aria-hidden="true">→</span></a></div> : <div className="connection-list">{items.map((item) => <ConnectionCard key={item.request.id} item={item} box={box === "new" ? item.direction ?? "received" : "accepted"} busy={busyId === item.request.id} onView={() => setSelected(item)} onAction={(action) => void resolve(item, action)} />)}</div>}{nextCursor && !loading ? <button className="connection-more" type="button" onClick={() => void load(box, nextCursor)}>加载更多</button> : null}{selected?.counterpart ? <IncomingRequestDialog item={selected} busy={busyId === selected.request.id} onClose={() => setSelected(undefined)} onAction={(action) => void resolve(selected, action)} /> : null}</section>;
}

function IncomingRequestDialog({ item, busy, onClose, onAction }: { item: InboxItem; busy: boolean; onClose(): void; onAction(action: "accept" | "decline"): void }) {
  const member = item.counterpart!;
  return <div className="connection-dialog-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><dialog open className="connection-dialog connection-profile-dialog" aria-modal="true" aria-labelledby="incoming-member-name" onKeyDown={(event) => { if (event.key === "Escape") onClose(); }}><button className="connection-dialog-close" type="button" onClick={onClose} aria-label="关闭资料卡">×</button><div className="connection-profile-heading"><div className="connection-friend-avatar">{member.avatarUrl ? <img src={member.avatarUrl} alt="" /> : Array.from(member.nickname)[0]}</div><div><h2 id="incoming-member-name">{member.nickname}</h2><p>{member.school} · {member.city}</p></div></div><p>{member.intro}</p>{member.skills.length ? <div className="map-member-tags">{member.skills.map((skill) => <span key={skill}>{skill}</span>)}</div> : null}<div className="connection-request-copy"><strong>对方的申请留言</strong><p>{item.request.message}</p></div><div className="connection-card-actions"><button type="button" disabled={busy} onClick={() => onAction("decline")}>婉拒</button><button type="button" disabled={busy} onClick={() => onAction("accept")}>接受</button></div></dialog></div>;
}
