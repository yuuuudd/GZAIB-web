"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { safetyDialogSuccessState, useSafetyDialogFocus } from "./dialog-focus";

const categories = [["harassment", "骚扰或辱骂"], ["spam", "垃圾信息"], ["false_identity", "身份不实"], ["privacy", "隐私问题"], ["other", "其他"]] as const;

export function ReportDialog({ targetMemberSlug, requestId }: { targetMemberSlug: string; requestId?: string }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<(typeof categories)[number][0]>("harassment");
  const [notice, setNotice] = useState("");
  const [reportId, setReportId] = useState<string>();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const statusRef = useRef<HTMLDivElement>(null);
  const shouldFocusStatusRef = useRef(false);

  const closeAndRestoreFocus = useCallback(() => {
    setOpen(false);
    queueMicrotask(() => triggerRef.current?.focus());
  }, []);
  useSafetyDialogFocus(open, closeAndRestoreFocus, dialogRef, titleRef);
  useEffect(() => {
    if (!reportId || !shouldFocusStatusRef.current) return;
    shouldFocusStatusRef.current = false;
    queueMicrotask(() => statusRef.current?.focus());
  }, [reportId]);

  async function submit() {
    setBusy(true);
    setNotice("");
    try {
      const response = await fetch("/api/reports", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ targetMemberSlug, category, description, ...(requestId ? { requestId } : {}) }),
      });
      const data = await response.json() as { report?: { id?: string } };
      if (!response.ok || !data.report?.id) {
        setNotice("举报未提交，请检查说明长度后重试。");
        return;
      }
      const next = safetyDialogSuccessState("reported");
      shouldFocusStatusRef.current = next.focusTarget === "status";
      setNotice("举报已提交，运营将按规则处理。");
      setReportId(data.report.id);
      setOpen(next.open);
    } catch {
      setNotice("举报未提交，请稍后重试。");
    } finally {
      setBusy(false);
    }
  }

  return <div className="safety-action">
    <button ref={triggerRef} type="button" onClick={() => { setNotice(""); setOpen(true); }}>举报</button>
    {open ? <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="report-title" aria-describedby="report-description">
      <h2 id="report-title" ref={titleRef} tabIndex={-1}>举报成员</h2>
      <p id="report-description">只提交判断安全问题所需的信息，请勿填写联系方式或其他不必要的私人信息。</p>
      <label>类型<select value={category} onChange={(event) => setCategory(event.target.value as typeof category)}>{categories.map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label>
      <label>说明（20–1000 字）<textarea value={description} minLength={20} maxLength={1000} onChange={(event) => setDescription(event.target.value)} /></label>
      {notice ? <p role="alert">{notice}</p> : null}
      <button type="button" onClick={() => void submit()} disabled={busy || description.trim().length < 20}>{busy ? "正在提交…" : "提交举报"}</button>
      <button type="button" onClick={closeAndRestoreFocus} disabled={busy}>取消</button>
    </div> : null}
    {reportId ? <div ref={statusRef} className="safety-action-status" role="status" tabIndex={-1}>
      <p>{notice}</p><a href={`/api/me/reports/${encodeURIComponent(reportId)}`}>查看举报处理状态</a>
    </div> : null}
  </div>;
}
