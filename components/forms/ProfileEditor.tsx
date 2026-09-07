"use client";

import { ChangeEvent, FormEvent, useEffect, useState } from "react";
import { MAP_REQUIRED_VISIBILITY_FIELDS, OPTIONAL_VISIBILITY_FIELDS, ROLE_OPTIONS, SKILL_OPTIONS } from "../../features/applications/validation";
import type { ContactCard } from "../../features/connections/contact-card";
import type { ProjectedProfile, Visibility, VisibilityRules } from "../../features/directory/types";
import { ContactCardEditor } from "../connections/ContactCardEditor";
import { ConnectionInbox } from "../connections/ConnectionInbox";
import { MemberProfile } from "../directory/MemberProfile";
import { VisibilityField } from "./VisibilityField";
import { createNicknameAvatar, DEFAULT_AVATARS, nicknameInitial } from "./default-avatars";

type SchoolOption = { id: string; name: string; campus: string; city: string };
type PrivacyField = (typeof OPTIONAL_VISIBILITY_FIELDS)[number];
type SettingsTab = "profile" | "contact" | "privacy" | "account";
type QuickPanel = "connections" | "preview";

const ACCOUNT_DELETION_CONFIRMATION = "删除我的账号";
const TABS: { id: SettingsTab; label: string }[] = [
  { id: "profile", label: "个人资料" },
  { id: "contact", label: "联系方式与链接" },
  { id: "privacy", label: "资料展示" },
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
const PUBLIC_CARD_FIELDS = ["nickname", "avatarUrl", "school", "city", "intro", "skills", "roles"] as const;

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
  const [selectedDefaultAvatar, setSelectedDefaultAvatar] = useState<string | null>(null);
  const [contactDraft, setContactDraft] = useState<ContactCard>(contactCard ?? {});
  const [savedContact, setSavedContact] = useState<ContactCard>(contactCard ?? {});
  const [quickPanel, setQuickPanel] = useState<QuickPanel>();

  useEffect(() => {
    if (!quickPanel) return;
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === "Escape") setQuickPanel(undefined); };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [quickPanel]);

  async function uploadAvatar(event: ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget;
    const file = input.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { setAvatarMessage("头像文件须小于或等于 5 MB。"); input.value = ""; return; }
    setSelectedDefaultAvatar(null);
    await saveAvatar(file, "头像已上传，保存资料后生效。");
    input.value = "";
  }

  async function saveAvatar(file: Blob, success: string) {
    const form = new FormData(); form.set("avatar", file);
    setUploadingAvatar(true); setAvatarMessage("");
    try {
      const response = await fetch("/api/uploads/avatar", { method: "POST", body: form });
      const result = await response.json() as { error?: string; objectKey?: string; publicUrl?: string };
      if (!response.ok || !result.objectKey || !result.publicUrl) throw new Error(result.error ?? "头像上传失败");
      setAvatarKey(result.objectKey); setAvatarUrl(result.publicUrl); setAvatarFailed(false); setAvatarMessage(success);
    } catch (error) { setAvatarMessage(error instanceof Error ? error.message : "头像上传失败"); }
    finally { setUploadingAvatar(false); }
  }

  async function selectDefaultAvatar(avatar: (typeof DEFAULT_AVATARS)[number]) {
    setSelectedDefaultAvatar(avatar.id);
    try {
      const response = await fetch(avatar.src);
      if (!response.ok) throw new Error("默认头像暂时不可用，请选择上传头像。");
      await saveAvatar(await response.blob(), `已选用${avatar.label}默认头像，保存资料后生效。`);
    } catch (error) { setSelectedDefaultAvatar(null); setAvatarMessage(error instanceof Error ? error.message : "默认头像暂时不可用，请选择上传头像。"); }
  }

  async function selectNicknameAvatar() {
    setSelectedDefaultAvatar("initial");
    try { await saveAvatar(await createNicknameAvatar(profile.nickname ?? ""), "已选用昵称首字默认头像，保存资料后生效。"); }
    catch (error) { setSelectedDefaultAvatar(null); setAvatarMessage(error instanceof Error ? error.message : "昵称头像暂时不可用，请选择其他头像。"); }
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

  function setOptionalVisibility(value: Visibility) {
    setVisibility((current) => ({ ...current, ...Object.fromEntries(OPTIONAL_VISIBILITY_FIELDS.map((field) => [field, value])) }));
  }

  return <div className="profile-settings">
    <section className="member-summary">
      <div className="member-summary-main">
        <div className="member-hub-avatar" role="img" aria-label={`${profile.nickname ?? "共建者"}的头像`}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {avatarUrl && !avatarFailed ? <img src={avatarUrl} alt="" onError={() => setAvatarFailed(true)} /> : <span aria-hidden="true">{Array.from(profile.nickname ?? "光")[0]}</span>}
        </div>
        <div className="member-summary-copy"><p className="section-kicker">我的共创空间</p><h1>{profile.nickname}</h1><p>{[profile.school, profile.city].filter(Boolean).join(" · ")}</p><span className={mapPublished ? "map-status is-visible" : "map-status"}>● {mapPublished ? "已在共建地图展示" : "未在共建地图展示"}</span>

        </div>
      </div>
      <div className="profile-quick-actions" aria-label="资料快捷入口"><button type="button" onClick={() => setQuickPanel("connections")}>连接中心</button><button type="button" onClick={() => setQuickPanel("preview")}>预览公开主页</button></div>
    </section>

    <div className="profile-tabs" role="tablist" aria-label="个人设置分类">
      {TABS.map((tab) => <button key={tab.id} type="button" role="tab" aria-selected={activeTab === tab.id} aria-controls={`settings-${tab.id}`} onClick={() => { setActiveTab(tab.id); setMessage(null); }}>{tab.label}</button>)}
    </div>

    <section id="settings-profile" className="settings-panel" role="tabpanel" hidden={activeTab !== "profile"}>
      <form onSubmit={saveProfile}>
        <div className="settings-section profile-avatar-section"><div><h2>个人头像</h2><p className="settings-hint">让共创伙伴一眼认出你。</p></div><div className="profile-avatar-controls"><label className="avatar-upload-action">{uploadingAvatar ? "正在处理…" : "添加 / 更换头像"}<input type="file" accept="image/jpeg,image/png,image/webp" disabled={uploadingAvatar} onChange={uploadAvatar} /></label>
          {avatarMessage ? <small role="status">{avatarMessage}</small> : null}
          <div className="default-avatar-list profile-default-avatar-list" aria-label="选择默认头像"><button className="default-avatar-initial" type="button" aria-label="使用昵称首字头像" aria-pressed={selectedDefaultAvatar === "initial"} disabled={uploadingAvatar} onClick={() => void selectNicknameAvatar()}>{nicknameInitial(profile.nickname ?? "")}</button>{DEFAULT_AVATARS.map((avatar) => <button key={avatar.id} type="button" aria-label={`使用${avatar.label}头像`} aria-pressed={selectedDefaultAvatar === avatar.id} disabled={uploadingAvatar} onClick={() => void selectDefaultAvatar(avatar)}><img src={avatar.src} alt="" /></button>)}</div></div></div>
        <div className="settings-section"><h2>基本信息</h2><div className="profile-form-grid">
          <label>昵称<input name="nickname" required minLength={2} maxLength={30} defaultValue={profile.nickname} /></label>
          <label>学校 / 校区<select name="schoolId" defaultValue={currentSchoolId}>{schools.map((school) => <option value={school.id} key={school.id}>{school.name} · {school.campus}</option>)}</select><small>更换学校会提交复审，原资料继续展示。</small></label>
          <label>专业<input name="major" maxLength={100} placeholder="你的专业或研究方向" defaultValue={profile.major} /></label>
          <label>年级<input name="grade" maxLength={40} placeholder="例如：2024 级" defaultValue={profile.grade} /></label>
          <label className="profile-field-half">所在城市<input value={profile.city ?? ""} readOnly /></label>
          <label className="profile-field-wide">一句话介绍<textarea className="profile-intro-input" name="intro" required minLength={10} maxLength={160} defaultValue={profile.intro} /></label>
        </div></div>
        <div className="settings-section"><h2>关于我</h2><div className="profile-about-fields">
          <label>我正在做什么<textarea name="currentFocus" placeholder="最近在探索的方向，或正在推进的项目…" maxLength={500} defaultValue={profile.currentFocus} /></label>
          <label>我能提供什么<textarea name="canOffer" placeholder="分享你擅长的技能、经验或资源…" maxLength={500} defaultValue={profile.canOffer} /></label>
          <label>我希望认识谁<textarea name="wantsToMeet" placeholder="你期待和什么样的伙伴一起共创？" maxLength={500} defaultValue={profile.wantsToMeet} /></label>
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
        <div className="settings-section privacy-intro"><div><h2>社群公开名片</h2><p>以下资料会持续展示在共建地图和公开主页。</p></div></div>
        <div className="settings-section public-card-fields">{PUBLIC_CARD_FIELDS.map((field) => <span key={field}>{requiredLabels[field]}</span>)}</div>
        <div className="settings-section privacy-group"><div className="privacy-group-heading"><h3>更多个人信息</h3><div><button type="button" onClick={() => setOptionalVisibility("public")}>全部公开</button><button type="button" onClick={() => setOptionalVisibility("private")}>全部私密</button></div></div><p>默认公开；你可以按需关闭单项展示。</p>{OPTIONAL_VISIBILITY_FIELDS.map((field) => <VisibilityField key={field} label={labels[field]} value={visibility[field] ?? "public"} onChange={(value: Visibility) => setVisibility((current) => ({ ...current, [field]: value }))} />)}</div>
        <div className="settings-actions"><button type="button" onClick={() => window.location.reload()}>取消</button><button type="submit" disabled={busy}>{busy ? "正在保存…" : "保存更改"}</button></div>
      </form>
    </section>

    <section id="settings-account" className="settings-panel" role="tabpanel" hidden={activeTab !== "account"}>
      <div className="settings-section account-setting-row"><div><h2>地图展示</h2><h3>在共建地图中展示我的资料</h3><p>关闭后，你的资料将不再出现在共建地图搜索和浏览结果中。</p></div><label className="account-map-toggle"><input type="checkbox" role="switch" checked={mapPublished} disabled={busy} onChange={(event) => void toggleMap(event.currentTarget.checked)} /><span>{mapPublished ? "ON" : "OFF"}</span></label></div>
      <div className="settings-section"><h2>账号与数据</h2><details className="delete-account"><summary>注销账号</summary><p>删除后会立即下架公开资料、撤回待审申请并撤销所有会话。此操作不可撤销。</p><label>输入“{ACCOUNT_DELETION_CONFIRMATION}”确认<input value={confirmation} onChange={(event) => setConfirmation(event.currentTarget.value)} /></label><button type="button" disabled={busy || confirmation !== ACCOUNT_DELETION_CONFIRMATION} onClick={() => void request("/api/me/account", "DELETE", { confirmation }, "")}>{ACCOUNT_DELETION_CONFIRMATION}</button></details></div>
      <div className="settings-section profile-related-links settings-list"><h2>其他管理</h2><div><a href="/me/blocked">已屏蔽成员</a></div></div>
    </section>

    {quickPanel ? <div className="profile-quick-overlay" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setQuickPanel(undefined); }}><section className="profile-quick-panel" role="dialog" aria-modal="true" aria-labelledby="profile-quick-panel-title"><header><div><p className="section-kicker">我的资料</p><h2 id="profile-quick-panel-title">{quickPanel === "connections" ? "连接中心" : "预览公开主页"}</h2></div><button type="button" aria-label="关闭" onClick={() => setQuickPanel(undefined)}>×</button></header><div className="profile-quick-tabs" role="tablist" aria-label="资料快捷面板"><button type="button" role="tab" aria-selected={quickPanel === "connections"} onClick={() => setQuickPanel("connections")}>连接中心</button><button type="button" role="tab" aria-selected={quickPanel === "preview"} onClick={() => setQuickPanel("preview")}>公开主页</button></div><div className="profile-quick-panel-content">{quickPanel === "connections" ? <ConnectionInbox /> : <MemberProfile profile={profile} connection={{ state: "own", dailyRemaining: 0 }} />}</div></section></div> : null}
    {message ? <p className="profile-editor-message" role="status">{message}</p> : null}
  </div>;
}
