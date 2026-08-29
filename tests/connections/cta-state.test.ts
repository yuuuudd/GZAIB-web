import assert from "node:assert/strict";
import test from "node:test";
import { resolveConnectionCtaState } from "../../features/connections/cta-state";

const context = (overrides: Record<string, unknown> = {}) => ({
  senderId: "demo-member", recipientId: "demo-peer", senderStatus: "active", senderIsMember: true, senderApproved: true, senderPublished: true,
  recipientIsMember: true, recipientPublished: true, blockedEitherDirection: false, pendingEitherDirection: false, requestsInLast24Hours: 2,
  topic: "连接", message: "我想聊聊校园 AI 共建的实践与想法。", ...overrides,
});

function dependencies(overrides: Partial<Parameters<typeof resolveConnectionCtaState>[2]> = {}) {
  return {
    resolveRecipientId: async () => "demo-peer",
    repository: {
      hasAcceptedRelationship: async () => false,
      getCreateContext: async () => context(),
    },
    now: () => 1_700_000_000_000,
    ...overrides,
  };
}

test("blocked state takes precedence over an older accepted connection", async () => {
  const result = await resolveConnectionCtaState({ kind: "member", userId: "demo-member" }, "peer", dependencies({
    repository: { hasAcceptedRelationship: async () => true, getCreateContext: async () => context({ blockedEitherDirection: true }) },
  }));
  assert.deepEqual(result, { state: "unavailable", dailyRemaining: 3 });
});

test("normal accepted and pending pairs retain their server-derived CTA states", async () => {
  const accepted = await resolveConnectionCtaState({ kind: "member", userId: "demo-member" }, "peer", dependencies({
    repository: { hasAcceptedRelationship: async () => true, getCreateContext: async () => context() },
  }));
  const pending = await resolveConnectionCtaState({ kind: "member", userId: "demo-member" }, "peer", dependencies({
    repository: { hasAcceptedRelationship: async () => false, getCreateContext: async () => context({ pendingEitherDirection: true }) },
  }));
  assert.deepEqual(accepted, { state: "accepted", dailyRemaining: 3 });
  assert.deepEqual(pending, { state: "pending", dailyRemaining: 3 });
});
