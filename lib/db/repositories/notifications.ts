import { notifications } from "../../../db/schema";
import type { getDb } from "../../../db";
import type { NotificationMessage } from "../../../features/notifications/types";

type Db = ReturnType<typeof getDb>;

export async function saveInAppNotification(db: Db, message: NotificationMessage): Promise<void> {
  await db.insert(notifications).values({
    ...message,
    deliveryStatus: "sent",
    updatedAt: message.createdAt,
  }).onConflictDoNothing({ target: notifications.dedupeKey });
}
