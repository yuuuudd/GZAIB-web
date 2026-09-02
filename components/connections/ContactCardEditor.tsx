"use client";

import { type FormEvent, useEffect, useRef, useState } from "react";
import type { ContactCard } from "../../features/connections/contact-card";

export function ContactCardEditor({ initialCard, embedded = false }: { initialCard?: ContactCard; embedded?: boolean }) {
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState<ContactCard>(initialCard ?? {});
  const [confirmingClear, setConfirmingClear] = useState(false);
  const statusRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => { if (message) statusRef.current?.focus(); }, [message]);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true); setMessage(null);
    const optional = (value: string | undefined) => value?.trim() || undefined;
    const wechat = optional(draft.wechat); const email = optional(draft.email);
    const otherLabel = optional(draft.otherLabel); const otherValue = optional(draft.otherValue);
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

  async function clear() {
    setBusy(true); setMessage(null);
    try {
      const response = await fetch("/api/me/contact-card", { method: "DELETE" });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error ?? "暂时无法清除联系名片，请稍后重试。");
      setDraft({}); setConfirmingClear(false);
      setMessage("当前联系名片已清除；已接受连接的成员将立刻看不到它。");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "暂时无法清除联系名片，请稍后重试。");
    } finally { setBusy(false); }
  }

  return <form className={`contact-card-editor${embedded ? " is-embedded" : " profile-editor"}`} onSubmit={save}>
    {!embedded ? <header><div><p className="section-kicker">私密联系方式</p><h1>管理我的联系名片</h1></div><a href="/me">返回成员中心 →</a></header> : null}
    {!embedded ? <section className="contact-card-consent"><h2>由你决定何时交换</h2><p>仅在双方接受连接后，对方才能查看你此刻保存的联系方式。修改或清空名片会立即影响之后的查看。</p><p>联系方式不会出现在地图、搜索结果或连接请求正文中。</p></section> : null}
    <section className={embedded ? "contact-card-fields" : undefined}>{!embedded ? <h2>联系方式</h2> : null}<p className="contact-card-hint">至少填写一种。若使用“其他方式”，请同时填写名称和内容。</p><div className="profile-form-grid">
      <label>微信号<input name="wechat" minLength={2} maxLength={64} autoComplete="off" value={draft.wechat ?? ""} onChange={(event) => setDraft((current) => ({ ...current, wechat: event.target.value }))} /></label>
      <label>邮箱<input name="email" type="email" maxLength={320} autoComplete="email" value={draft.email ?? ""} onChange={(event) => setDraft((current) => ({ ...current, email: event.target.value }))} /></label>
      <label>其他方式名称<input name="otherLabel" minLength={2} maxLength={20} placeholder="例如：作品集" value={draft.otherLabel ?? ""} onChange={(event) => setDraft((current) => ({ ...current, otherLabel: event.target.value }))} /></label>
      <label>其他方式内容<input name="otherValue" minLength={2} maxLength={100} placeholder="例如：https://…" value={draft.otherValue ?? ""} onChange={(event) => setDraft((current) => ({ ...current, otherValue: event.target.value }))} /></label>
    </div></section>
    {message ? <p className="profile-editor-message" ref={statusRef} role="status" tabIndex={-1}>{message}</p> : null}
    <button className={embedded ? "settings-save-button" : "application-submit"} type="submit" disabled={busy}>{busy ? "正在加密保存…" : embedded ? "保存联系方式" : "加密保存我的联系名片"}</button>
    {confirmingClear ? <section className="contact-card-clear-confirmation" aria-labelledby="clear-contact-card-title"><h2 id="clear-contact-card-title">清除当前名片？</h2><p>此操作会立即撤回已接受连接成员对这张名片的查看权限，且无法恢复。</p><button type="button" className="application-submit" onClick={() => void clear()} disabled={busy}>{busy ? "正在清除…" : "确认清除名片"}</button><button type="button" onClick={() => setConfirmingClear(false)} disabled={busy}>取消</button></section> : <button type="button" onClick={() => setConfirmingClear(true)} disabled={busy}>清除当前名片</button>}
  </form>;
}
