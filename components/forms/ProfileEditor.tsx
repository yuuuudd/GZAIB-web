"use client";

import { ChangeEvent, FormEvent, useState } from "react";
import { MAP_REQUIRED_VISIBILITY_FIELDS, OPTIONAL_VISIBILITY_FIELDS, ROLE_OPTIONS, SKILL_OPTIONS } from "../../features/applications/validation";
import type { ContactCard } from "../../features/connections/contact-card";
import type { ProjectedProfile, Visibility, VisibilityRules } from "../../features/directory/types";
import { ContactCardEditor } from "../connections/ContactCardEditor";
import { VisibilityField } from "./VisibilityField";

type SchoolOption = { id: string; name: string; campus: string; city: string };
type PrivacyField = (typeof OPTIONAL_VISIBILITY_FIELDS)[number];
type SettingsTab = "profile" | "contact" | "privacy" | "account";

const ACCOUNT_DELETION_CONFIRMATION = "删除我的账号";
const TABS: { id: SettingsTab; label: string }[] = [
  { id: "profile", label: "个人资料" },
  { id: "contact", label: "联系方式与链接" },
  { id: "privacy", label: "展示与隐私" },
  { id: "account", label: "账号设置" },
];
const labels: Record<PrivacyField, string> = {
  currentFocus: "我正在做什么", canOffer: "我能提供什么", wantsToMeet: "我希望认识谁",
  workLinks: "作品链接", major: "专业", grade: "年级",
};
const requiredLabels: Record<(typeof MAP_REQUIRED_VISIBILITY_FIELDS)[number], string> = {
  nickname: "昵称", avatarUrl: "头像", school: "学校", city: "城市", intro: "一句话介绍", skills: "技能方向",
  roles: "参与角色", verifiedBuilder: "共建者认证", contributions: "已确认贡献",
};

export function simplifyVisibility(visibility: VisibilityRules): VisibilityRules {
  return Object.fromEntries(Object.entries(visibility).map(([field, value]) => [field, value === "public" ? "public" : "private"])) as VisibilityRules;
}

