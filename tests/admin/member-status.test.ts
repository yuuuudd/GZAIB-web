import assert from "node:assert/strict";
import test from "node:test";
import { createMemberStatusService, memberTransitionForSafetyResolution, parseMemberStatusAction, type MemberStatusRepository } from "../../features/admin/member-status";

test("maps the four allowlisted member actions to account states with exactly one audit row", async () => {
  const rows: Parameters<MemberStatusRepository["applyStatusAtomic"]>[0][] = [];
  const service = createMemberStatusService({
    applyStatusAtomic: async (input) => { rows.push(input); },
    deleteAccountAtomic: async () => ({ deleted: true }),
  }, () => "audit-1");

  for (const [action, status, audit] of [
    ["hide", "hidden", "member.hidden"],
    ["restore", "active", "member.restored"],
    ["suspend_connections", "connection_suspended", "member.connections_suspended"],
    ["suspend_account", "suspended", "member.account_suspended"],
  ] as const) {
    await service.updateMemberStatus("demo-admin", "member-1", action, 1_000);
    const row = rows.at(-1);
    assert.equal(row?.status, status);
    assert.equal(row?.audit.action, audit);
  }
  assert.equal(rows.length, 4);
});

test("rejects client decisions outside the member action enum", async () => {
  const service = createMemberStatusService({
    applyStatusAtomic: async () => undefined,
    deleteAccountAtomic: async () => ({ deleted: true }),
  });
  await assert.rejects(() => service.updateMemberStatus("demo-admin", "member-1", "erase" as never, 1_000), /action/i);
});

test("admin deletion uses the account cleanup path and records the operator", async () => {
  const deletions: unknown[] = [];
  const service = createMemberStatusService({
    applyStatusAtomic: async () => undefined,
    deleteAccountAtomic: async (input: unknown) => { deletions.push(input); return { deleted: true }; },
  } as MemberStatusRepository, () => "audit-delete");

  const result = await service.updateMemberStatus("demo-admin", "member-1", "delete" as never, 1_000);

  assert.deepEqual(result, { memberId: "member-1", status: "deleted" });
  assert.deepEqual(deletions, [{
    userId: "member-1",
    deletedAt: 1_000,
    auditId: "audit-delete",
    audit: {
      actorUserId: "demo-admin",
      targetType: "member",
      targetId: "member-1",
      action: "member.deleted",
      diffJson: "{}",
      createdAt: 1_000,
    },
  }]);
});

test("member parser accepts only the action field", () => {
  assert.equal(parseMemberStatusAction({ action: "hide" }), "hide");
  assert.equal(parseMemberStatusAction({ action: "delete" }), "delete");
  assert.throws(() => parseMemberStatusAction({ action: "hide", role: "admin" }), /invalid/i);
  assert.throws(() => parseMemberStatusAction({ action: "erase" }), /invalid/i);
});

test("safety sanctions reuse the canonical member transition vocabulary", () => {
  assert.deepEqual(memberTransitionForSafetyResolution("hide_profile"), { status: "hidden", audit: "member.hidden" });
  assert.deepEqual(memberTransitionForSafetyResolution("suspend_connections"), { status: "connection_suspended", audit: "member.connections_suspended" });
  assert.deepEqual(memberTransitionForSafetyResolution("suspend_account"), { status: "suspended", audit: "member.account_suspended" });
  assert.equal(memberTransitionForSafetyResolution("warn"), undefined);
});
