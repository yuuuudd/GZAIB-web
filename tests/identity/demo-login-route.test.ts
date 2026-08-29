import assert from "node:assert/strict";
import test from "node:test";
import { handleDemoLogin } from "../../features/identity/demo-login";

const validLogin = () => new Request("https://example.test/api/auth/demo-login", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ identity: "member" }),
});

const dependencies = (overrides: Partial<Parameters<typeof handleDemoLogin>[1]> = {}) => ({
  isDemoMode: () => true,
  now: () => 1_000,
  ensureIdentity: async () => undefined,
  createSession: async () => "signed-session",
  serializeCookie: () => "demo_session=signed-session; HttpOnly",
  reportInternalFailure: () => undefined,
  ...overrides,
});

test("demo login returns 400 only for invalid request input", async () => {
  const response = await handleDemoLogin(new Request("https://example.test/api/auth/demo-login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: "not-json",
  }), dependencies({
    ensureIdentity: async () => { throw new Error("database should not run for invalid input"); },
  }));

  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), { error: "Invalid demo login request" });
});

test("demo login hides signing-configuration failures behind a generic 500", async () => {
  const response = await handleDemoLogin(validLogin(), dependencies({
    createSession: async () => { throw new Error("DEMO_SESSION_SECRET must be at least 32 characters"); },
  }));

  assert.equal(response.status, 500);
  assert.deepEqual(await response.json(), { error: "Unable to start demo session" });
});

test("demo login hides D1 failures behind a generic 500", async () => {
  const response = await handleDemoLogin(validLogin(), dependencies({
    ensureIdentity: async () => { throw new Error("Cloudflare D1 binding DB is unavailable"); },
  }));

  assert.equal(response.status, 500);
  assert.deepEqual(await response.json(), { error: "Unable to start demo session" });
});
