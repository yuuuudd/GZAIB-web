import assert from "node:assert/strict";
import test from "node:test";
import {
  handleApplicationPost,
  runtimeApplicationRouteService,
} from "../../app/api/applications/route";
import { CONSENT_VERSION } from "../../features/applications/validation";
import { createApplicationService, submitApplication } from "../../features/applications/service";
import { InAppNotificationSender } from "../../features/notifications/in-app";
import type { NotificationMessage } from "../../features/notifications/types";
import type { ApplicationRecord } from "../../features/applications/types";

const now = 1_700_000_000_000;
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

function applicationRepository() {
  let saved: ApplicationRecord | undefined;
  return {
    get saved() { return saved; },
    repository: {
      getApplicationByUserId: async () => undefined,
      isSchoolConfirmed: async () => true,
      saveApplication: async (record: ApplicationRecord) => { saved = record; },
      reviewApplication: async () => undefined,
    },
  };
}

function request() {
  return new Request("https://site.test/api/applications", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });
}

test("the actual application POST service persists application_submitted through the in-app adapter", async () => {
  const applications = applicationRepository();
  const notifications: Array<NotificationMessage & { deliveryStatus: "sent" | "failed" }> = [];
  const sender = new InAppNotificationSender({
    async save(message, deliveryStatus) { notifications.push({ ...message, deliveryStatus }); },
  }, () => "notification-1");
  const service = createApplicationService(applications.repository, () => "application-1", sender);

  const response = await handleApplicationPost(request(), {
    authenticate: async () => "member-1",
    service: () => service,
    now: () => now,
  });

  assert.equal(response.status, 201);
  assert.equal(applications.saved?.status, "pending");
  assert.deepEqual(notifications, [{
    id: "notification-1",
    userId: "member-1",
    type: "application_submitted",
    subject: "你的共建者地图申请已提交",
    text: "我们已收到申请，审核结果会在站内通知中更新。",
    link: "/apply",
    dedupeKey: "application:application-1:submitted:1700000000000",
    createdAt: now,
    deliveryStatus: "sent",
  }]);
});

test("the production application route delegates to the notification-wired runtime service", () => {
  assert.equal(runtimeApplicationRouteService().submitApplication, submitApplication);
});

test("the application POST still returns 201 when both notification persistence attempts fail", async () => {
  const applications = applicationRepository();
  let attempts = 0;
  const sender = new InAppNotificationSender({
    async save() { attempts += 1; throw new Error("D1 notifications unavailable"); },
  }, () => "notification-1");
  const service = createApplicationService(applications.repository, () => "application-1", sender);

  const response = await handleApplicationPost(request(), {
    authenticate: async () => "member-1",
    service: () => service,
    now: () => now,
  });

  assert.equal(response.status, 201);
  assert.equal(applications.saved?.status, "pending");
  assert.equal(attempts, 2);
});
