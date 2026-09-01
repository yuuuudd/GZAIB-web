import assert from "node:assert/strict";
import test from "node:test";
import {
  handleCommunityAdminReview,
  type CommunityAdminRouteDependencies,
} from "../../app/api/admin/communities/[kind]/[id]/route";
import { CommunityAdminError, type CommunityAdminService } from "../../features/admin/communities";
import type { Session } from "../../features/identity/types";

const NOW = 1_780_000_000_000;
const adminSession: Session = { identity: { id: "demo-admin", role: "admin", displayName: "演示运营员" }, expiresAt: NOW + 1 };
const memberSession: Session = { identity: { id: "demo-member", role: "member", displayName: "演示成员" }, expiresAt: NOW + 1 };

function request(body: unknown, headers: HeadersInit = {}) {
  return new Request("https://site.test/api/admin/communities/profile/submission-1", {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

function context(kind = "profile", id = "submission-1") {
  return { params: Promise.resolve({ kind, id }) };
}

function dependencies(options: {
  session?: Session;
  requireSession?: () => Promise<Session>;
  review?: CommunityAdminService["review"];
  demo?: boolean;
} = {}): CommunityAdminRouteDependencies {
  const defaultReview: CommunityAdminService["review"] = async (_adminId, kind, id, action) => ({
    kind,
    id,
    status: action.decision === "approve" ? kind === "update" ? "published" : "approved"
      : action.decision === "reject" ? "rejected" : "changes_requested",
  });
  return {
    isDemoMode: () => options.demo ?? true,
    requireSession: options.requireSession ?? (async () => options.session ?? adminSession),
    adminEmails: () => "operator@example.test",
    ensureAdminAccount: async () => {},
    service: async () => ({ review: options.review ?? defaultReview }),
    now: () => NOW,
  };
}

test("community review route authorizes before parsing and keeps the existing 403 admin contract", async () => {
  let serviceCalls = 0;
  const review: CommunityAdminService["review"] = async () => { serviceCalls += 1; throw new Error("must not run"); };
  const malformed = request("{");

  const member = await handleCommunityAdminReview(malformed, context(), dependencies({ session: memberSession, review }));
  const anonymous = await handleCommunityAdminReview(request("{"), context(), dependencies({ requireSession: async () => { throw new Error("No session"); }, review }));

  assert.equal(member.status, 403);
  assert.deepEqual(await member.json(), { error: "Forbidden" });
  assert.equal(anonymous.status, 403);
  assert.deepEqual(await anonymous.json(), { error: "Forbidden" });
  assert.equal(serviceCalls, 0);
  assert.equal(member.headers.get("cache-control"), "private, no-store");
});

test("allowlisted production administrator reaches review with only header-derived identity and server time", async () => {
  const calls: unknown[][] = [];
  const response = await handleCommunityAdminReview(
    request({ decision: "approve" }, {
      "oai-authenticated-user-id": "operator-1",
      "oai-authenticated-user-email": "Operator@Example.test",
    }),
    context("claim", "claim-1"),
    dependencies({
      demo: false,
      review: async (...args) => {
        calls.push(args);
        return { kind: "claim", id: "claim-1", status: "approved" };
      },
    }),
  );

  assert.equal(response.status, 200);
  assert.deepEqual(calls, [["chatgpt:operator-1", "claim", "claim-1", { decision: "approve" }, NOW]]);
  assert.deepEqual(await response.json(), { review: { kind: "claim", id: "claim-1", status: "approved" } });
  assert.equal(response.headers.get("cache-control"), "private, no-store");
});

test("route rejects unknown kinds, empty or oversized ids, and client-controlled review fields", async () => {
  let serviceCalls = 0;
  const deps = dependencies({ review: async () => { serviceCalls += 1; throw new Error("must not run"); } });

  for (const [target, body] of [
    [context("archive", "submission-1"), { decision: "approve" }],
    [context("profile", ""), { decision: "approve" }],
    [context("profile", "x".repeat(161)), { decision: "approve" }],
    [context("profile", ` ${"x".repeat(160)} `), { decision: "approve" }],
    [context("profile", " submission-1 "), { decision: "approve" }],
    [context("profile", "submission-1"), { decision: "approve", reviewerId: "demo-admin" }],
    [context("profile", "submission-1"), { decision: "approve", status: "approved", name: "覆盖公开资料" }],
  ] as const) {
    const response = await handleCommunityAdminReview(request(body), target, deps);
    assert.equal(response.status, 400);
    assert.deepEqual(await response.json(), { error: "审核操作无效" });
  }
  assert.equal(serviceCalls, 0);
});

test("route maps atomic state loss to 409 and never exposes private evidence or internal errors", async () => {
  const conflict = await handleCommunityAdminReview(
    request({ decision: "reject", reason: "无法核验" }),
    context("claim", "claim-1"),
    dependencies({ review: async () => { throw new CommunityAdminError("state_changed", "审核状态已变化"); } }),
  );
  assert.equal(conflict.status, 409);
  assert.deepEqual(await conflict.json(), { error: "审核状态已变化，请刷新后重试" });

  const originalError = console.error;
  const logs: unknown[][] = [];
  console.error = (...values: unknown[]) => { logs.push(values); };
  try {
    const failed = await handleCommunityAdminReview(
      request({ decision: "approve" }),
      context("claim", "claim-1"),
      dependencies({ review: async () => { throw new Error("secret-evidence reviewer=demo-admin member-1"); } }),
    );
    assert.equal(failed.status, 500);
    const exposed = `${JSON.stringify(await failed.json())} ${JSON.stringify(logs)}`;
    assert.doesNotMatch(exposed, /secret-evidence|reviewer|demo-admin|member-1/);
  } finally {
    console.error = originalError;
  }
});
