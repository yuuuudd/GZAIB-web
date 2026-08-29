import assert from "node:assert/strict";
import test from "node:test";
import { createApplicationService } from "../../features/applications/service";
import {
  createApplicationReviewService,
  type ApplicationReviewRepository,
} from "../../features/applications/review";
import type { ApplicationRecord } from "../../features/applications/types";
import { CONSENT_VERSION, DEFAULT_APPLICATION_VISIBILITY, getMapEligibility } from "../../features/applications/validation";
import {
  createContributionService,
  type ContributionRecord,
  type ContributionRepository,
} from "../../features/contributions/service";
import { InAppNotificationSender, toInAppNotification } from "../../features/notifications/in-app";
import type {
  NotificationEvent,
  NotificationMessage,
} from "../../features/notifications/types";
import { saveInAppNotification } from "../../lib/db/repositories/notifications";

const now = 1_700_000_000_000;

const events: Array<{ event: NotificationEvent; expected: Omit<NotificationMessage, "id" | "createdAt"> }> = [
  {
    event: { type: "application_submitted", userId: "member-1", applicationId: "application-1", createdAt: now },
    expected: {
      userId: "member-1",
      type: "application_submitted",
      subject: "你的共建者地图申请已提交",
      text: "我们已收到申请，审核结果会在站内通知中更新。",
      link: "/apply",
      dedupeKey: "application:application-1:submitted:1700000000000",
    },
  },
  {
    event: { type: "application_approved", userId: "member-1", applicationId: "application-1", createdAt: now },
    expected: {
      userId: "member-1",
      type: "application_approved",
      subject: "你的共建者地图申请已通过",
      text: "欢迎加入广东高校共建者地图，你的公开资料已按本人设置上线。",
      link: "/me",
      dedupeKey: "application:application-1:approved:1700000000000",
    },
  },
  {
    event: {
      type: "application_changes_requested",
      userId: "member-1",
      applicationId: "application-1",
      createdAt: now,
      internalReviewNotes: "运营内部核验记录，不可发送给成员",
    } as NotificationEvent,
    expected: {
      userId: "member-1",
      type: "application_changes_requested",
      subject: "你的共建者地图申请需要补充",
      text: "请返回申请页查看并补充资料后重新提交。",
      link: "/apply",
      dedupeKey: "application:application-1:changes_requested:1700000000000",
    },
  },
  {
    event: {
      type: "application_rejected",
      userId: "member-1",
      applicationId: "application-1",
      createdAt: now,
      internalReviewNotes: "仅供审核团队查看",
    } as NotificationEvent,
    expected: {
      userId: "member-1",
      type: "application_rejected",
      subject: "你的共建者地图申请未通过",
      text: "本次申请暂未通过，你可以返回申请页查看状态。",
      link: "/apply",
      dedupeKey: "application:application-1:rejected:1700000000000",
    },
  },
  {
    event: {
      type: "contribution_confirmed",
      userId: "member-1",
      contributionId: "contribution-1",
      contributionTitle: "演示跨校共创夜",
      createdAt: now,
    },
    expected: {
      userId: "member-1",
      type: "contribution_confirmed",
      subject: "你的共建贡献已确认",
      text: "“演示跨校共创夜”已确认，共建者徽章状态已更新。",
      link: "/me",
      dedupeKey: "contribution:contribution-1:confirmed",
    },
  },
];

test("maps every phase-one event to exact member-facing content without private review notes", () => {
  for (const { event, expected } of events) {
    const message = toInAppNotification(event, "notification-1");
    assert.deepEqual(message, { id: "notification-1", createdAt: now, ...expected });
    assert.doesNotMatch(JSON.stringify(message), /internalReviewNotes|运营内部核验记录|仅供审核团队查看/);
  }
});

