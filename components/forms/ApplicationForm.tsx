"use client";

import { FormEvent, useState } from "react";
import {
  CONSENT_VERSION,
  DEFAULT_APPLICATION_VISIBILITY,
  getMapEligibility,
  MAP_REQUIRED_VISIBILITY_FIELDS,
  OPTIONAL_VISIBILITY_FIELDS,
  ROLE_OPTIONS,
  SKILL_OPTIONS,
} from "../../features/applications/validation";
import type { Visibility } from "../../features/directory/types";
import { VisibilityField } from "./VisibilityField";

type SchoolOption = { id: string; name: string; campus: string; city: string };
type PrivacyField = keyof typeof DEFAULT_APPLICATION_VISIBILITY;
const privacyFields = [...MAP_REQUIRED_VISIBILITY_FIELDS, ...OPTIONAL_VISIBILITY_FIELDS] as PrivacyField[];

const privacyLabels: Record<PrivacyField, string> = {
  nickname: "昵称", avatarUrl: "头像", school: "学校", city: "城市", intro: "一句话介绍", skills: "技能", roles: "参与角色",
  verifiedBuilder: "共建者状态", contributions: "已确认贡献",
  currentFocus: "我正在做什么", canOffer: "我能提供什么", wantsToMeet: "我希望认识谁",
  workLinks: "作品链接", major: "专业", grade: "年级",
};

export function ApplicationForm({ schools }: { schools: SchoolOption[] }) {
  const [visibility, setVisibility] = useState(() => ({ ...DEFAULT_APPLICATION_VISIBILITY }));
  const [message, setMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function setFieldVisibility(field: PrivacyField, value: Visibility) {
    setVisibility((current) => ({ ...current, [field]: value }));
  }

  const mapEligibility = getMapEligibility(visibility);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const optional = (name: string) => {
      const value = String(form.get(name) ?? "").trim();
      return value || undefined;
    };
    const payload = {
      nickname: optional("nickname"), realName: optional("realName"), avatarKey: optional("avatarKey"),
      schoolId: optional("schoolId"), major: optional("major"), grade: optional("grade"), intro: optional("intro"),
      currentFocus: optional("currentFocus"), canOffer: optional("canOffer"), wantsToMeet: optional("wantsToMeet"),
      skills: form.getAll("skills"), interests: String(form.get("interests") ?? "").split(/[,，\n]/).map((item) => item.trim()).filter(Boolean),
      roles: form.getAll("roles"),
      workLinks: String(form.get("workLinks") ?? "").split(/\n/).map((item) => item.trim()).filter(Boolean),
      visibility, consentAccepted: form.get("consentAccepted") === "on", consentVersion: CONSENT_VERSION,
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
        <p className="section-kicker">01 / 身份</p><h1>申请点亮我的头像</h1>
        <p className="section-intro">提交后由运营团队审核；通过后，符合公开条件的资料才会出现在共建地图中。</p>
        <div className="form-grid"><label>昵称 <input name="nickname" required minLength={2} maxLength={30} placeholder="例如：林同学" /></label><label>真实姓名（仅审核所需）<input name="realName" maxLength={60} /></label><label>头像文件标识（可选）<input name="avatarKey" maxLength={240} placeholder="上传功能开放后填写" /></label></div>
      </section>
      <section className="application-section">
        <p className="section-kicker">02 / 学校</p><h2>你的校园与方向</h2>
        <div className="form-grid"><label>已确认学校 / 校区<select name="schoolId" required defaultValue=""><option value="" disabled>请选择学校或校区</option>{schools.map((school) => <option key={school.id} value={school.id}>{school.name} · {school.campus} · {school.city}</option>)}</select></label><label>专业（可选）<input name="major" maxLength={100} /></label><label>年级（可选）<input name="grade" maxLength={40} /></label></div>
      </section>
      <section className="application-section">
        <p className="section-kicker">03 / 方向</p><h2>让大家知道你正在关注什么</h2>
        <label>一句话介绍<textarea name="intro" required minLength={10} maxLength={160} placeholder="正在探索 AI 如何帮助校园里的真实协作。" /></label>
        <div className="form-grid"><label>我正在做什么<textarea name="currentFocus" maxLength={500} /></label><label>我能提供什么<textarea name="canOffer" maxLength={500} /></label><label>我希望认识谁<textarea name="wantsToMeet" maxLength={500} /></label></div>
      </section>
      <section className="application-section">
        <p className="section-kicker">04 / 参与</p><h2>能力与参与方式</h2>
        <fieldset><legend>技能方向（最多 8 项）</legend><div className="choice-list">{SKILL_OPTIONS.map((skill) => <label key={skill}><input name="skills" type="checkbox" value={skill} />{skill}</label>)}</div></fieldset>
        <label>感兴趣的方向（最多 6 项，以逗号分隔）<input name="interests" placeholder="教育创新，校园服务" /></label>
        <fieldset><legend>参与角色（最多 4 项）</legend><div className="choice-list">{ROLE_OPTIONS.map((role) => <label key={role}><input name="roles" type="checkbox" value={role} />{role}</label>)}</div></fieldset>
      </section>
      <section className="application-section">
        <p className="section-kicker">05 / 作品</p><h2>可选作品链接</h2>
        <label>每行一个 HTTPS 链接，最多 5 条<textarea name="workLinks" placeholder="https://example.com/my-work" /></label>
      </section>
      <section className="application-section application-privacy">
        <p className="section-kicker">06 / 公开范围</p><h2>资料由你逐项决定谁能看见</h2>
        <p className="section-intro">地图所需资料默认所有访客可见；新的可选资料默认仅自己和必要管理员可见。你可以逐项调整，但只有全部地图所需资料公开时，审核通过的资料才会出现在地图。</p>
        <div className="privacy-grid">{privacyFields.map((field) => <VisibilityField key={field} label={privacyLabels[field]} value={visibility[field]} onChange={(value) => setFieldVisibility(field, value)} />)}</div>
        <p className={`map-eligibility ${mapEligibility.eligible ? "map-eligible" : "map-ineligible"}`} role="status">
          {mapEligibility.eligible
            ? "当前公开设置已满足地图展示条件。"
            : `当前公开设置会让地图展示暂不可用：${mapEligibility.blockedBy.map((field) => privacyLabels[field as PrivacyField]).join("、")}。即使审核通过，资料也会保持在地图外，直到这些字段改为“所有访客可见”。`}
        </p>
      </section>
      <label className="consent"><input name="consentAccepted" type="checkbox" required />我已阅读并同意社区规则与隐私说明（版本 {CONSENT_VERSION}）</label>
      {message ? <p className="form-error" role="alert">{message}</p> : null}
      <button className="application-submit" type="submit" disabled={submitting}>{submitting ? "正在提交…" : "保存并提交审核 →"}</button>
    </form>
  );
}
