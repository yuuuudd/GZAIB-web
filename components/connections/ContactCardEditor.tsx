"use client";

import { type FormEvent, useState } from "react";
import type { ContactCard } from "../../features/connections/contact-card";

export function ContactCardEditor({ initialCard }: { initialCard?: ContactCard }) {
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true); setMessage(null);
    const form = new FormData(event.currentTarget);
    const optional = (name: string) => String(form.get(name) ?? "").trim() || undefined;
    const wechat = optional("wechat"); const email = optional("email");
    const otherLabel = optional("otherLabel"); const otherValue = optional("otherValue");
    const payload = { ...(wechat ? { wechat } : {}), ...(email ? { email } : {}), ...(otherLabel ? { otherLabel } : {}), ...(otherValue ? { otherValue } : {}) };
    try {
      const response = await fetch("/api/me/contact-card", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error ?? "暂时无法保存联系方式，请稍后重试。");
      setMessage("联系方式已加密保存。新的内容会立即替换此前的名片。");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "暂时无法保存联系方式，请稍后重试。");
    } finally { setBusy(false); }
  }

  return <form className="contact-card-editor profile-editor" onSubmit={save}>
    <header><div><p className="section-kicker">私密联系方式</p><h1>管理我的联系名片</h1></div><a href="/me">返回成员中心 →</a></header>
    <section className="contact-card-consent"><h2>由你决定何时交换</h2><p>仅在双方接受连接后，对方才能查看你此刻保存的联系方式。修改或清空名片会立即影响之后的查看。</p><p>联系方式不会出现在地图、搜索结果或连接请求正文中。</p></section>
    <section><h2>联系方式</h2><p className="contact-card-hint">至少填写一种。若使用“其他方式”，请同时填写名称和内容。</p><div className="profile-form-grid">
      <label>微信号<input name="wechat" minLength={2} maxLength={64} autoComplete="off" defaultValue={initialCard?.wechat} /></label>
      <label>邮箱<input name="email" type="email" maxLength={320} autoComplete="email" defaultValue={initialCard?.email} /></label>
      <label>其他方式名称<input name="otherLabel" minLength={2} maxLength={20} placeholder="例如：作品集" defaultValue={initialCard?.otherLabel} /></label>
      <label>其他方式内容<input name="otherValue" minLength={2} maxLength={100} placeholder="例如：https://…" defaultValue={initialCard?.otherValue} /></label>
    </div></section>
    {message ? <p className="profile-editor-message" role="status">{message}</p> : null}
    <button className="application-submit" type="submit" disabled={busy}>{busy ? "正在加密保存…" : "加密保存我的联系名片"}</button>
  </form>;
}