test("keeps an application event retry idempotent while giving a later transition a fresh notification key", () => {
  const first = toInAppNotification({
    type: "application_changes_requested", userId: "member-1", applicationId: "application-1", createdAt: now,
  }, "notification-1");
  const retry = toInAppNotification({
    type: "application_changes_requested", userId: "member-1", applicationId: "application-1", createdAt: now,
  }, "notification-2");
  const later = toInAppNotification({
    type: "application_changes_requested", userId: "member-1", applicationId: "application-1", createdAt: now + 1,
  }, "notification-3");

  assert.equal(retry.dedupeKey, first.dedupeKey);
  assert.notEqual(later.dedupeKey, first.dedupeKey);
  assert.match(later.dedupeKey, /:1700000000001$/);
});

test("records a failed delivery attempt and resolves instead of throwing when D1 delivery fails", async () => {
  const rows = new Map<string, NotificationMessage & { deliveryStatus: "sent" | "failed" }>();
  const sender = new InAppNotificationSender({
    async save(message, deliveryStatus) {
      rows.set(message.dedupeKey, { ...message, deliveryStatus });
      if (deliveryStatus === "sent") throw new Error("simulated D1 insert failure");
    },
  }, () => "notification-1");

  const result = await sender.send(events[1]!.event);

  assert.deepEqual(result, { status: "failed", reason: "simulated D1 insert failure" });
  assert.equal([...rows.values()][0]?.deliveryStatus, "failed");
});

test("maps transport-neutral copy to only the allowlisted D1 notification columns", async () => {
  let values: Record<string, unknown> | undefined;
  let conflict: { target: unknown; set: Record<string, unknown> } | undefined;
  const db = {
    insert: () => ({
      values(input: Record<string, unknown>) {
        values = input;
        return { async onConflictDoUpdate(input: { target: unknown; set: Record<string, unknown> }) { conflict = input; } };
      },
    }),
  };
  const message = toInAppNotification(events[2]!.event, "notification-1");

  await saveInAppNotification(db as never, message, "failed");

  assert.deepEqual(values, {
    id: "notification-1",
    userId: "member-1",
    type: "application_changes_requested",
    title: "你的共建者地图申请需要补充",
    body: "请返回申请页查看并补充资料后重新提交。",
    href: "/apply",
    dedupeKey: "application:application-1:changes_requested:1700000000000",
    deliveryStatus: "failed",
    createdAt: now,
    updatedAt: now,
  });
  assert.deepEqual(conflict?.set, {
    title: "你的共建者地图申请需要补充",
    body: "请返回申请页查看并补充资料后重新提交。",
    href: "/apply",
    deliveryStatus: "failed",
    updatedAt: now,
  });
  assert.doesNotMatch(JSON.stringify({ values, conflictSet: conflict?.set }), /internalReviewNotes|reviewReason|contactCard|sessionId/);
});

