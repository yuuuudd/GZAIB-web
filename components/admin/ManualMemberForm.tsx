"use client";

import { useState } from "react";

type School = { id: string; name: string; campus: string; city: string; coordinateStatus: string };
function split(value: FormDataEntryValue | null): string[] { return typeof value === "string" && value.trim() ? value.split(/[,，\n]/).map((item) => item.trim()).filter(Boolean) : []; }

export function ManualMemberForm({ schools }: { schools: School[] }) {
  const [message, setMessage] = useState(""); const [pending, setPending] = useState(false);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setPending(true); setMessage(""); const form = new FormData(event.currentTarget);
    const body = { nickname: form.get("nickname"), realName: form.get("realName") || undefined, schoolId: form.get("schoolId"), intro: form.get("intro"), skills: split(form.get("skills")), interests: split(form.get("interests")), roles: split(form.get("roles")), workLinks: split(form.get("workLinks")), major: form.get("major") || undefined, grade: form.get("grade") || undefined, currentFocus: form.get("currentFocus") || undefined, canOffer: form.get("canOffer") || undefined, wantsToMeet: form.get("wantsToMeet") || undefined, publication: form.get("publication") };
    try { const response = await fetch("/api/admin/members/manual", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }); const result = await response.json() as { slug?: string; error?: string }; if (!response.ok) throw new Error(result.error ?? "保存失败"); setMessage(`已保存。成员资料地址：/members/${result.slug}`); event.currentTarget.reset(); } catch (error) { setMessage(error instanceof Error ? error.message : "保存失败"); } finally { setPending(false); }
  }
  return <form className="manual-member-form" onSubmit={submit}>
    <header><p className="admin-kicker">MANUAL ENTRY</p><h1>手动录入成员</h1><p>此资料不创建登录账户，也不收集邮箱、联系方式或实时位置。默认保存为未公开草稿。</p></header>
    <section className="manual-member-grid">
      <label>展示昵称<input name="nickname" required minLength={2} maxLength={30} /></label><label>真实姓名（可选，不公开）<input name="realName" maxLength={60} /></label>
      <label>学校 / 校区<select name="schoolId" required defaultValue=""><option value="" disabled>请选择学校</option>{schools.map((school) => <option key={school.id} value={school.id}>{school.name} · {school.campus}（{school.coordinateStatus === "confirmed" ? "坐标已确认" : "坐标待确认"}）</option>)}</select></label><label>专业（可选）<input name="major" maxLength={100} /></label><label>年级（可选）<input name="grade" maxLength={40} /></label>
      <label>一句话介绍<textarea name="intro" required minLength={10} maxLength={160} /></label><label>技能（用逗号分隔）<input name="skills" required placeholder="AI应用" /></label><label>兴趣（用逗号分隔）<input name="interests" required placeholder="校园共建" /></label><label>参与角色（用逗号分隔）<input name="roles" required placeholder="活动共建者" /></label><label>作品链接（可选，仅 HTTPS）<input name="workLinks" placeholder="https://..." /></label>
      <label>当前关注（可选）<textarea name="currentFocus" /></label><label>可以提供（可选）<textarea name="canOffer" /></label><label>希望认识（可选）<textarea name="wantsToMeet" /></label>
    </section>
    <fieldset className="manual-publication"><legend>保存方式</legend><label><input type="radio" name="publication" value="draft" defaultChecked /> 保存为草稿（不上地图）</label><label><input type="radio" name="publication" value="publish" /> 确认发布到地图（仅坐标已确认的学校可用）</label></fieldset>
    <button className="action-primary" type="submit" disabled={pending}>{pending ? "正在保存…" : "保存成员资料"}</button>{message ? <p className="admin-action-message" role="status">{message}</p> : null}
  </form>;
}
