"use client";

import { ChangeEvent, FormEvent, useState } from "react";
import {
  CONSENT_VERSION,
  DEFAULT_APPLICATION_VISIBILITY,
  ROLE_OPTIONS,
  SKILL_OPTIONS,
} from "../../features/applications/validation";
import { AmapLoader, AmapLocationPreview, GUANGDONG_PLACE_SEARCH_OPTIONS, parseAmapLocation, type AmapLocation, type AmapNamespace } from "../map/AmapLoader";

export type SchoolOption = { id: string; name: string; campus: string; city: string };
const maxAvatarSourceBytes = 5 * 1024 * 1024;

function normalizedSchoolName(value: string): string {
  return value.toLocaleLowerCase("zh-CN").replace(/校区/g, "").replace(/[\s·•（）()\-—_]/g, "");
}

export function matchConfirmedSchool(candidateName: string, schools: SchoolOption[]): SchoolOption | undefined {
  const candidate = normalizedSchoolName(candidateName);
  const campusMatch = schools.find((school) => candidate.includes(normalizedSchoolName(school.name)) && candidate.includes(normalizedSchoolName(school.campus)));
  if (campusMatch) return campusMatch;
  const nameMatches = schools.filter((school) => candidate.includes(normalizedSchoolName(school.name)));
  return nameMatches.length === 1 ? nameMatches[0] : undefined;
}

function ApplicationSchoolSearch({ amap, schools, onSelect }: { amap: AmapNamespace; schools: SchoolOption[]; onSelect: (school: SchoolOption) => void }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<AmapLocation[]>([]);
  const [preview, setPreview] = useState<AmapLocation>();
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  const matchedSchool = preview ? matchConfirmedSchool(preview.name, schools) : undefined;

  function search() {
    const keyword = query.trim();
    if (!keyword) return;
    setMessage("正在搜索高德地图…");
    setPreview(undefined);
    new amap.PlaceSearch(GUANGDONG_PLACE_SEARCH_OPTIONS).search(keyword, (status, value) => {
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
        const response = await fetch("/api/schools", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "select_amap", name: preview.name, campus: preview.name, city: preview.city, longitude: preview.longitude, latitude: preview.latitude }) });
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

  return <section className="school-search application-school-search"><h3>搜索高德学校</h3><p>先查看地点和周边地图，确认后会自动选入申请表。</p><div><input value={query} onChange={(event) => setQuery(event.currentTarget.value)} placeholder="例如：华南理工大学五山校区" aria-label="搜索高德学校" /><button type="button" className="action-primary" disabled={pending} onClick={search}>搜索</button></div>{message ? <p role="status">{message}</p> : null}{preview ? <AmapLocationPreview amap={amap} location={preview} pending={pending} onBack={() => setPreview(undefined)} onConfirm={() => void confirm()} confirmLabel="确认选择这个学校" /> : <ul>{results.map((candidate) => <li key={`${candidate.name}-${candidate.longitude}`}><button type="button" disabled={pending} onClick={() => setPreview(candidate)}><strong>{candidate.name}</strong><span>{[candidate.city, candidate.district, candidate.address].filter(Boolean).join(" · ")}</span></button></li>)}</ul>}</section>;
}

function nicknameInitial(nickname: string): string {
  return Array.from(nickname.trim())[0] ?? "你";
}

