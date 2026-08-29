"use client";

import { useCallback, useEffect, useState } from "react";
import { ConnectionCard, type ConnectionView } from "./ConnectionCard";

type Box = "received" | "sent" | "accepted";
const labels: Record<Box, string> = { received: "收到的", sent: "发出的", accepted: "已连接" };

export function ConnectionInbox({ initialBox = "received" }: { initialBox?: Box }) {
  const [box, setBox] = useState<Box>(initialBox);
  const [items, setItems] = useState<ConnectionView[]>([]);
  const [nextCursor, setNextCursor] = useState<string | undefined>();
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string>();
  const [error, setError] = useState("");
  const load = useCallback(async (target: Box, cursor?: string) => {
    setLoading(true); setError("");
    try {
      const response = await fetch(`/api/connections?box=${target}${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`, { cache: "no-store" });
      const data = await response.json() as { items?: ConnectionView[]; nextCursor?: string; error?: string };
      if (!response.ok) throw new Error(data.error ?? "加载失败");
      setItems((current) => cursor ? [...current, ...(data.items ?? [])] : (data.items ?? [])); setNextCursor(data.nextCursor);
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
      await load(box);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "操作失败"); }
    finally { setBusyId(undefined); }
  }
  return <section className="connection-inbox" aria-labelledby="connection-inbox-title"><header><div><p className="section-kicker">成员连接</p><h1 id="connection-inbox-title">我的连接</h1><p>只有双方接受后，才会读取彼此当前设置的联系方式。</p></div></header><div className="connection-tabs" role="tablist" aria-label="连接请求分类">{(Object.keys(labels) as Box[]).map((value) => <button key={value} role="tab" aria-selected={box === value} type="button" onClick={() => setBox(value)}>{labels[value]}</button>)}</div>{error ? <p className="connection-error" role="alert">{error}</p> : null}{loading ? <p className="connection-empty" role="status">正在加载连接请求…</p> : items.length === 0 ? <p className="connection-empty">这里还没有连接请求。</p> : <div className="connection-list">{items.map((item) => <ConnectionCard key={item.request.id} item={item} box={box} busy={busyId === item.request.id} onAction={(action) => void resolve(item, action)} />)}</div>}{nextCursor && !loading ? <button className="connection-more" type="button" onClick={() => void load(box, nextCursor)}>加载更多</button> : null}</section>;
}
