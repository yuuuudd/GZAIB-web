import assert from "node:assert/strict";
import test from "node:test";
import { createApplicationService } from "../../features/applications/service";
import { CONSENT_VERSION } from "../../features/applications/validation";
import type { ApplicationRecord } from "../../features/applications/types";

const input = {
  nickname: "林同学",
  schoolId: "school-1",
  intro: "正在探索 AI 如何帮助校园里的真实协作。",
  skills: ["产品设计"],
  interests: ["教育创新"],
  roles: ["活动共建者"],
  workLinks: [],
  visibility: {},
  consentAccepted: true,
  consentVersion: CONSENT_VERSION,
};

function repository(existing?: ApplicationRecord, schoolConfirmed = true) {
  let saved: ApplicationRecord | undefined;
  return {
    get saved() { return saved; },
    getApplicationByUserId: async () => existing,
    isSchoolConfirmed: async () => schoolConfirmed,
    saveApplication: async (record: ApplicationRecord) => { saved = record; },
    reviewApplication: async () => undefined,
  };
}

test("submits with server-owned owner, pending status, and recorded consent", async () => {
  const store = repository();
  const service = createApplicationService(store, () => "application-1");
  const submitted = await service.submitApplication("demo-member", { ...input, userId: "attacker", status: "approved" } as never, 1_000);

  assert.equal(submitted.status, "pending");
  assert.equal(submitted.userId, "demo-member");
  assert.equal(submitted.consentVersion, CONSENT_VERSION);
  assert.equal(submitted.consentAcceptedAt, 1_000);
  assert.equal(store.saved?.status, "pending");
});

test("does not submit an application for an unconfirmed school", async () => {
  const store = repository(undefined, false);
  const service = createApplicationService(store, () => "application-1");

  await assert.rejects(() => service.submitApplication("demo-member", input, 1_000));
  assert.equal(store.saved, undefined);
});

test("only lets an applicant resubmit draft or changes-requested records", async () => {
  const existing: ApplicationRecord = {
    id: "application-1", userId: "demo-member", status: "changes_requested", ...input,
    consentVersion: CONSENT_VERSION, consentAcceptedAt: 1, submittedAt: 1, createdAt: 1, updatedAt: 1,
  };
  const store = repository(existing);
  const service = createApplicationService(store, () => "new-id");

  const resubmitted = await service.submitApplication("demo-member", input, 2_000);
  assert.equal(resubmitted.id, "application-1");
  assert.equal(resubmitted.status, "pending");
  assert.equal(resubmitted.createdAt, 1);
});

test("withdraws only a pending application", async () => {
  const existing: ApplicationRecord = {
    id: "application-1", userId: "demo-member", status: "pending", ...input,
    consentVersion: CONSENT_VERSION, consentAcceptedAt: 1, submittedAt: 1, createdAt: 1, updatedAt: 1,
  };
  const store = repository(existing);
  const service = createApplicationService(store, () => "new-id");

  const withdrawn = await service.withdrawApplication("demo-member", 2_000);
  assert.equal(withdrawn.status, "withdrawn");
  assert.equal(store.saved?.updatedAt, 2_000);
});