export function ApplicationForm({ schools }: { schools: SchoolOption[] }) {
  const [message, setMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [nickname, setNickname] = useState("");
  const [avatarKey, setAvatarKey] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [avatarImageFailed, setAvatarImageFailed] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [avatarMessage, setAvatarMessage] = useState<string | null>(null);
  const [schoolOptions, setSchoolOptions] = useState(schools);
  const [selectedSchoolId, setSelectedSchoolId] = useState("");
  const [selectedSkills, setSelectedSkills] = useState<string[]>([]);

  function selectSchool(school: SchoolOption) {
    setSchoolOptions((current) => current.some((item) => item.id === school.id) ? current : [...current, school]);
    setSelectedSchoolId(school.id);
  }

  async function uploadAvatar(event: ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget;
    const file = input.files?.[0];
    if (!file) return;
    if (file.size > maxAvatarSourceBytes) {
      setAvatarMessage("头像文件须小于或等于 5 MB。");
      input.value = "";
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
      setAvatarMessage("头像已安全处理并保存。");
    } catch (error) {
      setAvatarMessage(error instanceof Error ? error.message : "头像上传失败，请稍后重试。");
      input.value = "";
    } finally {
      setUploadingAvatar(false);
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
    const optional = (name: string) => {
      const value = String(form.get(name) ?? "").trim();
      return value || undefined;
    };
    const payload = {
      nickname: optional("nickname"), realName: optional("realName"), avatarKey: optional("avatarKey"),
      schoolId: optional("schoolId"), major: optional("major"), grade: optional("grade"), intro: optional("intro"),
      currentFocus: optional("currentFocus"), canOffer: optional("canOffer"), wantsToMeet: optional("wantsToMeet"),
      skills, interests: String(form.get("interests") ?? "").split(/[,，\n]/).map((item) => item.trim()).filter(Boolean),
      roles: form.getAll("roles"),
      workLinks: String(form.get("workLinks") ?? "").split(/\n/).map((item) => item.trim()).filter(Boolean),
      visibility: DEFAULT_APPLICATION_VISIBILITY,
      consentAccepted: form.get("consentAccepted") === "on", consentVersion: CONSENT_VERSION,
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
        <p className="section-kicker">统一极简申请</p><h1>申请点亮我的头像</h1>
        <p className="section-intro">先用最少的信息让大家认识你。通过审核后，随时可以在「我的」继续完善。</p>
        <label>昵称 <input name="nickname" required minLength={2} maxLength={30} placeholder="例如：林同学" value={nickname} onChange={(event) => setNickname(event.currentTarget.value)} /></label>
      </section>
      <section className="application-section">
        <h2>你在哪里</h2>
        <AmapLoader>{(state, amap) => state === "ready" && amap ? <ApplicationSchoolSearch amap={amap} schools={schoolOptions} onSelect={selectSchool} /> : <section className="school-search application-school-search"><h3>搜索高德学校</h3><p>先查看地点和周边地图，确认后会自动选入申请表。{state === "failed" ? "高德搜索暂不可用，请从下方列表选择。" : "正在加载学校搜索…"}</p></section>}</AmapLoader>
        <label>学校 / 校区<select name="schoolId" required value={selectedSchoolId} onChange={(event) => setSelectedSchoolId(event.currentTarget.value)}><option value="" disabled>请选择或搜索学校</option>{schoolOptions.map((school) => <option key={school.id} value={school.id}>{school.name} · {school.campus} · {school.city}</option>)}</select></label>
      </section>
      <section className="application-section">
        <h2>让大家快速认识你</h2>
        <label>一句话介绍<textarea name="intro" required minLength={10} maxLength={160} placeholder="正在探索 AI 如何帮助校园里的真实协作。" /></label>
        <fieldset><legend>技能点（选择 1–3 项）</legend><div className="choice-list">{SKILL_OPTIONS.map((skill) => <label key={skill}><input name="skills" type="checkbox" value={skill} checked={selectedSkills.includes(skill)} disabled={selectedSkills.length >= 3 && !selectedSkills.includes(skill)} onChange={(event) => { const checked = event.currentTarget.checked; setSelectedSkills((current) => checked ? [...current, skill] : current.filter((item) => item !== skill)); }} />{skill}</label>)}</div></fieldset>
      </section>
      <details className="application-optional">
        <summary>更多资料（全部选填）</summary>
        <div className="application-optional-content">
          <div className="avatar-upload-card">
            <div className="avatar-upload-preview" role="img" aria-label={`当前头像：${avatarUrl && !avatarImageFailed ? nickname.trim() || "你的头像" : nicknameInitial(nickname)}`}>
              {/* A newly uploaded owner-scoped URL renders immediately and is already normalized by the avatar API. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {avatarUrl && !avatarImageFailed ? <img src={avatarUrl} alt="" onError={() => setAvatarImageFailed(true)} /> : <span aria-hidden="true">{nicknameInitial(nickname)}</span>}
            </div>
            <div className="avatar-upload-copy"><strong>上传头像</strong><small>JPEG、PNG 或 WebP，最大 5 MB。</small><label className="avatar-upload-action">{uploadingAvatar ? "正在安全处理…" : avatarKey ? "更换头像" : "选择头像"}<input type="file" accept="image/jpeg,image/png,image/webp" onChange={uploadAvatar} disabled={uploadingAvatar} /></label>{avatarMessage ? <span className={avatarKey ? "avatar-upload-success" : "avatar-upload-error"} role="status">{avatarMessage}</span> : null}</div>
            <input name="avatarKey" type="hidden" value={avatarKey} />
          </div>
          <div className="form-grid"><label>真实姓名（仅审核所需）<input name="realName" maxLength={60} /></label><label>专业<input name="major" maxLength={100} /></label><label>年级<input name="grade" maxLength={40} /></label></div>
          <div className="form-grid"><label>我正在做什么<textarea name="currentFocus" maxLength={500} /></label><label>我能提供什么<textarea name="canOffer" maxLength={500} /></label><label>我希望认识谁<textarea name="wantsToMeet" maxLength={500} /></label></div>
          <label>感兴趣的方向（逗号分隔，最多 6 项）<input name="interests" placeholder="教育创新，校园服务" /></label>
          <fieldset><legend>参与角色（最多 4 项）</legend><div className="choice-list">{ROLE_OPTIONS.map((role) => <label key={role}><input name="roles" type="checkbox" value={role} />{role}</label>)}</div></fieldset>
          <label>作品链接（每行一个 HTTPS 链接，最多 5 条）<textarea name="workLinks" placeholder="https://example.com/my-work" /></label>
        </div>
      </details>
      <p className="application-settings-note">审核通过后可在账号设置中调整资料公开范围。</p>
      <label className="consent"><input name="consentAccepted" type="checkbox" required />我已阅读并同意社区规则与隐私说明（版本 {CONSENT_VERSION}）</label>
      {message ? <p className="form-error" role="alert">{message}</p> : null}
      <button className="application-submit" type="submit" disabled={submitting || uploadingAvatar}>{submitting ? "正在提交…" : uploadingAvatar ? "请等待头像处理完成…" : "保存并提交审核 →"}</button>
    </form>
  );
}
