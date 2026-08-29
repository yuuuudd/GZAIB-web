import { notifications } from "../../../db/schema";
import type { getDb } from "../../../db";
import type {
  NotificationDeliveryStatus,
  NotificationMessage,
  NotificationStore,
} from "../../../features/notifications/types";

type Db = ReturnType<typeof getDb>;

export async function saveInAppNotification(
  db: Db,
  message: NotificationMessage,
  deliveryStatus: NotificationDeliveryStatus,
): Promise<void> {
  await db.insert(notifications).values({
    id: message.id,
    userId: message.userId,
    type: message.type,
    title: message.subject,
    body: message.text,
    href: message.link,
    dedupeKey: message.dedupeKey,
    deliveryStatus,
    createdAt: message.createdAt,
    updatedAt: message.createdAt,
  }).onConflictDoUpdate({
    target: notifications.dedupeKey,
    set: {
      title: message.subject,
      body: message.text,
      href: message.link,
      deliveryStatus,
      updatedAt: message.createdAt,
    },
  });
}

export function createNotificationStore(db: Db): NotificationStore {
  return {
    save: (message, deliveryStatus) => saveInAppNotification(db, message, deliveryStatus),
  };
}
