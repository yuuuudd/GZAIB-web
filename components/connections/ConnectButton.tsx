"use client";

import { useState } from "react";
import { ConnectionRequestDialog } from "./ConnectionRequestDialog";

export type ConnectionCtaState = "visitor" | "own" | "eligible" | "pending" | "accepted" | "unavailable";

export function ConnectButton({ state, recipientSlug, recipientName, dailyRemaining }: {
  state: ConnectionCtaState;
  recipientSlug: string;
  recipientName: string;
  dailyRemaining: number;
}) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [currentState, setCurrentState] = useState(state);
  if (currentState === "unavailable") return null;
  if (currentState === "visitor") return <a className="connection-cta disabled-link" href="/apply">审核成员可发起连接 <span aria-hidden="true">→</span></a>;
  if (currentState === "own") return <a className="connection-cta" href="/me">编辑我的资料 <span aria-hidden="true">→</span></a>;
  if (currentState === "pending") return <button className="connection-cta" type="button" disabled>等待对方回应</button>;
  if (currentState === "accepted") return <a className="connection-cta" href="/me/connections?box=accepted">查看已交换的联系方式 <span aria-hidden="true">→</span></a>;
  return <>{dialogOpen ? <ConnectionRequestDialog recipientSlug={recipientSlug} recipientName={recipientName} dailyRemaining={dailyRemaining} onClose={() => setDialogOpen(false)} onCreated={() => { setCurrentState("pending"); setDialogOpen(false); }} /> : null}<button className="connection-cta" type="button" onClick={() => setDialogOpen(true)}>想认识 TA <span aria-hidden="true">→</span></button></>;
}
