"use client";

import { useState } from "react";

type Member = { id: string; nickname: string; school?: string; status: string; verifiedBuilder: boolean };
const actions = [{ id: "hide", label: "隐藏资料" }, { id: "restore", label: "恢复成员" }, { id: "suspend_connections", label: "暂停连接" }, { id: "suspend_account", label: "暂停账号" }] as const;

export function MemberStatusPanel({ members }: { members: Member[] }) {
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  async function update(memberId: string, action: (typeof actions)[number]["id"]) {
    setPending(true); setMessage("");
    try {
      const response = await fetch(`/api/admin/members/${encodeURIComponent(memberId)}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action }) });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error ?? "成员状态更新失败");
      setMessage("成员状态已更新并写入审计记录。");
    } catch (error) { setMessage(error instanceof Error ? error.message : "成员状态更新失败"); }
    finally { setPending(false); }
  }
  return <div className="admin-list-card member-admin-list">{members.map((member) => <article key={member.id}><div className="admin-avatar-fallback">{member.nickname.slice(0, 1)}</div><div><strong>{member.nickname}</strong><span>{member.school ?? "尚无公开资料"} · {member.status}</span><small>{member.verifiedBuilder ? "已认证共建者" : "普通成员"}</small></div><div className="member-actions">{actions.map((action) => <button type="button" key={action.id} disabled={pending} onClick={() => update(member.id, action.id)}>{action.label}</button>)}</div></article>)}{message ? <p role="status" className="admin-action-message">{message}</p> : null}</div>;
}
