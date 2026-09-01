import assert from "node:assert/strict";
import test from "node:test";
import { handleActivityProposal } from "../../app/api/activity-proposals/route";

const body = {
  title: "校园 AI 共创工作坊",
  summary: "邀请不同专业的同学一起完成一个可演示的 AI 应用原型。",
  stage: "idea",
  links: [],
  contactEmail: "attacker@example.test",
};

test("activity proposal route fixes ownership and contact to the authenticated account", async () => {
  let saved: { userId: string; title: string } | undefined;
  const response = await handleActivityProposal(new Request("https://site.test/api/activity-proposals", {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body),
  }), {
    resolveUserId: async () => "member-1",
    save: async (input) => { saved = { userId: input.userId, title: input.title }; return { id: "proposal-1", status: "pending" }; },
    now: () => 100,
    id: () => "proposal-1",
  });

  assert.equal(response.status, 201);
  assert.deepEqual(saved, { userId: "member-1", title: "校园 AI 共创工作坊" });
  assert.doesNotMatch(JSON.stringify(saved), /attacker@example\.test/);
});

test("activity proposal route requires an authenticated account", async () => {
  const response = await handleActivityProposal(new Request("https://site.test/api/activity-proposals", {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body),
  }), {
    resolveUserId: async () => null,
    save: async () => { throw new Error("must not save"); },
    now: () => 100,
    id: () => "proposal-1",
  });

  assert.equal(response.status, 401);
});
