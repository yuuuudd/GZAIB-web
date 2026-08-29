export type ApplicationNotificationEvent = {
  type:
    | "application_submitted"
    | "application_approved"
    | "application_changes_requested"
    | "application_rejected";
  userId: string;
  applicationId: string;
  createdAt: number;
};

export type ContributionNotificationEvent = {
  type: "contribution_confirmed";
  userId: string;
  contributionId: string;
  contributionTitle: string;
  createdAt: number;
};

/** Contains only the recipient and the safe summary allowed in connection notices. */
export type ConnectionNotificationEvent = {
  type: "connection_received" | "connection_accepted" | "connection_declined" | "connection_withdrawn";
  userId: string;
  requestId: string;
  peerName: string;
  topic: string;
  createdAt: number;
};

export type NotificationEvent = ApplicationNotificationEvent | ContributionNotificationEvent | ConnectionNotificationEvent;

/** Transport-neutral member copy. D1 maps these fields to title/body/href columns. */
export type NotificationMessage = {
  id: string;
  userId: string;
  type: NotificationEvent["type"];
  subject: string;
  text: string;
  link: string;
  dedupeKey: string;
  createdAt: number;
};

export type DeliveryResult = { status: "sent" } | { status: "failed"; reason: string };
export type NotificationDeliveryStatus = DeliveryResult["status"];

export interface NotificationStore {
  save(message: NotificationMessage, deliveryStatus: NotificationDeliveryStatus): Promise<void>;
}

/** Transport-neutral port; phase two can replace the in-app adapter with a public-account adapter. */
export interface NotificationSender<TMessage = NotificationEvent> {
  send(message: TMessage): Promise<DeliveryResult>;
}

/** Notification delivery is deliberately outside the business transaction and can never roll it back. */
export async function sendNotificationWithoutRollback(
  sender: NotificationSender | undefined,
  event: NotificationEvent,
): Promise<void> {
  if (!sender) return;
  try {
    await sender.send(event);
  } catch {
    // Adapters should return a failed result, but a broken adapter must not fail business state.
  }
}
