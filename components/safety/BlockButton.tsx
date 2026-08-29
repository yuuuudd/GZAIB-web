"use client";
import { useState } from "react";
export function BlockButton({ memberSlug, name = "该成员", onBlocked }: { memberSlug: string; name?: string; onBlocked?(): void }) {
  const [confirming, setConfirming] = useState(false); const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  async function block() { setBusy(true); setError(""); try { const response = await fetch("/api/me/blocks", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ memberSlug }) }); if (!response.ok) throw new Error(); setConfirming(false); onBlocked?.(); } catch { setError("暂时无法拉黑，请稍后再试。"); } finally { setBusy(false); } }
  return <div className="safety-action">{confirming ? <div role="alertdialog" aria-modal="true" aria-label="确认拉黑"><p>拉黑 {name} 后，待处理连接会被取消，双方无法读取联系方式。</p><button type="button" onClick={() => void block()} disabled={busy}>{busy ? "处理中…" : "确认拉黑"}</button><button type="button" onClick={() => setConfirming(false)} disabled={busy}>取消</button></div> : <button type="button" onClick={() => setConfirming(true)}>拉黑</button>}{error ? <p role="alert">{error}</p> : null}</div>;
}
