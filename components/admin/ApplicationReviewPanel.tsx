"use client";

import { useMemo, useState } from "react";

export type ReviewApplicationItem = {
  id: string; nickname: string; realName?: string; school: string; campus: string; city: string;
  intro: string; major?: string; grade?: string; skills: string[]; roles: string[];
  visibility: Record<string, string>; submittedAt?: number; coordinateStatus: string;
};

export function ApplicationReviewPanel({ applications }: { applications: ReviewApplicationItem[] }) {
  const [selectedId, setSelectedId] = useState(applications[0]?.id ?? "");
  const [reason, setReason] = useState("");
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  const selected = useMemo(() => applications.find((item) => item.id === selectedId), [applications, selectedId]);

  async function review(decision: "approved" | "changes_requested" | "rejected") {
    if (!selected) return;
    setPending(true);
    setMessage("");
    try {
      const response = await fetch(`/api/admin/applications/${encodeURIComponent(selected.id)}`, {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify(decision === "approved" ? { decision } : { decision, reason }),
      });
      const data = await response.json() as { error?: string; profile?: { publishStatus?: string } };
      if (!response.ok) throw new Error(data.error ?? "审核失败");
      setMessage(decision === "approved"
        ? data.profile?.publishStatus === "published" ? "已通过并点亮地图。" : "已通过；因公开字段不完整，资料保持隐藏。"
        : decision === "changes_requested" ? "已退回修改。" : "已拒绝申请。");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "审核失败");
    } finally { setPending(false); }
  }

  if (!selected) return <div className="admin-empty"><strong>暂时没有待审核申请</strong><p>初始化演示数据后会出现一条虚构待审核记录。</p></div>;
  const publicFields = Object.entries(selected.visibility).filter(([, visibility]) => visibility === "public").map(([field]) => field);
  return (
    <div className="review-layout">
      <aside className="review-queue"><h2>待审核队列</h2>{applications.map((item) => <button type="button" className={item.id === selectedId ? "selected" : ""} onClick={() => { setSelectedId(item.id); setMessage(""); }} key={item.id}><strong>{item.nickname}</strong><span>{item.school}</span></button>)}</aside>
      <article className="review-card">
        <header><div className="admin-avatar-fallback">{selected.nickname.slice(0, 1)}</div><div><p className="admin-kicker">申请 #{selected.id}</p><h2>{selected.nickname}</h2><p>{selected.school} · {selected.city}</p></div><span className="status-pill status-pending">待审核</span></header>
        <div className="review-sections">
          <section><h3>基本资料</h3><dl><dt>真实姓名（仅运营可见）</dt><dd>{selected.realName ?? "未提交"}</dd><dt>学校 / 校区</dt><dd>{selected.school} / {selected.campus}</dd><dt>专业 / 年级</dt><dd>{selected.major ?? "未填写"} / {selected.grade ?? "未填写"}</dd></dl></section>
          <section><h3>共建方向</h3><div className="admin-tags">{selected.skills.concat(selected.roles).map((tag) => <span key={tag}>{tag}</span>)}</div><h3>一句话介绍</h3><p>{selected.intro}</p></section>
          <section><h3>公开范围</h3><p>{publicFields.join("、")}</p><p className={selected.coordinateStatus === "confirmed" ? "coordinate-ok" : "coordinate-warning"}>学校坐标：{selected.coordinateStatus === "confirmed" ? "已确认" : "待确认，当前不可通过"}</p></section>
        </div>
        <footer className="review-actions"><label>退回或拒绝时请说明原因<textarea value={reason} onChange={(event) => setReason(event.target.value)} minLength={10} maxLength={500} placeholder="10–500 字，反馈会展示给申请者" /></label><div><button type="button" className="action-secondary action-orange" onClick={() => review("changes_requested")} disabled={pending || reason.trim().length < 10}>退回修改</button><button type="button" className="action-secondary" onClick={() => review("rejected")} disabled={pending || reason.trim().length < 10}>拒绝申请</button><button type="button" className="action-primary" onClick={() => review("approved")} disabled={pending || selected.coordinateStatus !== "confirmed"}>通过并点亮</button></div>{message ? <p role="status" className="admin-action-message">{message}</p> : null}</footer>
      </article>
    </div>
  );
}
