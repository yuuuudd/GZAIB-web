"use client";

import { useState } from "react";

type Contribution = { id: string; profileId: string; member: string; school: string; activityKey: string; title: string; activityDate: number; role: string; outcome: string; publicSummary: string; visibility: "public" | "members" | "private"; status: "pending" | "confirmed" | "rejected" };

export function ContributionReviewPanel({ contributions }: { contributions: Contribution[] }) {
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  async function confirm(item: Contribution) {
    setPending(true); setMessage("");
    try {
      const input = { id: item.id, status: "confirmed" as const };
      const response = await fetch("/api/admin/contributions", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(input) });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error ?? "确认失败");
      setMessage("贡献已确认，认证共建者状态已重新计算。");
    } catch (error) { setMessage(error instanceof Error ? error.message : "确认失败"); }
    finally { setPending(false); }
  }
  return <div className="admin-list-card contribution-list">{contributions.length ? contributions.map((item) => <article key={item.id}><div><strong>{item.title}</strong><span>{item.member} · {item.school} · {new Date(item.activityDate).toLocaleDateString("zh-CN")}</span><p>{item.publicSummary}</p><small>活动键：{item.activityKey} · 可见性：{item.visibility}</small></div><span className={`status-pill ${item.status === "confirmed" ? "status-ok" : "status-pending"}`}>{item.status === "confirmed" ? "已确认" : item.status === "pending" ? "待确认" : "已拒绝"}</span>{item.status === "pending" ? <button type="button" className="action-primary" disabled={pending} onClick={() => confirm(item)}>确认贡献</button> : null}</article>) : <div className="admin-empty">暂无贡献记录</div>}{message ? <p role="status" className="admin-action-message">{message}</p> : null}</div>;
}
