import assert from "node:assert/strict";
import test from "node:test";
import { canCreate, normalizeConnectionInput } from "../../features/connections/policy";
import type { ConnectionPolicyContext } from "../../features/connections/types";

const base: ConnectionPolicyContext = {
  senderId: "member-1",
  recipientId: "member-2",
  senderStatus: "active",
  recipientPublished: true,
  blockedEitherDirection: false,
  pendingEitherDirection: false,
  requestsInLast24Hours: 0,
  topic: "AI product collaboration",
  message: "I would like to compare notes on a campus AI product workshop.",
};

test("rejects a request sent to the same member", () => {
  assert.deepEqual(canCreate({ ...base, recipientId: "member-1" }), { ok: false, code: "self_request" });
});

test("allows only active members to initiate a connection", () => {
  for (const senderStatus of ["connection_suspended", "hidden", "suspended", "deleted"]) {
    assert.deepEqual(canCreate({ ...base, senderStatus }), { ok: false, code: "sender_ineligible" });
  }
});

test("rejects a recipient whose approved profile is not published", () => {
  assert.deepEqual(canCreate({ ...base, recipientPublished: false }), { ok: false, code: "recipient_unavailable" });
});

test("rejects blocks and pending requests in either direction", () => {
  assert.deepEqual(canCreate({ ...base, blockedEitherDirection: true }), { ok: false, code: "blocked" });
  assert.deepEqual(canCreate({ ...base, pendingEitherDirection: true }), { ok: false, code: "duplicate_pending" });
});

test("caps all newly created requests at five in the rolling twenty-four-hour window", () => {
  assert.deepEqual(canCreate({ ...base, requestsInLast24Hours: 5 }), { ok: false, code: "daily_limit" });
});

test("normalizes whitespace and accepts the inclusive message and topic boundaries", () => {
  const message = `  ${"m".repeat(20)}\n\n`;
  assert.deepEqual(normalizeConnectionInput({ topic: "  AI\t", message }), { topic: "AI", message: "m".repeat(20) });
  assert.deepEqual(canCreate({ ...base, topic: "t".repeat(30), message: "m".repeat(500) }), { ok: true });
});

test("rejects invalid topic or message sizes after whitespace normalization", () => {
  for (const input of [
    { topic: "A", message: "m".repeat(20) },
    { topic: "t".repeat(31), message: "m".repeat(20) },
    { topic: "AI", message: "m".repeat(19) },
    { topic: "AI", message: "m".repeat(501) },
  ]) {
    assert.deepEqual(canCreate({ ...base, ...input }), { ok: false, code: "invalid_message" });
  }
});

test("rejects obvious email, phone, and WeChat disclosures in a request body", () => {
  for (const message of [
    "Please email me at builder@example.test so we can coordinate safely.",
    "You can call me on 138 0013 8000 after the workshop finishes.",
    "My WeChat is campus_builder_2026; please add me there.",
  ]) {
    assert.deepEqual(canCreate({ ...base, message }), { ok: false, code: "invalid_message" });
  }
});

test("permits an eligible request without a contact disclosure", () => {
  assert.deepEqual(canCreate(base), { ok: true });
});
