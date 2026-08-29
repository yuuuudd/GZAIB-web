import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { ContactCardEditor } from "../../components/connections/ContactCardEditor";
import {
  ContactCardCryptoError,
  ContactCardValidationError,
  createContactCardService,
  createOwnContactCardHandler,
  decryptContactCard,
  encryptContactCard,
  requireContactEncryptionKey,
  validateContactCard,
  type ContactCardRepository,
} from "../../features/connections/contact-card";

const key = Buffer.alloc(32, 7).toString("base64");
const card = { wechat: "guangzhou-ai", email: " HELLO@EXAMPLE.COM ", otherLabel: "作品集", otherValue: "https://example.com/hello" };

function memoryRepository() {
  let encryptedPayload: string | undefined;
  let accepted = false;
  let blocked = false;
  const active = true;
  const repository: ContactCardRepository = {
    save: async (_userId, payload) => { encryptedPayload = payload; },
    get: async () => encryptedPayload ? { encryptedPayload, updatedAt: 1 } : undefined,
    getAccess: async () => ({ accepted, blocked, viewerCanAccessContacts: active, ownerCanAccessContacts: active }),
  };
  return {
    repository,
    accept() { accepted = true; },
    block() { blocked = true; },
    get payload() { return encryptedPayload; },
  };
}

test("contact-card encryption round-trips normalized data with a fresh IV", async () => {
  const expected = { wechat: "guangzhou-ai", email: "hello@example.com", otherLabel: "作品集", otherValue: "https://example.com/hello" };
  const first = await encryptContactCard("u1", expected, key);
  const second = await encryptContactCard("u1", expected, key);

  assert.match(first, /^v1\.[A-Za-z0-9_-]{16}\.[A-Za-z0-9_-]+$/);
  assert.notEqual(first, second);
  assert.deepEqual(await decryptContactCard("u1", first, key), expected);
});

test("contact-card encryption rejects a wrong owner, key, version, and tampering without disclosing contents", async () => {
  const payload = await encryptContactCard("u1", { wechat: "guangzhou-ai" }, key);
  const otherKey = Buffer.alloc(32, 8).toString("base64");
  const tampered = `${payload.slice(0, -1)}${payload.endsWith("A") ? "B" : "A"}`;

  for (const attempt of [
    () => decryptContactCard("u2", payload, key),
    () => decryptContactCard("u1", payload, otherKey),
    () => decryptContactCard("u1", payload.replace(/^v1\./, "v2."), key),
    () => decryptContactCard("u1", tampered, key),
  ]) {
    await assert.rejects(attempt, (error: unknown) => error instanceof ContactCardCryptoError && error.message === "Contact card unavailable");
  }
});

test("contact-card key configuration accepts exactly thirty-two decoded bytes", () => {
  assert.equal(requireContactEncryptionKey(key).byteLength, 32);
  assert.throws(() => requireContactEncryptionKey(Buffer.alloc(31).toString("base64")), /CONTACT_ENCRYPTION_KEY/);
  assert.throws(() => requireContactEncryptionKey("not-base64"), /CONTACT_ENCRYPTION_KEY/);
});

test("contact-card validation allowlists and normalizes declared channels", () => {
  assert.deepEqual(validateContactCard(card), {
    wechat: "guangzhou-ai", email: "hello@example.com", otherLabel: "作品集", otherValue: "https://example.com/hello",
  });
  for (const invalid of [
    {}, { wechat: " " }, { email: "not-an-email" }, { otherLabel: "备用", otherValue: " " },
    { wechat: "valid-id", ignored: "private" }, { wechat: " x " },
  ]) {
    assert.throws(() => validateContactCard(invalid), ContactCardValidationError);
  }
});

test("contact-card visibility requires accepted consent and is revoked immediately by a block", async () => {
  const store = memoryRepository();
  const service = createContactCardService(store.repository, key);
  await service.saveOwnCard("u1", { wechat: "guangzhou-ai" }, 1);

  assert.equal(await service.getVisibleContactCard("u2", "u1"), undefined);
  store.accept();
  assert.deepEqual(await service.getVisibleContactCard("u2", "u1"), { wechat: "guangzhou-ai" });
  store.block();
  assert.equal(await service.getVisibleContactCard("u2", "u1"), undefined);
});

test("an owner can read their current contact card without an accepted relationship", async () => {
  const store = memoryRepository();
  const service = createContactCardService(store.repository, key);
  await service.saveOwnCard("u1", { email: "owner@example.com" }, 1);

  assert.deepEqual(await service.getVisibleContactCard("u1", "u1"), { email: "owner@example.com" });
  assert.ok(store.payload?.startsWith("v1."));
});

test("owner contact route ignores client ownership and reveals plaintext only on explicit settings access", async () => {
  const store = memoryRepository();
  const service = createContactCardService(store.repository, key);
  const handler = createOwnContactCardHandler({
    requireSession: async () => ({ identity: { id: "u1" } }),
    service,
    now: () => 2,
  });

  const saved = await handler.PUT(new Request("https://demo.local/api/me/contact-card", {
    method: "PUT", headers: { "content-type": "application/json" },
    body: JSON.stringify({ userId: "u2", wechat: "guangzhou-ai" }),
  }));
  assert.equal(saved.status, 400);

  await handler.PUT(new Request("https://demo.local/api/me/contact-card", {
    method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ wechat: "guangzhou-ai" }),
  }));
  const normal = await handler.GET(new Request("https://demo.local/api/me/contact-card"));
  assert.deepEqual(await normal.json(), { configured: true });
  const reveal = await handler.GET(new Request("https://demo.local/api/me/contact-card?reveal=1"));
  assert.deepEqual(await reveal.json(), { configured: true, card: { wechat: "guangzhou-ai" } });
  assert.equal(reveal.headers.get("Cache-Control"), "private, no-store");
});

test("a normal contact-card GET reports configuration without decrypting plaintext", async () => {
  const handler = createOwnContactCardHandler({
    requireSession: async () => ({ identity: { id: "u1" } }),
    service: {
      hasOwnCard: async () => true,
      getOwnCard: async () => { throw new Error("normal GET must not decrypt"); },
      getVisibleContactCard: async () => undefined,
      saveOwnCard: async () => undefined,
    } as ReturnType<typeof createContactCardService>,
    now: () => 2,
  });
  const response = await handler.GET(new Request("https://demo.local/api/me/contact-card"));
  assert.deepEqual(await response.json(), { configured: true });
});

test("contact-card editor makes consent boundaries clear without exposing encryption configuration", () => {
  const html = renderToStaticMarkup(createElement(ContactCardEditor, { initialCard: { wechat: "guangzhou-ai" } }));
  assert.match(html, /微信/);
  assert.match(html, /仅在双方接受连接后/);
  assert.match(html, /不会出现在地图、搜索结果或连接请求正文/);
  assert.doesNotMatch(html, /CONTACT_ENCRYPTION_KEY|AES-GCM|base64/);
});
