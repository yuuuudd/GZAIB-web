"use client";

import { FormEvent, useState } from "react";
import { MAP_REQUIRED_VISIBILITY_FIELDS, OPTIONAL_VISIBILITY_FIELDS, ROLE_OPTIONS, SKILL_OPTIONS } from "../../features/applications/validation";
import type { ProjectedProfile, Visibility, VisibilityRules } from "../../features/directory/types";
import { VisibilityField } from "./VisibilityField";

type SchoolOption = { id: string; name: string; campus: string; city: string };
type PrivacyField = (typeof OPTIONAL_VISIBILITY_FIELDS)[number];
const ACCOUNT_DELETION_CONFIRMATION = "删除我的账号";
const labels: Record<PrivacyField, string> = {
  currentFocus: "我正在做什么", canOffer: "我能提供什么", wantsToMeet: "我希望认识谁",
  workLinks: "作品链接", major: "专业", grade: "年级",
};
const requiredLabels: Record<(typeof MAP_REQUIRED_VISIBILITY_FIELDS)[number], string> = {
  nickname: "昵称", avatarUrl: "头像", school: "学校", city: "城市", intro: "一句话介绍", skills: "技能",
  roles: "参与角色", verifiedBuilder: "共建者认证", contributions: "已确认贡献",
};

export function ProfileEditor({
  profile, visibility: initialVisibility, schools, currentSchoolId, published,
}: {
  profile: ProjectedProfile;
  visibility: VisibilityRules;
  schools: SchoolOption[];
  currentSchoolId: string;
  published: boolean;
}) {
  const [visibility, setVisibility] = useState(() => ({ ...initialVisibility }));
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmation, setConfirmation] = useState("");

  async function request(path: string, method: "PATCH" | "DELETE", payload: unknown) {
    setBusy(true); setMessage(null);
    try {
      const response = await fetch(path, { method, headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
      const data = response.status === 204 ? {} : await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error ?? "操作失败，请稍后重试。");
      if (method === "DELETE") window.location.assign("/");
      else { setMessage("资料已更新，新的公开设置已立即生效。"); window.location.reload(); }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "操作失败，请稍后重试。");
    } finally { setBusy(false); }
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const optional = (name: string) => String(form.get(name) ?? "").trim() || null;
    await request("/api/me/profile", "PATCH", {
      nickname: String(form.get("nickname") ?? "").trim(), schoolId: String(form.get("schoolId") ?? ""),
      major: optional("major"), grade: optional("grade"), intro: String(form.get("intro") ?? "").trim(),
      currentFocus: optional("currentFocus"), canOffer: optional("canOffer"), wantsToMeet: optional("wantsToMeet"),
      skills: form.getAll("skills"), roles: form.getAll("roles"),
      workLinks: String(form.get("workLinks") ?? "").split(/\n/).map((item) => item.trim()).filter(Boolean),
      visibility,
    });
  }

  return <div className="profile-editor-stack">
    <form className="profile-editor" onSubmit={save}>
      <header><div><p className="section-kicker">成员中心</p><h1>管理我的公开资料</h1></div><a href={`/members/${profile.slug}`}>查看公开页 ↗</a></header>
      <section><h2>基本资料</h2><div className="profile-form-grid"><label>昵称<input name="nickname" required minLength={2} maxLength={30} defaultValue={profile.nickname} /></label><label>学校 / 校区<select name="schoolId" defaultValue={currentSchoolId}>{schools.map((school) => <option value={school.id} key={school.id}>{school.name} · {school.campus} · {school.city}</option>)}</select><small>更换学校会提交复审；复审期间旧学校资料继续展示。</small></label><label>专业<input name="major" maxLength={100} defaultValue={profile.major} /></label><label>年级<input name="grade" maxLength={40} defaultValue={profile.grade} /></label></div><label>一句话介绍<textarea name="intro" required minLength={10} maxLength={160} defaultValue={profile.intro} /></label></section>
      <section><h2>方向与能力</h2><div className="profile-form-grid"><label>我正在做什么<textarea name="currentFocus" maxLength={500} defaultValue={profile.currentFocus} /></label><label>我能提供什么<textarea name="canOffer" maxLength={500} defaultValue={profile.canOffer} /></label><label>我希望认识谁<textarea name="wantsToMeet" maxLength={500} defaultValue={profile.wantsToMeet} /></label></div><fieldset><legend>技能方向</legend><div className="choice-list">{SKILL_OPTIONS.map((skill) => <label key={skill}><input name="skills" type="checkbox" value={skill} defaultChecked={profile.skills?.includes(skill)} />{skill}</label>)}</div></fieldset><fieldset><legend>参与角色</legend><div className="choice-list">{ROLE_OPTIONS.map((role) => <label key={role}><input name="roles" type="checkbox" value={role} defaultChecked={profile.roles?.includes(role)} />{role}</label>)}</div></fieldset><label>作品链接（每行一个 HTTPS 链接）<textarea name="workLinks" defaultValue={profile.workLinks?.join("\n")} /></label></section>
      <section className="profile-privacy"><h2>公开范围</h2><p>地图必需资料在展示期间必须保持“所有访客可见”。如需逐项收起这些资料，请先使用“隐藏我的地图资料”。</p><div className="privacy-grid">{MAP_REQUIRED_VISIBILITY_FIELDS.map((field) => <VisibilityField key={field} label={requiredLabels[field]} value={visibility[field] ?? "public"} disabled={published} onChange={(value: Visibility) => setVisibility((current) => ({ ...current, [field]: value }))} />)}{OPTIONAL_VISIBILITY_FIELDS.map((field) => <VisibilityField key={field} label={labels[field]} value={visibility[field] ?? "private"} onChange={(value: Visibility) => setVisibility((current) => ({ ...current, [field]: value }))} />)}</div></section>
      {message ? <p className="profile-editor-message" role="status">{message}</p> : null}
      <button className="application-submit" type="submit" disabled={busy}>{busy ? "正在保存…" : "保存资料与公开设置"}</button>
    </form>
    <section className="profile-control-card"><div><p className="section-kicker">地图展示</p><h2>{published ? "资料正在地图中展示" : "资料已从地图隐藏"}</h2><p>变更会在下一次公开查询时立即生效，不会等待缓存刷新。</p></div><button type="button" disabled={busy} onClick={() => request("/api/me/profile", "PATCH", { mapVisibility: published ? "hidden" : "shown" })}>{published ? "隐藏我的地图资料" : "重新展示我的地图资料"}</button></section>
    <section className="profile-danger-card"><div><p className="section-kicker">账号与数据</p><h2>删除账号</h2><p>删除后会立即下架公开资料、撤回待审申请并撤销所有已存会话。此操作不可撤销。</p></div><label>输入“{ACCOUNT_DELETION_CONFIRMATION}”确认<input value={confirmation} onChange={(event) => setConfirmation(event.currentTarget.value)} /></label><button type="button" disabled={busy || confirmation !== ACCOUNT_DELETION_CONFIRMATION} onClick={() => request("/api/me/account", "DELETE", { confirmation })}>{ACCOUNT_DELETION_CONFIRMATION}</button></section>
  </div>;
}
