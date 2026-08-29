export const CONNECTION_STATUSES = ["pending", "accepted", "declined", "withdrawn", "cancelled_by_block"] as const;
export type ConnectionStatus = (typeof CONNECTION_STATUSES)[number];

export const CONNECTION_ACTIONS = ["accept", "decline", "withdraw"] as const;
export type ConnectionAction = (typeof CONNECTION_ACTIONS)[number];

export type CreateConnectionInput = {
  recipientId: string;
  topic: string;
  message: string;
};

export type ConnectionPolicyCode =
  | "self_request"
  | "sender_ineligible"
  | "recipient_unavailable"
  | "blocked"
  | "duplicate_pending"
  | "daily_limit"
  | "invalid_message";

export type PolicyResult = { ok: true } | { ok: false; code: ConnectionPolicyCode };

/** All values here come from server-side member, profile, block, and request records. */
export type ConnectionPolicyContext = {
  senderId: string;
  recipientId: string;
  senderStatus: string;
  senderApproved: boolean;
  senderPublished: boolean;
  recipientPublished: boolean;
  blockedEitherDirection: boolean;
  pendingEitherDirection: boolean;
  requestsInLast24Hours: number;
  topic: string;
  message: string;
};

export type ConnectionRequest = {
  id: string;
  senderId: string;
  recipientId: string;
  topic: string;
  message: string;
  status: ConnectionStatus;
  createdAt: number;
  resolvedAt?: number;
  updatedAt: number;
};

export type ConnectionCursor = { createdAt: number; id: string };
export type ConnectionBox = "received" | "sent" | "accepted";
export type ConnectionPage = { items: ConnectionRequest[]; nextCursor?: ConnectionCursor };

/**
 * The Task 5 event mapper fills this boundary with allowlisted member-facing copy.
 * Keeping it in the atomic input lets one D1 batch persist state plus notifications.
 */
export type ConnectionNotificationPersistence = {
  id: string;
  userId: string;
  type: string;
  title: string;
  body: string;
  href: string;
  dedupeKey: string;
  deliveryStatus: "pending" | "sent" | "failed";
  createdAt: number;
};

export type CreateConnectionAtomicInput = {
  request: ConnectionRequest;
  notifications: ConnectionNotificationPersistence[];
};

export type ConnectionRepository = {
  getCreateContext(senderId: string, recipientId: string, input: Pick<CreateConnectionInput, "topic" | "message">, now: number): Promise<ConnectionPolicyContext>;
  createRequestAtomic(input: CreateConnectionAtomicInput): Promise<{ created: boolean }>;
  getRequest(requestId: string): Promise<ConnectionRequest | undefined>;
  resolveRequestAtomic(input: {
    requestId: string;
    actorId: string;
    action: ConnectionAction;
    now: number;
    notifications: ConnectionNotificationPersistence[];
  }): Promise<ConnectionRequest | undefined>;
  listRequests(userId: string, box: ConnectionBox, cursor?: ConnectionCursor): Promise<ConnectionPage>;
  hasAcceptedRelationship(leftUserId: string, rightUserId: string): Promise<boolean>;
};
