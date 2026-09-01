"use client";

import { useState } from "react";

type MemberStatus = "active" | "hidden" | "connection_suspended" | "suspended" | "deleted";
type Member = {
  id: string; email: string; nickname: string; realName?: string; school?: string; campus?: string; city?: string;
  major?: string; grade?: string; intro?: string; skills: string[]; interests: string[]; roles: string[]; workLinks: string[];
  currentFocus?: string; canOffer?: string; wantsToMeet?: string; slug?: string; status: MemberStatus; publishStatus?: string;
  verifiedBuilder: boolean; adminManaged: boolean; createdAt: string;
};
type Action = "hide" | "restore" | "suspend_connections" | "suspend_account" | "delete";
type Feedback = { tone: "success" | "error"; text: string };

const actions: { id: Action; label: string }[] = [
  { id: "hide", label: "隐藏资料" }, { id: "restore", label: "恢复成员" },
  { id: "suspend_connections", label: "暂停连接" }, { id: "suspend_account", label: "暂停账号" },
  { id: "delete", label: "删除成员" },
];
const statusLabels: Record<MemberStatus, string> = {
  active: "正常", hidden: "已隐藏", connection_suspended: "已暂停连接", suspended: "已暂停账号", deleted: "已删除",
};

function successMessage(action: Action, nickname: string) {
  return ({
    hide: `已隐藏${nickname}的资料。`, restore: `已恢复${nickname}。`,
    suspend_connections: `已暂停${nickname}发起连接。`, suspend_account: `已暂停${nickname}的账号。`,
    delete: `已删除${nickname}，资料已下架。`,
  })[action];
}

function Detail({ label, value }: { label: string; value?: string }) {
  return value ? <div><dt>{label}</dt><dd>{value}</dd></div> : null;
}

export function MemberStatusPanel({ members }: { members: Member[] }) {
  const [rows, setRows] = useState(members);
  const [pending, setPending] = useState<{ memberId: string; action: Action } | null>(null);
  const [feedback, setFeedback] = useState<Record<string, Feedback>>({});

  async function update(member: Member, action: Action) {
    if (action === "delete" && !window.confirm(`确认删除成员“${member.nickname}”？资料会立即下架，且不能恢复。`)) return;
    setPending({ memberId: member.id, action });
    setFeedback((current) => ({ ...current, [member.id]: { tone: "success", text: "正在处理…" } }));
    try {
      const response = await fetch(`/api/admin/members/${encodeURIComponent(member.id)}`, {
        method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action }),
      });
      const data = await response.json() as { error?: string; status?: MemberStatus };
      if (!response.ok || !data.status) throw new Error(data.error ?? "成员状态更新失败");
      const nextStatus = data.status;
      setRows((current) => current.map((row) => row.id === member.id ? { ...row, status: nextStatus } : row));
      setFeedback((current) => ({ ...current, [member.id]: { tone: "success", text: successMessage(action, member.nickname) } }));
    } catch (error) {
      setFeedback((current) => ({ ...current, [member.id]: { tone: "error", text: error instanceof Error ? error.message : "成员状态更新失败" } }));
    } finally {
      setPending(null);
    }
  }

  return <div className="admin-list-card member-admin-list">{rows.map((member) => {
    const currentFeedback = feedback[member.id];
    return <article key={member.id} data-member-id={member.id}>
      <div className="admin-avatar-fallback">{member.nickname.slice(0, 1)}</div>
      <div className="member-summary">
        <strong>{member.nickname}{member.realName ? `（${member.realName}）` : ""}</strong>
        <span>{member.school ?? "尚无学校资料"}{member.campus ? ` · ${member.campus}` : ""} · {statusLabels[member.status]}</span>
        <small>{member.adminManaged ? "无登录账号" : member.email} · {member.verifiedBuilder ? "已认证共建者" : member.adminManaged ? "管理员录入" : "普通成员"}</small>
        <details className="member-details">
          <summary>查看完整资料</summary>
          <dl>
            <Detail label="成员 ID" value={member.id} /><Detail label="公开地址" value={member.slug ? `/members/${member.slug}` : undefined} />
            <Detail label="城市" value={member.city} /><Detail label="专业" value={member.major} /><Detail label="年级" value={member.grade} />
            <Detail label="简介" value={member.intro} /><Detail label="技能" value={member.skills.join("、")} />
            <Detail label="兴趣" value={member.interests.join("、")} /><Detail label="参与角色" value={member.roles.join("、")} />
            <Detail label="当前关注" value={member.currentFocus} /><Detail label="可以提供" value={member.canOffer} />
            <Detail label="希望认识" value={member.wantsToMeet} /><Detail label="作品链接" value={member.workLinks.join("、")} />
            <Detail label="发布状态" value={member.publishStatus} /><Detail label="加入日期" value={member.createdAt} />
          </dl>
        </details>
        {currentFeedback ? <p role={currentFeedback.tone === "error" ? "alert" : "status"} data-tone={currentFeedback.tone} className="admin-action-message">{currentFeedback.text}</p> : null}
      </div>
      <div className="member-actions">{actions.map((action) => {
        const isCurrent = pending?.memberId === member.id && pending.action === action.id;
        return <button type="button" className={action.id === "delete" ? "action-danger" : undefined} key={action.id}
          disabled={Boolean(pending) || member.status === "deleted"} onClick={() => void update(member, action.id)}>
          {isCurrent ? "处理中…" : action.label}
        </button>;
      })}</div>
    </article>;
  })}</div>;
}
