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
  const [topic, setTopic] = useState("");
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
      const response = await fetch("/api/connections", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ recipientId: recipientSlug, topic, message }) });
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
      <p className="section-kicker">发起连接</p><h2 id="connection-dialog-title" tabIndex={-1} ref={titleRef}>认识 {recipientName}</h2>
      <p id="connection-dialog-description">用一段清晰、友善的介绍开启交流。请不要填写微信号、邮箱或其他联系方式。</p>
      <form onSubmit={submit}>
        <label>想交流的话题 <span>{topic.trim().length}/60</span><input value={topic} onChange={(event) => setTopic(event.currentTarget.value)} minLength={2} maxLength={60} required autoComplete="off" /></label>
        <label>介绍与连接理由 <span>{message.trim().length}/500</span><textarea value={message} onChange={(event) => setMessage(event.currentTarget.value)} minLength={20} maxLength={500} required /></label>
        <p className="connection-privacy-reminder">联系方式仅在双方接受连接后，从各自当前名片中读取；它不会出现在这条请求里。</p>
        <p className="connection-limit">今日还可发起 <strong>{dailyRemaining}</strong> 次连接请求</p>
        {notice ? <p role="status" className="connection-form-status">{notice}</p> : null}
        <div className="connection-dialog-actions"><button type="button" onClick={onClose}>取消</button><button type="submit" disabled={busy}>{busy ? "正在发送…" : "确认发送请求"}</button></div>
      </form>
    </section>
  </div>;
}
