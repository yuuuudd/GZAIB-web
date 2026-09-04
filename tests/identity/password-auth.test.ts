import assert from "node:assert/strict";
import test from "node:test";
import { createAuthRateLimiter, createPasswordAccountRecords, handlePasswordLogin, handleRegistration } from "../../features/identity/password-auth";

function dependencies(overrides: Record<string, unknown> = {}) {
  return {
    now: () => 1_000,
    register: async () => "local:user-1",
    authenticate: async () => "local:user-1",
    startSession: async () => ({ token: "opaque-session-token", cookie: "gzaib_session=opaque-session-token; HttpOnly" }),
    limiter: createAuthRateLimiter(),
    ...overrides,
  } as never;
}

test("registration normalizes email, preserves password, creates a session, and keeps a safe return path", async () => {
  const registered: unknown[] = [];
  const request = new Request("https://site.test/api/auth/register", {
    method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ email: " Builder@Example.COM ", password: "correct horse battery", returnTo: "/me?tab=profile" }),
  });
  const response = await handleRegistration(request, dependencies({
    register: async (email: string, password: string, now: number) => { registered.push({ email, password, now }); return "local:user-1"; },
  }));
  assert.equal(response.status, 303);
  assert.equal(response.headers.get("location"), "/me?tab=profile");
  assert.match(response.headers.get("set-cookie") ?? "", /^gzaib_session=/);
  assert.deepEqual(registered, [{ email: "builder@example.com", password: "correct horse battery", now: 1_000 }]);
});

test("registration rejects role claims, oversized bodies, and external return paths", async () => {
  let registrations = 0;
  const deps = dependencies({ register: async () => { registrations += 1; return "local:user-1"; } });
  const roleClaim = await handleRegistration(new Request("https://site.test/api/auth/register", {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: "member@example.com", password: "correct horse battery", role: "admin" }),
  }), deps);
  assert.equal(roleClaim.status, 400);
  const oversized = await handleRegistration(new Request("https://site.test/api/auth/register", {
    method: "POST", headers: { "content-type": "application/json", "content-length": "9000" }, body: "{}",
  }), deps);
  assert.equal(oversized.status, 413);
  const external = await handleRegistration(new Request("https://site.test/api/auth/register", {
    method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ email: "member@example.com", password: "correct horse battery", returnTo: "//evil.test" }),
  }), deps);
  assert.equal(external.headers.get("location"), "/me");
  assert.equal(registrations, 1);
});

test("public registration records always force the member role", () => {
  const records = createPasswordAccountRecords("member@example.com", { salt: "salt", hash: "hash", iterations: 600_000 }, 1_000, "local:user-1");
  assert.equal(records.user.role, "member");
  assert.equal(records.user.id, "local:user-1");
  assert.equal(records.credential.userId, "local:user-1");
});

test("login returns one generic failure and rate-limits repeated failures by client IP", async () => {
  const limiter = createAuthRateLimiter(5, 15 * 60 * 1_000);
  const request = () => new Request("https://site.test/api/auth/login", {
    method: "POST", headers: { "content-type": "application/json", "x-forwarded-for": "203.0.113.8" },
    body: JSON.stringify({ email: "member@example.com", password: "wrong password value" }),
  });
  const deps = dependencies({ authenticate: async () => null, limiter });
  for (let index = 0; index < 5; index += 1) {
    const response = await handlePasswordLogin(request(), deps);
    assert.equal(response.status, 401);
    assert.deepEqual(await response.json(), { error: "邮箱或密码错误" });
  }
  const blocked = await handlePasswordLogin(request(), deps);
  assert.equal(blocked.status, 429);
  assert.deepEqual(await blocked.json(), { error: "尝试次数过多，请稍后再试" });
});

test("successful login clears prior failures and starts the same database session", async () => {
  const limiter = createAuthRateLimiter(1, 900_000);
  const first = dependencies({ authenticate: async () => null, limiter });
  const request = () => new Request("https://site.test/api/auth/login", {
    method: "POST", headers: { "content-type": "application/json", "x-forwarded-for": "203.0.113.9" },
    body: JSON.stringify({ email: "member@example.com", password: "correct horse battery", returnTo: "/admin" }),
  });
  assert.equal((await handlePasswordLogin(request(), first)).status, 401);
  const success = await handlePasswordLogin(request(), dependencies({ authenticate: async () => "local:user-1", limiter, now: () => 1_000 + 900_001 }));
  assert.equal(success.status, 200);
  assert.deepEqual(await success.json(), { ok: true, returnTo: "/admin" });
  assert.match(success.headers.get("set-cookie") ?? "", /^gzaib_session=/);
});
