import assert from "node:assert/strict";
import test from "node:test";
import {
  clearDatabaseSessionCookie,
  createDatabaseSession,
  resolveDatabaseSession,
  serializeDatabaseSessionCookie,
  sessionTokenHash,
} from "../../features/identity/database-session";

test("creates an opaque thirty-day session while storing only its hash", async () => {
  const created = await createDatabaseSession("local:user-1", 1_000);
  assert.notEqual(created.token, created.record.tokenHash);
  assert.equal(created.record.userId, "local:user-1");
  assert.equal(created.record.expiresAt, 1_000 + 30 * 24 * 60 * 60 * 1_000);
  assert.equal(created.record.tokenHash, await sessionTokenHash(created.token));
});

test("serializes and clears a host-wide secure database session cookie", () => {
  const cookie = serializeDatabaseSessionCookie("opaque", 1_000, { production: true });
  assert.match(cookie, /^gzaib_session=opaque;/);
  assert.match(cookie, /HttpOnly/);
  assert.match(cookie, /SameSite=Lax/);
  assert.match(cookie, /Secure/);
  assert.match(cookie, /Max-Age=2592000/);
  assert.match(clearDatabaseSessionCookie({ production: true }), /^gzaib_session=;.*Max-Age=0.*Secure/);
});

test("resolves only a live unrevoked session for an active account", async () => {
  const token = "test-session-token";
  const expectedHash = await sessionTokenHash(token);
  const request = new Request("https://site.test/me", { headers: { cookie: `other=1; gzaib_session=${token}` } });
  const base = { userId: "local:user-1", email: "member@example.com", role: "member" as const, status: "active", expiresAt: 2_000, revokedAt: null };
  const session = await resolveDatabaseSession(request, { now: () => 1_000, loadByTokenHash: async (hash) => {
    assert.equal(hash, expectedHash);
    return base;
  } });
  assert.deepEqual(session, { identity: { id: "local:user-1", role: "member", displayName: "member@example.com" }, expiresAt: 2_000 });

  for (const stored of [
    { ...base, expiresAt: 1_000 },
    { ...base, revokedAt: 999 },
    { ...base, status: "suspended" },
    { ...base, status: "deleted" },
  ]) {
    assert.equal(await resolveDatabaseSession(request, { now: () => 1_000, loadByTokenHash: async () => stored }), null);
  }
});

test("a missing or malformed database session cookie is anonymous", async () => {
  const loadByTokenHash = async () => { throw new Error("storage must not run"); };
  assert.equal(await resolveDatabaseSession(new Request("https://site.test/me"), { now: () => 1_000, loadByTokenHash }), null);
  assert.equal(await resolveDatabaseSession(new Request("https://site.test/me", { headers: { cookie: "gzaib_session=bad token" } }), { now: () => 1_000, loadByTokenHash }), null);
});
