import assert from "node:assert/strict";
import test from "node:test";
import {
  ACCOUNT_DELETION_CONFIRMATION,
  createAccountDeletionService,
  handleAccountDeletionRequest,
  type AccountDeletionRepository,
  type MinimalAccountDeletionAudit,
} from "../../features/identity/account-deletion";
import { createActiveAccountBoundary, InactiveAccountError } from "../../features/identity/active-account";
import type { Session } from "../../features/identity/types";

function memoryDeletionRepository() {
  const state = {
    userStatus: "active", publishStatus: "published", applicationStatus: "pending", sessionsRevokedAt: null as number | null,
    audits: [] as MinimalAccountDeletionAudit[], batches: 0,
  };
  const repository: AccountDeletionRepository = {
    deleteAccountAtomic: async (input) => {
      state.batches += 1;
      state.userStatus = "deleted";
      state.publishStatus = "unpublished";
      state.applicationStatus = "withdrawn";
      state.sessionsRevokedAt = input.deletedAt;
      state.audits.push(input.audit);
      return { deleted: true };
    },
  };
  return { repository, state };
}

test("deletion requires the exact Chinese confirmation phrase", async () => {
  const store = memoryDeletionRepository();
  const service = createAccountDeletionService(store.repository, () => "audit-1");
  await assert.rejects(() => service.deleteOwnAccount("owner-1", "删除账号", 1_000), /confirmation/i);
  await assert.rejects(() => service.deleteOwnAccount("owner-1", `${ACCOUNT_DELETION_CONFIRMATION} `, 1_000), /confirmation/i);
  assert.equal(store.state.batches, 0);
});

test("account deletion atomically deletes, unpublishes, withdraws pending review, revokes sessions, and writes a minimal audit", async () => {
  const store = memoryDeletionRepository();
  const service = createAccountDeletionService(store.repository, () => "audit-1");
  await service.deleteOwnAccount("owner-1", ACCOUNT_DELETION_CONFIRMATION, 1_700_000_000_000);

  assert.equal(store.state.batches, 1);
  assert.equal(store.state.userStatus, "deleted");
  assert.equal(store.state.publishStatus, "unpublished");
  assert.equal(store.state.applicationStatus, "withdrawn");
  assert.equal(store.state.sessionsRevokedAt, 1_700_000_000_000);
  assert.deepEqual(store.state.audits, [{
    actorUserId: null,
    targetType: "member",
    targetId: "owner-1",
    action: "member.self_deleted",
    createdAt: 1_700_000_000_000,
    diffJson: "{}",
  }]);
});

test("active-account boundary blocks old stateless cookies after suspension or deletion", async () => {
  const session: Session = { identity: { id: "demo-member", role: "member", displayName: "演示共建者" }, expiresAt: 9_999 };
  let status = "active";
  const boundary = createActiveAccountBoundary({
    requireSignedSession: async () => session,
    getAccountStatus: async () => status,
  });
  const request = new Request("https://example.test/me");
  assert.equal((await boundary(request)).identity.id, "demo-member");
  for (status of ["suspended", "deleted"]) {
    await assert.rejects(() => boundary(request), InactiveAccountError);
  }
  for (status of ["hidden", "connection_suspended"]) {
    assert.equal((await boundary(request)).identity.id, "demo-member");
  }
});

test("account deletion HTTP boundary returns 204 and clears the current cookie", async () => {
  const deleted: { userId: string; confirmation: unknown; now: number }[] = [];
  const request = new Request("https://example.test/api/me/account", {
    method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify({ confirmation: ACCOUNT_DELETION_CONFIRMATION }),
  });
  const response = await handleAccountDeletionRequest(request, {
    requireActiveSession: async () => ({ identity: { id: "demo-member", role: "member", displayName: "演示共建者" }, expiresAt: 9_999 }),
    deleteOwnAccount: async (userId, confirmation, now) => { deleted.push({ userId, confirmation, now }); },
    now: () => 1_700_000_000_000,
  });
  assert.equal(response.status, 204);
  assert.match(response.headers.get("set-cookie") ?? "", /demo_session=;/);
  assert.match(response.headers.get("set-cookie") ?? "", /gzaib_session=;/);
  assert.match(response.headers.get("set-cookie") ?? "", /Max-Age=0/);
  assert.deepEqual(deleted, [{ userId: "demo-member", confirmation: ACCOUNT_DELETION_CONFIRMATION, now: 1_700_000_000_000 }]);
});
