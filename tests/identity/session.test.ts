import assert from "node:assert/strict";
import test from "node:test";
import {
  clearSession,
  createDemoSession,
  requireSession,
  serializeDemoSessionCookie,
  verifyDemoSession,
} from "../../features/identity/session";

const secret = "test-secret-with-at-least-thirty-two-characters";

test("demo session rejects tampering and expires after eight hours", async () => {
  const cookie = await createDemoSession("member", 1_000, secret);
  await assert.rejects(() => verifyDemoSession(`${cookie}x`, 2_000, secret), /invalid/i);
  await assert.rejects(() => verifyDemoSession(cookie, 28_801_001, secret), /expired/i);
});

test("session verification derives the fixed identity instead of trusting a role claim", async () => {
  const cookie = await createDemoSession("admin", 1_000, secret);
  assert.deepEqual(await verifyDemoSession(cookie, 2_000, secret), {
    identity: { id: "demo-admin", role: "admin", displayName: "演示运营员" },
    expiresAt: 28_801_000,
  });
});

test("session cookie is HttpOnly, Lax, scoped to the site, and production-secure", async () => {
  const session = await createDemoSession("member", 1_000, secret);
  const cookie = serializeDemoSessionCookie(session, 1_000, { production: true });
  assert.match(cookie, /^demo_session=/);
  assert.match(cookie, /HttpOnly/);
  assert.match(cookie, /SameSite=Lax/);
  assert.match(cookie, /Path=\//);
  assert.match(cookie, /Max-Age=28800/);
  assert.match(cookie, /Secure/);
});

test("requireSession reads the signed cookie and logout clears it", async () => {
  const value = await createDemoSession("member", 1_000, secret);
  const request = new Request("https://example.test/me", {
    headers: { cookie: `demo_session=${value}` },
  });
  assert.equal((await requireSession(request, 2_000, secret)).identity.id, "demo-member");

  const response = new Response(null);
  clearSession(response, { production: true });
  assert.match(response.headers.get("set-cookie") ?? "", /Max-Age=0/);
  assert.match(response.headers.get("set-cookie") ?? "", /Secure/);
});