export function ProfileEditor({
  profile, visibility: initialVisibility, schools, currentSchoolId, published, contactCard,
}: {
  profile: ProjectedProfile;
  visibility: VisibilityRules;
  schools: SchoolOption[];
  currentSchoolId: string;
  published: boolean;
  contactCard?: ContactCard;
}) {
  const [activeTab, setActiveTab] = useState<SettingsTab>("profile");
  const [visibility, setVisibility] = useState(() => simplifyVisibility(initialVisibility));
  const [mapPublished, setMapPublished] = useState(published);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const [avatarKey, setAvatarKey] = useState("");
  const [avatarUrl, setAvatarUrl] = useState(profile.avatarUrl ?? "");
  const [avatarFailed, setAvatarFailed] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [avatarMessage, setAvatarMessage] = useState("");
  const [contactDraft, setContactDraft] = useState<ContactCard>(contactCard ?? {});
  const [savedContact, setSavedContact] = useState<ContactCard>(contactCard ?? {});

  async function uploadAvatar(event: ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget;
    const file = input.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { setAvatarMessage("头像文件须小于或等于 5 MB。"); input.value = ""; return; }
    const form = new FormData(); form.set("avatar", file);
    setUploadingAvatar(true); setAvatarMessage("");
    try {
      const response = await fetch("/api/uploads/avatar", { method: "POST", body: form });
      const result = await response.json() as { error?: string; objectKey?: string; publicUrl?: string };
      if (!response.ok || !result.objectKey || !result.publicUrl) throw new Error(result.error ?? "头像上传失败");
      setAvatarKey(result.objectKey); setAvatarUrl(result.publicUrl); setAvatarFailed(false); setAvatarMessage("头像已上传，保存资料后生效。");
    } catch (error) { setAvatarMessage(error instanceof Error ? error.message : "头像上传失败"); input.value = ""; }
    finally { setUploadingAvatar(false); }
  }

  async function request(path: string, method: "PATCH" | "DELETE", payload: unknown, success: string): Promise<boolean> {
    setBusy(true); setMessage(null);
    try {
      const response = await fetch(path, { method, headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
      const data = response.status === 204 ? {} : await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error ?? "操作失败，请稍后重试。");
      if (method === "DELETE") window.location.assign("/");
      else setMessage(success);
      return true;
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "操作失败，请稍后重试。");
      return false;
    } finally { setBusy(false); }
  }

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const optional = (name: string) => String(form.get(name) ?? "").trim() || null;
    await request("/api/me/profile", "PATCH", {
      nickname: String(form.get("nickname") ?? "").trim(), schoolId: String(form.get("schoolId") ?? ""),
      major: optional("major"), grade: optional("grade"), intro: String(form.get("intro") ?? "").trim(),
      currentFocus: optional("currentFocus"), canOffer: optional("canOffer"), wantsToMeet: optional("wantsToMeet"),
      skills: form.getAll("skills"), roles: form.getAll("roles"), ...(avatarKey ? { avatarKey } : {}),
    }, "个人资料已保存。");
  }

  async function saveContactAndLinks(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const fields = ["wechat", "email", "otherLabel", "otherValue"] as const;
    const changed = fields.some((field) => (contactDraft[field] ?? "").trim() !== (savedContact[field] ?? "").trim());
    setBusy(true); setMessage(null);
    try {
      if (changed) {
        const optional = (field: typeof fields[number]) => contactDraft[field]?.trim() || undefined;
        const payload = { ...(optional("wechat") ? { wechat: optional("wechat") } : {}), ...(optional("email") ? { email: optional("email") } : {}), ...(optional("otherLabel") ? { otherLabel: optional("otherLabel") } : {}), ...(optional("otherValue") ? { otherValue: optional("otherValue") } : {}) };
        const response = await fetch("/api/me/contact-card", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
        const result = await response.json() as { error?: string };
        if (!response.ok) throw new Error(result.error ?? "暂时无法保存联系方式，请稍后重试。");
        setSavedContact(contactDraft);
      }
      const response = await fetch("/api/me/profile", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ workLinks: String(form.get("workLinks") ?? "").split(/\n/).map((item) => item.trim()).filter(Boolean) }) });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error ?? "操作失败，请稍后重试。");
      setMessage("联系方式与链接已保存。");
    } catch (error) { setMessage(error instanceof Error ? error.message : "操作失败，请稍后重试。"); }
    finally { setBusy(false); }
  }

  async function savePrivacy(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await request("/api/me/profile", "PATCH", { visibility }, "展示与隐私设置已保存。");
  }

  async function toggleMap(next: boolean) {
    if (await request("/api/me/profile", "PATCH", { mapVisibility: next ? "shown" : "hidden" }, next ? "资料已重新显示在共建地图中。" : "资料已从共建地图隐藏。")) setMapPublished(next);
  }

  return <div className="profile-settings">
    <section className="member-summary">
      <div className="member-summary-main">
        <div className="member-hub-avatar" role="img" aria-label={`${profile.nickname ?? "共建者"}的头像`}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {avatarUrl && !avatarFailed ? <img src={avatarUrl} alt="" onError={() => setAvatarFailed(true)} /> : <span aria-hidden="true">{Array.from(profile.nickname ?? "光")[0]}</span>}
        </div>
        <div className="member-summary-copy"><h1>{profile.nickname}</h1><p>{[profile.school, profile.city].filter(Boolean).join(" · ")}</p><span className={mapPublished ? "map-status is-visible" : "map-status"}>● {mapPublished ? "已在共建地图展示" : "未在共建地图展示"}</span>
          <label className="avatar-upload-action">{uploadingAvatar ? "正在处理…" : "添加 / 更换头像"}<input type="file" accept="image/jpeg,image/png,image/webp" disabled={uploadingAvatar} onChange={uploadAvatar} /></label>
          {avatarMessage ? <small role="status">{avatarMessage}</small> : null}
        </div>
      </div>
      <a className="profile-preview-link" href={`/members/${profile.slug}`}>预览公开主页 →</a>
    </section>

    <div className="profile-tabs" role="tablist" aria-label="个人设置分类">
      {TABS.map((tab) => <button key={tab.id} type="button" role="tab" aria-selected={activeTab === tab.id} aria-controls={`settings-${tab.id}`} onClick={() => { setActiveTab(tab.id); setMessage(null); }}>{tab.label}</button>)}
    </div>

    <section id="settings-profile" className="settings-panel" role="tabpanel" hidden={activeTab !== "profile"}>
      <form onSubmit={saveProfile}>
        <div className="settings-section"><h2>基本信息</h2><div className="profile-form-grid">
          <label>昵称<input name="nickname" required minLength={2} maxLength={30} defaultValue={profile.nickname} /></label>
          <label>学校 / 校区<select name="schoolId" defaultValue={currentSchoolId}>{schools.map((school) => <option value={school.id} key={school.id}>{school.name} · {school.campus}</option>)}</select><small>更换学校会提交复审，原资料继续展示。</small></label>
          <label>专业<input name="major" maxLength={100} defaultValue={profile.major} /></label>
          <label>年级<input name="grade" maxLength={40} defaultValue={profile.grade} /></label>
          <label className="profile-field-half">所在城市<input value={profile.city ?? ""} readOnly /></label>
          <label className="profile-field-wide">一句话介绍<textarea className="profile-intro-input" name="intro" required minLength={10} maxLength={160} defaultValue={profile.intro} /></label>
        </div></div>
        <div className="settings-section"><h2>关于我</h2><div className="profile-about-fields">
          <label>我正在做什么<textarea name="currentFocus" maxLength={500} defaultValue={profile.currentFocus} /></label>
          <label>我能提供什么<textarea name="canOffer" maxLength={500} defaultValue={profile.canOffer} /></label>
          <label>我希望认识谁<textarea name="wantsToMeet" maxLength={500} defaultValue={profile.wantsToMeet} /></label>
        </div></div>
        <div className="settings-section"><fieldset><legend>技能方向</legend><div className="choice-list">{SKILL_OPTIONS.map((skill) => <label key={skill}><input name="skills" type="checkbox" value={skill} defaultChecked={profile.skills?.includes(skill)} />{skill}</label>)}</div></fieldset></div>
        <div className="settings-section"><fieldset><legend>参与角色</legend><div className="choice-list">{ROLE_OPTIONS.map((role) => <label key={role}><input name="roles" type="checkbox" value={role} defaultChecked={profile.roles?.includes(role)} />{role}</label>)}</div></fieldset></div>
        <div className="settings-actions"><button type="button" onClick={() => window.location.reload()}>取消</button><button type="submit" disabled={busy || uploadingAvatar}>{busy ? "正在保存…" : "保存更改"}</button></div>
      </form>
    </section>

    <section id="settings-contact" className="settings-panel" role="tabpanel" hidden={activeTab !== "contact"}>
      <form onSubmit={saveContactAndLinks}><div className="settings-section contact-settings-section"><h2>联系方式</h2><p className="settings-hint">联系方式仅在双方接受连接后交换，不会公开显示；至少填写一种。</p><ContactCardEditor initialCard={contactCard} value={contactDraft} onChange={setContactDraft} onClear={() => setSavedContact({})} embedded /></div>
      <div className="settings-section"><h2>外部链接</h2><label>作品与个人主页<textarea className="profile-links-input" name="workLinks" placeholder={"https://github.com/…\nhttps://your-site.com"} defaultValue={profile.workLinks?.join("\n")} /><small>每行一个 HTTPS 链接，最多 5 条。</small></label></div><div className="settings-section profile-related-links community-management-row"><div><h2>我的社群</h2><p>查看或更新你负责的社群资料。</p></div><a href="/me/communities">管理我的社群 →</a></div><div className="settings-actions"><button type="button" onClick={() => window.location.reload()}>取消</button><button type="submit" disabled={busy}>{busy ? "正在保存…" : "保存更改"}</button></div></form>
    </section>

    <section id="settings-privacy" className="settings-panel" role="tabpanel" hidden={activeTab !== "privacy"}>
      <form onSubmit={savePrivacy}>
        <div className="settings-section privacy-intro"><div><h2>地图公开资料</h2><p>打开的内容会出现在共建地图和公开主页；关闭后仅本人和必要管理员可见。</p></div><span>公开 / 私密</span></div>
        <div className="settings-section privacy-group"><h3>公开身份</h3><p>{mapPublished ? "地图展示期间，这些资料会保持公开。" : "地图已隐藏，你可以单独调整这些资料。"}</p>{MAP_REQUIRED_VISIBILITY_FIELDS.slice(0, 5).map((field) => <VisibilityField key={field} label={requiredLabels[field]} value={visibility[field] ?? "public"} disabled={mapPublished} onChange={(value: Visibility) => setVisibility((current) => ({ ...current, [field]: value }))} />)}</div>
        <div className="settings-section privacy-group"><h3>能力与经历</h3>{MAP_REQUIRED_VISIBILITY_FIELDS.slice(5).map((field) => <VisibilityField key={field} label={requiredLabels[field]} value={visibility[field] ?? "public"} disabled={mapPublished} onChange={(value: Visibility) => setVisibility((current) => ({ ...current, [field]: value }))} />)}</div>
        <div className="settings-section privacy-group"><h3>个人动态</h3>{OPTIONAL_VISIBILITY_FIELDS.map((field) => <VisibilityField key={field} label={labels[field]} value={visibility[field] ?? "private"} onChange={(value: Visibility) => setVisibility((current) => ({ ...current, [field]: value }))} />)}</div>
        <div className="settings-actions"><button type="button" onClick={() => window.location.reload()}>取消</button><button type="submit" disabled={busy}>{busy ? "正在保存…" : "保存更改"}</button></div>
      </form>
    </section>

    <section id="settings-account" className="settings-panel" role="tabpanel" hidden={activeTab !== "account"}>
      <div className="settings-section account-setting-row"><div><h2>地图展示</h2><h3>在共建地图中展示我的资料</h3><p>关闭后，你的资料将不再出现在共建地图搜索和浏览结果中。</p></div><label className="account-map-toggle"><input type="checkbox" role="switch" checked={mapPublished} disabled={busy} onChange={(event) => void toggleMap(event.currentTarget.checked)} /><span>{mapPublished ? "ON" : "OFF"}</span></label></div>
      <div className="settings-section"><h2>账号与数据</h2><details className="delete-account"><summary>注销账号</summary><p>删除后会立即下架公开资料、撤回待审申请并撤销所有会话。此操作不可撤销。</p><label>输入“{ACCOUNT_DELETION_CONFIRMATION}”确认<input value={confirmation} onChange={(event) => setConfirmation(event.currentTarget.value)} /></label><button type="button" disabled={busy || confirmation !== ACCOUNT_DELETION_CONFIRMATION} onClick={() => void request("/api/me/account", "DELETE", { confirmation }, "")}>{ACCOUNT_DELETION_CONFIRMATION}</button></details></div>
      <div className="settings-section profile-related-links settings-list"><h2>其他管理</h2><div><a href="/me/connections">我的连接</a><a href="/me/blocked">已屏蔽成员</a></div></div>
    </section>

    {message ? <p className="profile-editor-message" role="status">{message}</p> : null}
  </div>;
}
