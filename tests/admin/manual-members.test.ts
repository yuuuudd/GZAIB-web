import assert from "node:assert/strict";
import test from "node:test";
import { createManualMemberService, type ManualMemberRepository } from "../../features/admin/manual-members";

function input(overrides: Record<string, unknown> = {}) {
  return {
    nickname: "Map Builder", schoolId: "confirmed-school", intro: "Builds practical AI projects with local student communities.",
    skills: ["AI应用"], interests: ["校园共建"], roles: ["活动共建者"], workLinks: [], publication: "draft",
    ...overrides,
  };
}

function repository(confirmed = new Set(["confirmed-school"])) {
  const writes: Parameters<ManualMemberRepository["createAtomic"]>[0][] = [];
  const repo: ManualMemberRepository = {
    isSchoolConfirmed: async (schoolId) => confirmed.has(schoolId),
    createAtomic: async (record) => { writes.push(record); },
  };
  return { repo, writes };
}

test("stores a manually entered member as an unpublished managed profile with default private optional fields", async () => {
  const store = repository();
  const service = createManualMemberService(store.repo, () => "member-1", () => "profile-1", () => "audit-1");
  const created = await service.create(input(), "chatgpt:operator", 1_000);

  assert.equal(created.profile.publishStatus, "unpublished");
  assert.equal(created.profile.adminManaged, true);
  assert.equal(created.visibility.currentFocus, "private");
  assert.equal(store.writes.length, 1);
  assert.equal(store.writes[0]?.audit.action, "member.manually_created_draft");
});

test("publishes a manually entered member only through a confirmed school and writes an audit record", async () => {
  const store = repository();
  const service = createManualMemberService(store.repo, () => "member-1", () => "profile-1", () => "audit-1");
  const created = await service.create(input({ publication: "publish" }), "chatgpt:operator", 1_000);

  assert.equal(created.profile.publishStatus, "published");
  assert.equal(store.writes[0]?.audit.action, "member.manually_created_published");
});

test("rejects an attempted publication through an unconfirmed school before any write", async () => {
  const store = repository();
  const service = createManualMemberService(store.repo);
  await assert.rejects(() => service.create(input({ publication: "publish", schoolId: "suggested-school" }), "chatgpt:operator", 1_000), /school/i);
  assert.equal(store.writes.length, 0);
});
