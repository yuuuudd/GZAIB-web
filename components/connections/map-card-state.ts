export type MapConnectionCardState = "ready" | "waiting" | "connected" | "declined";

export function mapConnectionCardState(status?: string): MapConnectionCardState {
  if (status === "accepted") return "connected";
  if (status === "pending") return "waiting";
  if (status === "declined") return "declined";
  return "ready";
}
