"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { nextDialogFocusIndex, shouldCloseConnectionDialog } from "./dialog-focus";

export function ConnectionRequestDialog({ recipientSlug, recipientName, dailyRemaining, onClose, onCreated }: {
  recipientSlug: string;
  recipientName: string;
  dailyRemaining: number;
  onClose(): void;
  onCreated(): void;
}) {
  const titleRef = useRef<HTMLHeadingElement>(null);
  const dialogRef = useRef<HTMLElement>(null);
  const topic = "校园 AI 共建交流";
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  useEffect(() => { titleRef.current?.focus(); }, []);
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (shouldCloseConnectionDialog(event.key)) { event.preventDefault(); onClose(); return; }
      if (event.key !== "Tab") return;
      const focusable = Array.from(dialogRef.current?.querySelectorAll<HTMLElement>("button:not([disabled]), input:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex='-1'])") ?? [])
        .filter((element) => element.offsetParent !== null);
      const target = nextDialogFocusIndex(focusable.indexOf(document.activeElement as HTMLElement), focusable.length, event.shiftKey);
      if (target >= 0) { event.preventDefault(); focusable[target]?.focus(); }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true); setNotice("");
    try {
      const safeMessage = message.trim() || "我想和你聊聊校园 AI 共建的实践与合作想法。";
      const response = await fetch("/api/connections", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ recipientId: recipientSlug, topic, message: safeMessage }) });
      const data = await response.json() as { error?: string };
      if (!response.ok) { setNotice(data.error ?? "提交失败，请稍后再试。"); return; }
      setNotice("连接请求已发出，等待对方回应。");
      onCreated();
    } catch { setNotice("网络暂时不可用，请稍后再试。"); }
    finally { setBusy(false); }
  }
  return <div className="connection-dialog-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section className="connection-dialog" ref={dialogRef} role="dialog" tabIndex={-1} aria-modal="true" aria-labelledby="connection-dialog-title" aria-describedby="connection-dialog-description">
      <button type="button" className="connection-dialog-close" onClick={onClose} aria-label="关闭连接请求对话框">×</button>
      <p className="section-kicker">发起连接</p><h2 id="connection-dialog-title" tabIndex={-1} ref={titleRef}>向 {recipientName} 发起连接申请？</h2>
      <p id="connection-dialog-description">对方会收到你的连接申请，待对方同意后，双方可交换联系方式。</p>
      <form onSubmit={submit}>
        <label>可选留言（填写时 10～100 字） <span>{message.trim().length}/100</span><textarea value={message} onChange={(event) => setMessage(event.currentTarget.value)} minLength={10} maxLength={100} placeholder="介绍一下你自己，或说明你想认识 TA 的原因……" /></label>
        <p className="connection-privacy-reminder">今日还可发起 {dailyRemaining} 次连接；联系方式仅在双方同意后交换。</p>
        {notice ? <p role="status" className="connection-form-status">{notice}</p> : null}
        <div className="connection-dialog-actions"><button type="button" onClick={onClose}>取消</button><button type="submit" disabled={busy}>{busy ? "正在发送…" : "发送申请"}</button></div>
      </form>
    </section>
  </div>;
}
