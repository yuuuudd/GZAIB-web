"use client";

import { ChangeEvent, FormEvent, useState } from "react";
import {
  CONSENT_VERSION,
  DEFAULT_APPLICATION_VISIBILITY,
  SKILL_OPTIONS,
} from "../../features/applications/validation";
import { AmapLoader, AmapLocationPreview, NATIONWIDE_PLACE_SEARCH_OPTIONS, parseAmapLocation, type AmapLocation, type AmapNamespace } from "../map/AmapLoader";
import { createNicknameAvatar, DEFAULT_AVATARS, nicknameInitial } from "./default-avatars";
import type { ContactCard } from "../../features/connections/contact-card";
import { normalizeProvince } from "../../features/schools/location";
import { normalizeCity } from "../../features/map/semantic-map";

export type SchoolOption = { id: string; name: string; campus: string; province: string; city: string };
const maxAvatarSourceBytes = 5 * 1024 * 1024;

function normalizedSchoolName(value: string): string {
  return value.toLocaleLowerCase("zh-CN").replace(/校区/g, "").replace(/[\s·•（）()\-—_]/g, "");
}

export function matchConfirmedSchool(candidateName: string, candidateProvince: string, candidateCity: string, schools: SchoolOption[]): SchoolOption | undefined {
  const candidate = normalizedSchoolName(candidateName);
  const localSchools = schools.filter((school) => normalizeProvince(school.province) === normalizeProvince(candidateProvince) && normalizeCity(school.city) === normalizeCity(candidateCity));
  const campusMatch = localSchools.find((school) => candidate.includes(normalizedSchoolName(school.name)) && candidate.includes(normalizedSchoolName(school.campus)));
  if (campusMatch) return campusMatch;
  const nameMatches = localSchools.filter((school) => candidate.includes(normalizedSchoolName(school.name)));
  return nameMatches.length === 1 ? nameMatches[0] : undefined;
}

function ApplicationSchoolSearch({ amap, schools, onSelect }: { amap: AmapNamespace; schools: SchoolOption[]; onSelect: (school: SchoolOption) => void }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<AmapLocation[]>([]);
  const [preview, setPreview] = useState<AmapLocation>();
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  const matchedSchool = preview ? matchConfirmedSchool(preview.name, preview.province, preview.city, schools) : undefined;

  function search() {
    const keyword = query.trim();
    if (!keyword) return;
    setMessage("正在搜索高德地图…");
    setPreview(undefined);
    new amap.PlaceSearch(NATIONWIDE_PLACE_SEARCH_OPTIONS).search(keyword, (status, value) => {
      const pois = status === "complete" && value && typeof value === "object" ? ((value as { poiList?: { pois?: unknown[] } }).poiList?.pois ?? []) : [];
      const next = pois.flatMap((poi) => parseAmapLocation(poi) ?? []).slice(0, 8);
      setResults(next);
      setMessage(next.length ? "请选择学校地点" : "未找到地点，请尝试输入学校全称或校区名称。");
    });
  }

  async function confirm() {
    if (!preview) return;
    setPending(true);
    try {
      let school = matchedSchool;
      if (!school) {
        const response = await fetch("/api/schools", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "select_amap", name: preview.name, campus: preview.name, province: preview.province, city: preview.city, longitude: preview.longitude, latitude: preview.latitude }) });
        const saved = await response.json() as SchoolOption & { error?: string };
        if (!response.ok) throw new Error(saved.error ?? "学校保存失败");
        school = saved;
      }
      onSelect(school);
      setPreview(undefined);
      setResults([]);
      setMessage(`已选择 ${school.name} · ${school.campus}`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "学校保存失败");
    } finally {
      setPending(false);
    }
  }

  return <section className="school-search application-school-search"><h3>搜索高德学校</h3><p>先查看地点和周边地图，确认后会自动选入申请表。</p><div><input value={query} onChange={(event) => setQuery(event.currentTarget.value)} placeholder="例如：华南理工大学五山校区" aria-label="搜索高德学校" /><button type="button" className="action-primary" disabled={pending} onClick={search}>搜索</button></div>{message ? <p role="status">{message}</p> : null}{preview ? <AmapLocationPreview amap={amap} location={preview} pending={pending} onBack={() => setPreview(undefined)} onConfirm={() => void confirm()} confirmLabel="确认选择这个学校" /> : <ul>{results.map((candidate) => <li key={`${candidate.name}-${candidate.longitude}`}><button type="button" disabled={pending} onClick={() => setPreview(candidate)}><strong>{candidate.name}</strong><span>{[candidate.province, candidate.city, candidate.district, candidate.address].filter(Boolean).join(" · ")}</span></button></li>)}</ul>}</section>;
}

