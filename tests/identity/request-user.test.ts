import assert from "node:assert/strict";
import test from "node:test";

async function loadResolver() {
  let module: Record<string, unknown> = {};
  try {
    module = await import("../../features/identity/request-user") as Record<string, unknown>;
  } catch {
    // Assertions stay red until the shared production identity boundary exists.
  }
  assert.equal(typeof module.resolveRequestUserId, "function", "resolveRequestUserId should be exported");
  return module.resolveRequestUserId as (request: Request, dependencies: Record<string, unknown>) => Promise<string | null>;
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
