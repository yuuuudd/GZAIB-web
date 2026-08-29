import { canCreate } from "./policy";
import type { ConnectionPolicyContext } from "./types";
import type { Viewer } from "../directory/types";

export type ConnectionCtaState = "visitor" | "own" | "eligible" | "pending" | "accepted" | "unavailable";

type CtaRepository = {
  hasAcceptedRelationship(leftUserId: string, rightUserId: string): Promise<boolean>;
  getCreateContext(senderId: string, recipientId: string, input: { topic: string; message: string }, now: number): Promise<ConnectionPolicyContext>;
};

/** Server-only CTA projection. Block/unavailable status wins over every historical relationship state. */
export async function resolveConnectionCtaState(viewer: Viewer, slug: string, dependencies: {
  resolveRecipientId(slug: string): Promise<string | undefined>;
  repository: CtaRepository;
  now(): number;
}): Promise<{ state: ConnectionCtaState; dailyRemaining: number }> {
  if (viewer.kind === "visitor") return { state: "visitor", dailyRemaining: 0 };
  if (viewer.kind !== "member") return { state: "unavailable", dailyRemaining: 0 };
  const recipientId = await dependencies.resolveRecipientId(slug);
  if (!recipientId) return { state: "unavailable", dailyRemaining: 0 };
  if (recipientId === viewer.userId) return { state: "own", dailyRemaining: 0 };
  const context = await dependencies.repository.getCreateContext(
    viewer.userId, recipientId, { topic: "连接", message: "我想聊聊校园 AI 共建的实践与想法。" }, dependencies.now(),
  );
  const dailyRemaining = Math.max(0, 5 - context.requestsInLast24Hours);
  // A later block means accepted contact access is already revoked; never surface an accepted CTA.
  if (context.blockedEitherDirection || !context.recipientPublished) return { state: "unavailable", dailyRemaining };
  if (await dependencies.repository.hasAcceptedRelationship(viewer.userId, recipientId)) return { state: "accepted", dailyRemaining };
  if (context.pendingEitherDirection) return { state: "pending", dailyRemaining };
  return { state: canCreate(context).ok ? "eligible" : "unavailable", dailyRemaining };
}