export function ApplicationForm({ schools, initialContact = {} }: { schools: SchoolOption[]; initialContact?: ContactCard }) {
  const [message, setMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [nickname, setNickname] = useState("");
  const [avatarKey, setAvatarKey] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [avatarImageFailed, setAvatarImageFailed] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [avatarMessage, setAvatarMessage] = useState<string | null>(null);
  const [selectedDefaultAvatar, setSelectedDefaultAvatar] = useState<string | null>(null);
  const [schoolOptions, setSchoolOptions] = useState(schools);
  const [selectedSchoolId, setSelectedSchoolId] = useState("");
  const [selectedSkills, setSelectedSkills] = useState<string[]>([]);

  function selectSchool(school: SchoolOption) {
    setSchoolOptions((current) => current.some((item) => item.id === school.id) ? current : [...current, school]);
    setSelectedSchoolId(school.id);
  }

  async function saveAvatar(file: Blob, message = "头像已安全处理并保存。") {
    if (file.size > maxAvatarSourceBytes) {
      setAvatarMessage("头像文件须小于或等于 5 MB。");
      return;
    }
    const form = new FormData();
    form.set("avatar", file);
    setUploadingAvatar(true);
    setAvatarMessage(null);
    try {
      const response = await fetch("/api/uploads/avatar", { method: "POST", body: form });
      const data = await response.json() as { error?: string; objectKey?: string; publicUrl?: string };
      if (!response.ok || !data.objectKey || !data.publicUrl) throw new Error(data.error ?? "头像上传失败，请稍后重试。");
      setAvatarKey(data.objectKey);
      setAvatarUrl(data.publicUrl);
      setAvatarImageFailed(false);
      setAvatarMessage(message);
    } catch (error) {
      setAvatarMessage(error instanceof Error ? error.message : "头像上传失败，请稍后重试。");
    } finally {
      setUploadingAvatar(false);
    }
  }

  async function uploadAvatar(event: ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget;
    const file = input.files?.[0];
    if (!file) return;
    setSelectedDefaultAvatar(null);
    await saveAvatar(file);
    input.value = "";
  }

  async function selectDefaultAvatar(avatar: (typeof DEFAULT_AVATARS)[number]) {
    setSelectedDefaultAvatar(avatar.id);
    try {
      const response = await fetch(avatar.src);
      if (!response.ok) throw new Error("默认头像暂时不可用，请选择上传头像。");
      await saveAvatar(await response.blob(), `已选用${avatar.label}默认头像。`);
    } catch (error) {
      setSelectedDefaultAvatar(null);
      setAvatarMessage(error instanceof Error ? error.message : "默认头像暂时不可用，请选择上传头像。");
    }
  }

  async function selectNicknameAvatar() {
    setSelectedDefaultAvatar("initial");
    try {
      await saveAvatar(await createNicknameAvatar(nickname), "已选用昵称首字默认头像。");
    } catch (error) {
      setSelectedDefaultAvatar(null);
      setAvatarMessage(error instanceof Error ? error.message : "昵称头像暂时不可用，请选择其他头像。");
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (uploadingAvatar) {
      setMessage("请等待头像上传完成后再提交。");
      return;
    }
    const form = new FormData(event.currentTarget);
    const skills = form.getAll("skills");
    if (skills.length < 1 || skills.length > 3) {
      setMessage("请选择 1–3 个技能点。");
      return;
    }
    if (!avatarKey) {
      setMessage("请上传或选择一个默认头像。");
      return;
    }
    const optional = (name: string) => {
      const value = String(form.get(name) ?? "").trim();
      return value || undefined;
    };
    const wechat = optional("wechat");
    const email = optional("email");
    const otherContact = optional("otherContact");
    const contactCard = {
      ...(wechat ? { wechat } : {}),
      ...(email ? { email } : {}),
      ...(otherContact ? { otherLabel: optional("otherLabel") ?? "其他方式", otherValue: otherContact } : {}),
    };
    if (!contactCard.wechat && !contactCard.email && !contactCard.otherValue) {
      setMessage("请填写至少一种有效联系方式。");
      return;
    }
    const payload = {
      nickname: optional("nickname"), realName: optional("realName"), avatarKey: optional("avatarKey"),
      schoolId: optional("schoolId"), intro: optional("intro"), skills, interests: [], roles: [], workLinks: [],
      visibility: DEFAULT_APPLICATION_VISIBILITY,
      consentAccepted: form.get("consentAccepted") === "on", consentVersion: CONSENT_VERSION,
      contactCard,
    };

    setSubmitting(true);
    setMessage(null);
    try {
      const response = await fetch("/api/applications", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error ?? "提交失败，请稍后重试。");
      window.location.assign("/apply/status");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "提交失败，请稍后重试。");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="application-form" onSubmit={submit}>
      <section className="application-section">
        <p className="section-kicker">统一极简申请</p><h1>申请点亮我的头像</h1><p className="section-intro">先用最少的信息生成你的基础公开名片。通过审核后，随时可以在「我的」继续完善。</p>
        <h2>01 基本身份</h2>
        <div className="application-avatar-choice"><div className="avatar-upload-card"><div className="avatar-upload-preview" role="img" aria-label={`当前头像：${avatarUrl && !avatarImageFailed ? nickname.trim() || "你的头像" : nicknameInitial(nickname)}`}>{avatarUrl && !avatarImageFailed ? <img src={avatarUrl} alt="" onError={() => setAvatarImageFailed(true)} /> : <span aria-hidden="true">{nicknameInitial(nickname)}</span>}</div><div className="avatar-upload-copy"><strong>头像（必填）</strong><small>上传图片，或从下方选择默认头像。</small><label className="avatar-upload-action">{uploadingAvatar ? "正在处理…" : "上传头像"}<input type="file" accept="image/jpeg,image/png,image/webp" onChange={uploadAvatar} disabled={uploadingAvatar} /></label>{avatarMessage ? <span className={avatarKey ? "avatar-upload-success" : "avatar-upload-error"} role="status">{avatarMessage}</span> : null}</div><input name="avatarKey" type="hidden" value={avatarKey} /></div><div className="default-avatar-list" aria-label="选择默认头像"><button className="default-avatar-initial" type="button" aria-label="使用昵称首字头像" aria-pressed={selectedDefaultAvatar === "initial"} disabled={uploadingAvatar} onClick={() => void selectNicknameAvatar()}>{nicknameInitial(nickname)}</button>{DEFAULT_AVATARS.map((avatar) => <button key={avatar.id} type="button" aria-pressed={selectedDefaultAvatar === avatar.id} disabled={uploadingAvatar} onClick={() => void selectDefaultAvatar(avatar)}><img src={avatar.src} alt={avatar.label} /></button>)}</div></div>
        <div className="form-grid application-identity-grid"><label>昵称<input name="nickname" required minLength={2} maxLength={30} placeholder="例如：林同学" value={nickname} onChange={(event) => setNickname(event.currentTarget.value)} /></label><label>学校 / 校区<select name="schoolId" required value={selectedSchoolId} onChange={(event) => setSelectedSchoolId(event.currentTarget.value)}><option value="" disabled>请选择学校或校区</option>{schoolOptions.map((school) => <option key={school.id} value={school.id}>{[school.name, school.campus === school.name ? undefined : school.campus, school.city].filter(Boolean).join(" · ")}</option>)}</select></label></div>
        <details className="application-school-more"><summary>找不到学校 / 校区？搜索地图</summary><AmapLoader>{(state, amap) => state === "ready" && amap ? <ApplicationSchoolSearch amap={amap} schools={schoolOptions} onSelect={selectSchool} /> : <section className="school-search application-school-search"><p>{state === "failed" ? "高德搜索暂不可用，请从上方列表选择。" : "正在加载学校搜索…"}</p></section>}</AmapLoader></details>
      </section>
      <section className="application-section">
        <h2>02 让大家认识你</h2>
        <label>一句话介绍（10–50 字）<textarea name="intro" required minLength={10} maxLength={50} placeholder="正在探索 AI 如何帮助校园里的真实协作。" /></label>
        <fieldset><legend>技能点（选择 1–3 项）</legend><div className="choice-list">{SKILL_OPTIONS.map((skill) => <label key={skill}><input name="skills" type="checkbox" value={skill} checked={selectedSkills.includes(skill)} disabled={selectedSkills.length >= 3 && !selectedSkills.includes(skill)} onChange={(event) => { const checked = event.currentTarget.checked; setSelectedSkills((current) => checked ? [...current, skill] : current.filter((item) => item !== skill)); }} />{skill}</label>)}</div></fieldset>
      </section>
      <section className="application-section application-submit-section"><h2>03 审核与提交</h2><div className="form-grid application-review-grid"><label>真实姓名（仅审核所需）<input name="realName" required maxLength={60} /></label></div><fieldset className="application-contact-card"><legend>联系方式（至少填写一种）</legend><p>不会公开展示，仅在双方接受连接后交换。</p><div className="form-grid"><label>微信号<input name="wechat" minLength={2} maxLength={64} autoComplete="off" defaultValue={initialContact.wechat} /></label><label>联系邮箱<input name="email" type="email" maxLength={320} autoComplete="email" defaultValue={initialContact.email} /></label><label>其他联系方式<input name="otherContact" minLength={2} maxLength={100} placeholder="手机号、飞书或其他方式" defaultValue={initialContact.otherValue} /></label></div><input name="otherLabel" type="hidden" value={initialContact.otherLabel ?? ""} /></fieldset><label className="consent"><input name="consentAccepted" type="checkbox" required />我已阅读并同意社区规则与隐私说明（版本 {CONSENT_VERSION}）</label></section>
      {message ? <p className="form-error" role="alert">{message}</p> : null}
      <button className="application-submit" type="submit" disabled={submitting || uploadingAvatar}>{submitting ? "正在提交…" : uploadingAvatar ? "请等待头像处理完成…" : "保存并提交审核 →"}</button>
    </form>
  );
}
