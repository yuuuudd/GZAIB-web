import assert from "node:assert/strict";
import test from "node:test";

async function loadResolver() {
  let identityModule: Record<string, unknown> = {};
  try {
    identityModule = await import("../../features/identity/request-user") as Record<string, unknown>;
  } catch {
    // Assertions stay red until the shared production identity boundary exists.
  }
  assert.equal(typeof identityModule.resolveRequestUserId, "function", "resolveRequestUserId should be exported");
  return identityModule.resolveRequestUserId as (request: Request, dependencies: Record<string, unknown>) => Promise<string | null>;
}

async function loadRequiredSession() {
  const identity = await import("../../features/identity/request-user") as Record<string, unknown>;
  assert.equal(typeof identity.requireRequestUserSession, "function", "requireRequestUserSession should be exported");
  return identity.requireRequestUserSession as (request: Request, dependencies: Record<string, unknown>) => Promise<{ identity: { id: string } }>;
}

test("production requests use trusted ChatGPT identity and ensure a member account", async () => {
  const resolveRequestUserId = await loadResolver();
  const ensured: Array<{ id: string; email: string }> = [];
  const request = new Request("https://site.test/api/applications", { headers: {
    "oai-authenticated-user-id": "user-42",
    "oai-authenticated-user-email": "Member@Example.com",
  } });

  const userId = await resolveRequestUserId(request, {
    isDemoMode: () => false,
    requireDemoSession: async () => { throw new Error("demo session should not run"); },
    ensureChatGPTAccount: async (account: { id: string; email: string }) => { ensured.push(account); },
  });

  assert.equal(userId, "chatgpt:user-42");
  assert.deepEqual(ensured, [{ id: "chatgpt:user-42", email: "member@example.com" }]);
});

test("visitors stay anonymous while demo mode keeps its signed identity", async () => {
  const resolveRequestUserId = await loadResolver();
  const dependencies = {
    isDemoMode: () => false,
    requireDemoSession: async () => ({ identity: { id: "demo-member" } }),
    ensureChatGPTAccount: async () => undefined,
  };
  assert.equal(await resolveRequestUserId(new Request("https://site.test/"), dependencies), null);
  assert.equal(await resolveRequestUserId(new Request("https://site.test/"), { ...dependencies, isDemoMode: () => true }), "demo-member");
});

test("required member identity accepts trusted production headers", async () => {
  const requireRequestUserSession = await loadRequiredSession();
  const session = await requireRequestUserSession(new Request("https://site.test/me", { headers: {
    "oai-authenticated-user-id": "user-42",
    "oai-authenticated-user-email": "member@example.com",
  } }), {
    isDemoMode: () => false,
    requireDemoSession: async () => null,
    ensureChatGPTAccount: async () => undefined,
  });

  assert.equal(session.identity.id, "chatgpt:user-42");
});

test("required member identity rejects an anonymous visitor", async () => {
  const requireRequestUserSession = await loadRequiredSession();
  await assert.rejects(() => requireRequestUserSession(new Request("https://site.test/me"), {
    isDemoMode: () => false,
    requireDemoSession: async () => null,
    ensureChatGPTAccount: async () => undefined,
  }));
});

test("production requests prefer a valid local database session over hosting headers", async () => {
  const requireRequestUserSession = await loadRequiredSession();
  let hostingEnsures = 0;
  const session = await requireRequestUserSession(new Request("https://site.test/me", { headers: {
    "oai-authenticated-user-id": "host-user",
    "oai-authenticated-user-email": "host@example.com",
  } }), {
    isDemoMode: () => false,
    requireDemoSession: async () => null,
    resolveDatabaseSession: async () => ({ identity: { id: "local:user-1", role: "member", displayName: "member@example.com" }, expiresAt: 9_999 }),
    ensureChatGPTAccount: async () => { hostingEnsures += 1; },
  });
  assert.equal(session.identity.id, "local:user-1");
  assert.equal(hostingEnsures, 0);
});