const applicationInput = {
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

test("submits an application before notifying and keeps the pending business state when delivery throws", async () => {
  let persisted = false;
  const captured: NotificationEvent[] = [];
  const service = createApplicationService({
    getApplicationByUserId: async () => undefined,
    isSchoolConfirmed: async () => true,
    saveApplication: async () => { persisted = true; },
    reviewApplication: async () => undefined,
  }, () => "application-1", {
    async send(event) {
      assert.equal(persisted, true);
      captured.push(event);
      throw new Error("notification delivery unavailable");
    },
  });

  const result = await service.submitApplication("member-1", applicationInput, now);

  assert.equal(result.status, "pending");
  assert.deepEqual(captured, [{
    type: "application_submitted", userId: "member-1", applicationId: "application-1", createdAt: now,
  }]);
});

function pendingApplication(): ApplicationRecord {
  const visibility = { ...DEFAULT_APPLICATION_VISIBILITY };
  return {
    id: "application-1",
    userId: "member-1",
    status: "pending",
    nickname: "林同学",
    schoolId: "school-1",
    intro: "正在探索 AI 如何帮助校园里的真实协作。",
    skills: ["产品设计"],
    interests: ["教育创新"],
    roles: ["活动共建者"],
    workLinks: [],
    visibility,
    consentVersion: CONSENT_VERSION,
    consentAcceptedAt: 1,
    submittedAt: 1,
    createdAt: 1,
    updatedAt: 1,
    mapEligibility: getMapEligibility(visibility),
  };
}

test("completes an atomic approval before notifying and keeps it approved when delivery throws", async () => {
  let transitioned = false;
  const captured: NotificationEvent[] = [];
  const repository: ApplicationReviewRepository = {
    getReviewContext: async () => ({ application: pendingApplication(), schoolCoordinateStatus: "confirmed" }),
    applyReviewAtomic: async () => { transitioned = true; return { transitioned: true }; },
    recordDecisionAtomic: async () => ({ transitioned: true }),
  };
  const service = createApplicationReviewService(
    repository,
    () => "profile-1",
    () => "audit-1",
    {
      async send(event) {
        assert.equal(transitioned, true);
        captured.push(event);
        throw new Error("notification delivery unavailable");
      },
    },
  );

  const result = await service.reviewApplication("demo-admin", "application-1", { decision: "approved" }, now);

  assert.equal(result.application.status, "approved");
  assert.deepEqual(captured, [{
    type: "application_approved", userId: "member-1", applicationId: "application-1", createdAt: now,
  }]);
});

test("sends the matching member event after changes-requested and rejected decisions commit", async () => {
  for (const decision of ["changes_requested", "rejected"] as const) {
    let transitioned = false;
    const captured: NotificationEvent[] = [];
    const repository: ApplicationReviewRepository = {
      getReviewContext: async () => ({ application: pendingApplication(), schoolCoordinateStatus: "confirmed" }),
      applyReviewAtomic: async () => ({ transitioned: true }),
      recordDecisionAtomic: async () => { transitioned = true; return { transitioned: true }; },
    };
    const service = createApplicationReviewService(repository, undefined, () => "audit-1", {
      async send(event) {
        assert.equal(transitioned, true);
        captured.push(event);
        return { status: "sent" };
      },
    });

    const result = await service.reviewApplication("demo-admin", "application-1", {
      decision,
      reason: "这是提供给申请人的演示审核反馈说明。",
    }, now);

    assert.equal(result.application.status, decision);
    assert.deepEqual(captured, [{
      type: decision === "rejected" ? "application_rejected" : "application_changes_requested",
      userId: "member-1",
      applicationId: "application-1",
      createdAt: now,
    }]);
  }
});

test("confirms a contribution before notifying its owner and keeps the confirmation when delivery throws", async () => {
  const contribution: ContributionRecord = {
    id: "contribution-1",
    profileId: "profile-1",
    activityKey: "demo-build-night",
    title: "演示跨校共创夜",
    activityDate: now,
    role: "活动共建者",
    outcome: "完成演示原型",
    publicSummary: "两所演示学校共同完成了一个虚构原型。",
    visibility: "public",
    status: "confirmed",
    confirmedBy: "demo-admin",
    confirmedAt: now,
    createdAt: 1,
    updatedAt: now,
  };
  let transitioned = false;
  const captured: NotificationEvent[] = [];
  const repository: ContributionRepository = {
    confirmPendingAtomic: async () => {
      transitioned = true;
      return { transitioned: true, contribution, verifiedBuilder: true, recipientUserId: "member-1" };
    },
  };
  const service = createContributionService(repository, () => "audit-1", {
    async send(event) {
      assert.equal(transitioned, true);
      captured.push(event);
      throw new Error("notification delivery unavailable");
    },
  });

  const result = await service.confirmContribution("demo-admin", { id: "contribution-1", status: "confirmed" }, now);

  assert.equal(result.contribution.status, "confirmed");
  assert.deepEqual(captured, [{
    type: "contribution_confirmed",
    userId: "member-1",
    contributionId: "contribution-1",
    contributionTitle: "演示跨校共创夜",
    createdAt: now,
  }]);
});
