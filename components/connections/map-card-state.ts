import type { ConnectionCtaState } from "./ConnectButton";

export type MapConnectionCardState = ConnectionCtaState | "waiting" | "connected" | "declined";

export function mapConnectionCardState(status?: string, fallback: ConnectionCtaState = "unavailable"): MapConnectionCardState {
  if (status === "accepted") return "connected";
  if (status === "pending") return "waiting";
  if (status === "declined") return "declined";
  return fallback;
}
