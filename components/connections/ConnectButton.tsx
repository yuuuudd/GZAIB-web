"use client";

import { useEffect, useRef, useState } from "react";
import { ConnectionRequestDialog } from "./ConnectionRequestDialog";

export type ConnectionCtaState = "visitor" | "own" | "eligible" | "pending" | "accepted" | "unavailable";

export function connectionCreatedUiState() {
  return { ctaState: "pending" as const, focusTarget: "status" as const };
}

export function ConnectButton({ state, recipientSlug, recipientName, dailyRemaining, label, onSent }: {
  state: ConnectionCtaState;
  recipientSlug: string;
  recipientName: string;
  dailyRemaining: number;
  label?: string;
  onSent?: () => void;
}) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [optimisticState, setOptimisticState] = useState<{ source: ConnectionCtaState; value: ConnectionCtaState }>();
  const currentState = optimisticState?.source === state ? optimisticState.value : state;
  const triggerRef = useRef<HTMLButtonElement>(null);
  const statusRef = useRef<HTMLDivElement>(null);
  const shouldFocusStatusRef = useRef(false);
  useEffect(() => {
    if (currentState !== "pending" || !shouldFocusStatusRef.current) return;
    shouldFocusStatusRef.current = false;
    queueMicrotask(() => statusRef.current?.focus());
  }, [currentState]);
  function closeAndRestoreFocus() {
    setDialogOpen(false);
    queueMicrotask(() => triggerRef.current?.focus());
  }
  if (currentState === "unavailable") return null;
  if (currentState === "visitor") return <a className="connection-cta disabled-link" href="/apply">审核成员可发起连接 <span aria-hidden="true">→</span></a>;
  if (currentState === "own") return <a className="connection-cta" href="/me">编辑我的资料 <span aria-hidden="true">→</span></a>;
  if (currentState === "pending") return <div ref={statusRef} className="connection-pending-status" role="status" tabIndex={-1}><button className="connection-cta" type="button" disabled>等待对方回应</button></div>;
  if (currentState === "accepted") return <a className="connection-cta" href="/me/connections?box=accepted">查看已交换的联系方式 <span aria-hidden="true">→</span></a>;
  return <>{dialogOpen ? <ConnectionRequestDialog recipientSlug={recipientSlug} recipientName={recipientName} dailyRemaining={dailyRemaining} onClose={closeAndRestoreFocus} onCreated={() => { const next = connectionCreatedUiState(); shouldFocusStatusRef.current = next.focusTarget === "status"; setOptimisticState({ source: state, value: next.ctaState }); setDialogOpen(false); onSent?.(); }} /> : null}<button ref={triggerRef} className="connection-cta" type="button" onClick={() => setDialogOpen(true)}>{label ?? "想认识 TA"} <span aria-hidden="true">→</span></button></>;
}
