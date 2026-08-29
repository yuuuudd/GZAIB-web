"use client";
import { useState } from "react";
const actions = [["dismiss", "驳回"], ["warn", "警告"], ["suspend_connections", "暂停连接"], ["hide_profile", "隐藏资料"], ["suspend_account", "暂停账号"]] as const;
export function ReportReviewPanel({ reportId, category, description, status, resolution }: { reportId: string; category: string; description: string; status: string; resolution?: string }) {
  const [current, setCurrent] = useState(status); const [notice, setNotice] = useState(resolution ? `已处理：${resolution}` : "");
  async function resolve(resolutionValue: (typeof actions)[number][0]) { const response = await fetch(`/api/admin/reports/${encodeURIComponent(reportId)}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ resolution: resolutionValue }) }); if (!response.ok) { setNotice("该举报已被处理或操作无效。"); return; } setCurrent("resolved"); setNotice("处理已记录到运营审计。"); }
  return <article className="admin-report"><p>类别：{category}</p><p>说明：{description}</p><p>状态：{current}</p>{current === "open" ? <div aria-label="处理操作">{actions.map(([value, label]) => <button key={value} type="button" onClick={() => void resolve(value)}>{label}</button>)}</div> : null}{notice ? <p role="status">{notice}</p> : null}</article>;
}
