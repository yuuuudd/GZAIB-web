import type { ConnectionPolicyContext, CreateConnectionInput, PolicyResult } from "./types";

const MESSAGE_MIN_LENGTH = 20;
const MESSAGE_MAX_LENGTH = 500;
const TOPIC_MIN_LENGTH = 2;
const TOPIC_MAX_LENGTH = 60;

const EMAIL_PATTERN = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i;
const PHONE_PATTERN = /(?<!\d)(?:\+?86[\s.-]?)?\(?1[3-9]\d\)?[\s.-]?\d{4}[\s.-]?\d{4}(?!\d)/;
const WECHAT_PATTERN = /(?:微信|\b(?:wechat|weixin|vx)\b)\s*(?:(?:号|id|是|为|is)(?:\s*[:：=@])?|[:：=@])\s*[@a-z0-9][a-z0-9_-]{3,}/i;

export function normalizeConnectionInput(input: Pick<CreateConnectionInput, "topic" | "message">): Pick<CreateConnectionInput, "topic" | "message"> {
  return {
    topic: input.topic.normalize("NFKC").replace(/\s+/g, " ").trim(),
    message: input.message.normalize("NFKC").replace(/\s+/g, " ").trim(),
  };
}

function containsContactDisclosure(message: string): boolean {
  return EMAIL_PATTERN.test(message) || PHONE_PATTERN.test(message) || WECHAT_PATTERN.test(message);
}

/** Determines the first deterministic policy failure without exposing request body contents. */
export function canCreate(context: ConnectionPolicyContext): PolicyResult {
  if (context.senderId === context.recipientId) return { ok: false, code: "self_request" };
  if (context.senderStatus !== "active" || !context.senderApproved || !context.senderPublished) {
    return { ok: false, code: "sender_ineligible" };
  }
  if (!context.recipientPublished) return { ok: false, code: "recipient_unavailable" };
  if (context.blockedEitherDirection) return { ok: false, code: "blocked" };
  if (context.pendingEitherDirection) return { ok: false, code: "duplicate_pending" };
  if (context.requestsInLast24Hours >= 5) return { ok: false, code: "daily_limit" };

  const normalized = normalizeConnectionInput(context);
  if (normalized.topic.length < TOPIC_MIN_LENGTH || normalized.topic.length > TOPIC_MAX_LENGTH
    || normalized.message.length < MESSAGE_MIN_LENGTH || normalized.message.length > MESSAGE_MAX_LENGTH
    || containsContactDisclosure(normalized.message)) return { ok: false, code: "invalid_message" };

  return { ok: true };
}
