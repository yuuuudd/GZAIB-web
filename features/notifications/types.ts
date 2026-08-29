export type NotificationMessage = {
  id: string;
  userId: string;
  type: string;
  title: string;
  body: string;
  href: string;
  dedupeKey: string;
  createdAt: number;
};

export type DeliveryResult = { status: "sent" } | { status: "failed"; reason: string };

/** Transport-neutral port; phase two can replace the in-app adapter with a public-account adapter. */
export interface NotificationSender {
  send(message: NotificationMessage): Promise<DeliveryResult>;
}
