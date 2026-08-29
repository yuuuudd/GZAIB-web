import assert from "node:assert/strict";
import test from "node:test";
import { createMemberStatusService, parseMemberStatusAction, type MemberStatusRepository } from "../../features/admin/member-status";

test("maps the four allowlisted member actions to account states with exactly one audit row", async () => {
  const rows: Parameters<MemberStatusRepository["applyStatusAtomic"]>[0][] = [];
  const service = createMemberStatusService({ applyStatusAtomic: async (input) => { rows.push(input); } }, () => "audit-1");

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
  const service = createMemberStatusService({ applyStatusAtomic: async () => undefined });
  await assert.rejects(() => service.updateMemberStatus("demo-admin", "member-1", "delete" as never, 1_000), /action/i);
});

test("member parser accepts only the action field", () => {
  assert.equal(parseMemberStatusAction({ action: "hide" }), "hide");
  assert.throws(() => parseMemberStatusAction({ action: "hide", role: "admin" }), /invalid/i);
  assert.throws(() => parseMemberStatusAction({ action: "delete" }), /invalid/i);
});
