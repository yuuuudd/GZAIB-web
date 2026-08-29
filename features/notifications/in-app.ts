import type { getDb } from "../../db";
import { createNotificationStore } from "../../lib/db/repositories/notifications";
import type {
  DeliveryResult,
  NotificationEvent,
  NotificationMessage,
  NotificationSender,
  NotificationStore,
} from "./types";

type MessageCopy = Pick<NotificationMessage, "subject" | "text" | "link" | "dedupeKey">;

function eventCopy(event: NotificationEvent): MessageCopy {
  switch (event.type) {
    case "application_submitted":
      return {
        subject: "你的共建者地图申请已提交",
        text: "我们已收到申请，审核结果会在站内通知中更新。",
        link: "/apply",
        dedupeKey: `application:${event.applicationId}:submitted`,
      };
    case "application_approved":
      return {
        subject: "你的共建者地图申请已通过",
        text: "欢迎加入广东高校共建者地图，你的公开资料已按本人设置上线。",
        link: "/me",
        dedupeKey: `application:${event.applicationId}:approved`,
      };
    case "application_changes_requested":
      return {
        subject: "你的共建者地图申请需要补充",
        text: "请返回申请页查看并补充资料后重新提交。",
        link: "/apply",
        dedupeKey: `application:${event.applicationId}:changes_requested`,
      };
    case "application_rejected":
      return {
        subject: "你的共建者地图申请未通过",
        text: "本次申请暂未通过，你可以返回申请页查看状态。",
        link: "/apply",
        dedupeKey: `application:${event.applicationId}:rejected`,
      };
    case "contribution_confirmed":
      return {
        subject: "你的共建贡献已确认",
        text: `“${event.contributionTitle}”已确认，共建者徽章状态已更新。`,
        link: "/me",
        dedupeKey: `contribution:${event.contributionId}:confirmed`,
      };
  }
}

/** Maps a domain event to the complete allowlisted message saved by the in-app adapter. */
export function toInAppNotification(
  event: NotificationEvent,
  id: string,
): NotificationMessage {
  return {
    id,
    userId: event.userId,
    type: event.type,
    createdAt: event.createdAt,
    ...eventCopy(event),
  };
}

function failureReason(error: unknown): string {
  return error instanceof Error && error.message ? error.message : "in-app notification delivery failed";
}

export class InAppNotificationSender implements NotificationSender {
  constructor(
    private readonly store: NotificationStore,
    private readonly createId: () => string = () => crypto.randomUUID(),
  ) {}

  async send(event: NotificationEvent): Promise<DeliveryResult> {
    const message = toInAppNotification(event, this.createId());
    try {
      await this.store.save(message, "sent");
      return { status: "sent" };
    } catch (error) {
      try {
        await this.store.save(message, "failed");
      } catch {
        // D1 may be wholly unavailable; the returned status still protects the business transition.
      }
      return { status: "failed", reason: failureReason(error) };
    }
  }
}

export function createInAppNotificationSender(
  db: ReturnType<typeof getDb>,
  createId?: () => string,
): InAppNotificationSender {
  return new InAppNotificationSender(createNotificationStore(db), createId);
}
