"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { safetyDialogSuccessState, useSafetyDialogFocus } from "./dialog-focus";

export function BlockButton({ memberSlug, name = "该成员", onBlocked }: { memberSlug: string; name?: string; onBlocked?(): void }) {
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [blocked, setBlocked] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const statusRef = useRef<HTMLParagraphElement>(null);
  const shouldFocusStatusRef = useRef(false);

  const closeAndRestoreFocus = useCallback(() => {
    setConfirming(false);
    queueMicrotask(() => triggerRef.current?.focus());
  }, []);
  useSafetyDialogFocus(confirming, closeAndRestoreFocus, dialogRef, titleRef);
  useEffect(() => {
    if (!blocked || !shouldFocusStatusRef.current) return;
    shouldFocusStatusRef.current = false;
    queueMicrotask(() => statusRef.current?.focus());
  }, [blocked]);

  async function block() {
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/me/blocks", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ memberSlug }),
      });
      if (!response.ok) throw new Error();
      const next = safetyDialogSuccessState("blocked");
      shouldFocusStatusRef.current = next.focusTarget === "status";
      setBlocked(next.result === "blocked");
      setConfirming(next.open);
      onBlocked?.();
    } catch {
      setError("暂时无法拉黑，请稍后再试。");
    } finally {
      setBusy(false);
    }
  }

  if (blocked) return <p ref={statusRef} className="safety-action-status" role="status" tabIndex={-1}>已拉黑 {name}，联系方式访问已停止。</p>;
  return <div className="safety-action">
    {confirming ? <div ref={dialogRef} role="alertdialog" aria-modal="true" aria-labelledby="block-dialog-title">
      <h2 id="block-dialog-title" ref={titleRef} tabIndex={-1}>确认拉黑</h2>
      <p>拉黑 {name} 后，待处理连接会被取消，双方无法读取联系方式。</p>
      <button type="button" onClick={() => void block()} disabled={busy}>{busy ? "处理中…" : "确认拉黑"}</button>
      <button type="button" onClick={closeAndRestoreFocus} disabled={busy}>取消</button>
    </div> : <button ref={triggerRef} type="button" onClick={() => setConfirming(true)}>拉黑</button>}
    {error ? <p role="alert">{error}</p> : null}
  </div>;
}
