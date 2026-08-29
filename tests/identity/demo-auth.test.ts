import assert from "node:assert/strict";
import test from "node:test";
import {
  isDemoMode,
  parseDemoLoginRequest,
  readDemoLoginRequest,
  resolveDemoIdentity,
} from "../../features/identity/demo-auth";

test("maps the only fixed demo choices to server-owned identities", () => {
  assert.deepEqual(resolveDemoIdentity("member"), {
    id: "demo-member",
    role: "member",
    displayName: "共建者 A",
  });
  assert.deepEqual(resolveDemoIdentity("admin"), {
    id: "demo-admin",
    role: "admin",
    displayName: "运营员",
  });
  assert.deepEqual(resolveDemoIdentity("peer"), {
    id: "demo-peer",
    role: "member",
    displayName: "共建者 B",
  });
  assert.throws(() => resolveDemoIdentity("demo-admin"), /identity/i);
});

test("enables demo login only when DEMO_MODE is exactly true", () => {
  assert.equal(isDemoMode({ DEMO_MODE: "true" }), true);
  assert.equal(isDemoMode({ DEMO_MODE: "TRUE" }), false);
  assert.equal(isDemoMode({}), false);
});

test("rejects client-supplied ids, roles, and unsafe return locations", () => {
  assert.throws(
    () => parseDemoLoginRequest({ identity: "member", userId: "demo-admin" }),
    /invalid/i,
  );
  assert.throws(
    () => parseDemoLoginRequest({ identity: "member", role: "admin" }),
    /invalid/i,
  );
  assert.throws(
    () => parseDemoLoginRequest({ identity: "admin", returnTo: "https://attacker.example" }),
    /return/i,
  );
  assert.throws(
    () => parseDemoLoginRequest({ identity: "admin", returnTo: "//attacker.example" }),
    /return/i,
  );
  assert.deepEqual(parseDemoLoginRequest({ identity: "admin", returnTo: "/admin?tab=review" }), {
    identity: "admin",
    returnTo: "/admin?tab=review",
  });
});

test("accepts the switcher's URL-encoded fixed identity without accepting extra fields", async () => {
  const formRequest = new Request("https://example.test/api/auth/demo-login", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: "identity=member&returnTo=%2Fme",
  });
  assert.deepEqual(await readDemoLoginRequest(formRequest), { identity: "member", returnTo: "/me" });
});
