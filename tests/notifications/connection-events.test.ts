import assert from "node:assert/strict";
import test from "node:test";
import { toConnectionNotification } from "../../features/notifications/connection-events";
import { createResendConnectionEmailSender } from "../../features/notifications/resend";
import type { ConnectionNotificationEvent } from "../../features/notifications/types";

const now = 1_700_000_000_000;

function event(type: ConnectionNotificationEvent["type"]): ConnectionNotificationEvent {
  return {
    type,
    userId: type === "connection_received" || type === "connection_withdrawn" ? "recipient-1" : "sender-1",
    requestId: "request-1",
    peerName: "林同学",
    topic: "AI 产品共创",
    createdAt: now,
  };
}

test("maps every connection event to its recipient-safe inbox copy", () => {
  assert.deepEqual(toConnectionNotification(event("connection_received")), {
    userId: "recipient-1",
    type: "connection_received",
    title: "你收到一条新的连接请求",
    body: "林同学想和你聊聊：AI 产品共创",
    href: "/me/connections?box=received",
    dedupeKey: "connection:request-1:pending",
  });
  assert.deepEqual(toConnectionNotification(event("connection_accepted")), {
    userId: "sender-1",
    type: "connection_accepted",
    title: "你的连接请求已被接受",
    body: "林同学接受了你的连接请求：AI 产品共创",
    href: "/me/connections?box=accepted",
    dedupeKey: "connection:request-1:accepted",
  });
  assert.deepEqual(toConnectionNotification(event("connection_declined")), {
    userId: "sender-1",
    type: "connection_declined",
    title: "你的连接请求未被接受",
    body: "林同学婉拒了你的连接请求",
    href: "/me/connections?box=sent",
    dedupeKey: "connection:request-1:declined",
  });
  assert.deepEqual(toConnectionNotification(event("connection_withdrawn")), {
    userId: "recipient-1",
    type: "connection_withdrawn",
    title: "一条连接请求已被撤回",
    body: "林同学撤回了连接请求",
    href: "/me/connections?box=received",
    dedupeKey: "connection:request-1:withdrawn",
  });
});

test("connection email contains only safe inbox copy and an authenticated-site link", async () => {
  let request: Request | undefined;
  const sender = createResendConnectionEmailSender({
    apiKey: "test-key",
    from: "Demo <noreply@example.test>",
    siteUrl: "https://demo.example.test",
    fetch: async (input) => {
      request = input as Request;
      return new Response("{}", { status: 200 });
    },
  });

  const result = await sender?.send({ to: "member@example.test", event: event("connection_received") });

  assert.deepEqual(result, { status: "sent" });
  assert.equal(request?.url, "https://api.resend.com/emails");
  const payload = await request?.json() as Record<string, unknown>;
  assert.equal(payload.subject, "你收到一条新的连接请求");
  assert.match(String(payload.text), /https:\/\/demo\.example\.test\/me\/connections\?box=received/);
  assert.doesNotMatch(`${payload.subject}\n${payload.text}`, /wechat|contactCard|微信号|member@example\.test/);
});

test("missing Resend configuration skips delivery while 429 and 400 failures are contained", async () => {
  assert.equal(createResendConnectionEmailSender({}), undefined);
  assert.equal(createResendConnectionEmailSender({
    apiKey: "test-key", from: "not-an-email", siteUrl: "https://demo.example.test",
  }), undefined);
  assert.equal(createResendConnectionEmailSender({
    apiKey: "test-key", from: "Demo <noreply@example.test>", siteUrl: "http://demo.example.test",
  }), undefined);
  for (const status of [429, 400]) {
    const sender = createResendConnectionEmailSender({
      apiKey: "test-key", from: "Demo <noreply@example.test>", siteUrl: "https://demo.example.test",
      fetch: async () => new Response("ignored", { status }),
    });
    assert.deepEqual(await sender?.send({ to: "member@example.test", event: event("connection_accepted") }), {
      status: "failed", reason: `resend_status_${status}`,
    });
  }
});
