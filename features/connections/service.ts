import { canCreate, normalizeConnectionInput } from "./policy";
import type {
  ConnectionAction,
  ConnectionBox,
  ConnectionCursor,
  ConnectionPage,
  ConnectionPolicyCode,
  ConnectionRepository,
  ConnectionRequest,
  CreateConnectionInput,
} from "./types";

const transitions = {
  accept: { actor: "recipient", to: "accepted" },
  decline: { actor: "recipient", to: "declined" },
  withdraw: { actor: "sender", to: "withdrawn" },
} as const;

type ConnectionServiceCode = ConnectionPolicyCode | "forbidden" | "not_found" | "state_conflict" | "invalid_action";

const statusForCode: Record<ConnectionServiceCode, number> = {
  self_request: 400,
  sender_ineligible: 403,
  recipient_unavailable: 404,
  blocked: 403,
  duplicate_pending: 409,
  daily_limit: 429,
  invalid_message: 400,
  forbidden: 403,
  not_found: 404,
  state_conflict: 409,
  invalid_action: 400,
};

/** A route-safe error that contains a stable code but never request-body content. */
export class ConnectionServiceError extends Error {
  readonly status: number;

  constructor(readonly code: ConnectionServiceCode) {
    super(code);
    this.name = "ConnectionServiceError";
    this.status = statusForCode[code];
  }
}

function policyError(code: ConnectionPolicyCode): never {
  throw new ConnectionServiceError(code);
}

function isAction(value: string): value is ConnectionAction {
  return value === "accept" || value === "decline" || value === "withdraw";
}

function actorCanPerform(actorId: string, request: ConnectionRequest, action: ConnectionAction): boolean {
  return transitions[action].actor === "sender" ? request.senderId === actorId : request.recipientId === actorId;
}

export function createConnectionService(
  repository: ConnectionRepository,
  createId: () => string = () => crypto.randomUUID(),
) {
  return {
    async createRequest(senderId: string, input: CreateConnectionInput, now: number): Promise<ConnectionRequest> {
      if (!Number.isFinite(now) || !senderId || !input || typeof input.recipientId !== "string"
        || typeof input.topic !== "string" || typeof input.message !== "string") {
        throw new ConnectionServiceError("invalid_message");
      }
      const normalized = normalizeConnectionInput(input);
      const context = await repository.getCreateContext(senderId, input.recipientId, normalized, now);
      const policy = canCreate({
        ...context,
        senderId,
        recipientId: input.recipientId,
        topic: normalized.topic,
        message: normalized.message,
      });
      if (!policy.ok) policyError(policy.code);

      const request: ConnectionRequest = {
        id: createId(), senderId, recipientId: input.recipientId, topic: normalized.topic, message: normalized.message,
        status: "pending", createdAt: now, updatedAt: now,
      };
      const inserted = await repository.createRequestAtomic({ request, notifications: [] });
      if (inserted.created) return request;

      // A guarded D1 insert may lose a race. Re-read immediately so normal conflicts remain typed.
      const latest = await repository.getCreateContext(senderId, input.recipientId, normalized, now);
      const latestPolicy = canCreate({
        ...latest,
        senderId,
        recipientId: input.recipientId,
        topic: normalized.topic,
        message: normalized.message,
      });
      if (!latestPolicy.ok) policyError(latestPolicy.code);
      throw new ConnectionServiceError("duplicate_pending");
    },

    async resolveRequest(actorId: string, requestId: string, action: ConnectionAction, now: number): Promise<ConnectionRequest> {
      if (!Number.isFinite(now) || !actorId || !requestId) throw new ConnectionServiceError("invalid_action");
      if (!isAction(action)) throw new ConnectionServiceError("invalid_action");

      const current = await repository.getRequest(requestId);
      if (!current) throw new ConnectionServiceError("not_found");
      if (!actorCanPerform(actorId, current, action)) throw new ConnectionServiceError("forbidden");
      const targetStatus = transitions[action].to;
      if (current.status === targetStatus) return current;
      if (current.status !== "pending") throw new ConnectionServiceError("state_conflict");

      const resolved = await repository.resolveRequestAtomic({
        requestId, actorId, action, status: targetStatus, now, notifications: [],
      });
      if (resolved) return resolved;

      const latest = await repository.getRequest(requestId);
      if (latest && actorCanPerform(actorId, latest, action) && latest.status === targetStatus) return latest;
      throw new ConnectionServiceError(latest ? "state_conflict" : "not_found");
    },

    listInbox(userId: string, box: ConnectionBox, cursor?: ConnectionCursor): Promise<ConnectionPage> {
      return repository.listRequests(userId, box, cursor);
    },

    hasAcceptedRelationship(leftUserId: string, rightUserId: string): Promise<boolean> {
      return repository.hasAcceptedRelationship(leftUserId, rightUserId);
    },
  };
}

export async function createRuntimeConnectionService() {
  const [{ getDb }, { createConnectionRepository }] = await Promise.all([
    import("../../db"), import("../../lib/db/repositories/connections"),
  ]);
  return createConnectionService(createConnectionRepository(getDb()));
}

export async function createRequest(senderId: string, input: CreateConnectionInput, now: number) {
  return (await createRuntimeConnectionService()).createRequest(senderId, input, now);
}

export async function resolveRequest(actorId: string, requestId: string, action: ConnectionAction, now: number) {
  return (await createRuntimeConnectionService()).resolveRequest(actorId, requestId, action, now);
}

export async function listInbox(userId: string, box: ConnectionBox, cursor?: ConnectionCursor) {
  return (await createRuntimeConnectionService()).listInbox(userId, box, cursor);
}
