import assert from "node:assert/strict";
import test from "node:test";
import { SQLiteSyncDialect } from "drizzle-orm/sqlite-core";
import { createConnectionRepository } from "../../lib/db/repositories/connections";
import { ConnectionServiceError, createConnectionService } from "../../features/connections/service";
import type {
  ConnectionPage,
  ConnectionPolicyContext,
  ConnectionRepository,
  ConnectionRequest,
  CreateConnectionAtomicInput,
} from "../../features/connections/types";

const now = 1_700_000_000_000;

function request(overrides: Partial<ConnectionRequest> = {}): ConnectionRequest {
  return {
    id: "request-1", senderId: "member-1", recipientId: "member-2", topic: "AI collaboration",
    message: "I would like to exchange ideas about a campus AI collaboration.", status: "pending",
    createdAt: now, updatedAt: now,
    ...overrides,
  };
}

function context(overrides: Partial<ConnectionPolicyContext> = {}): ConnectionPolicyContext {
  const current = request();
  return {
    senderId: current.senderId, recipientId: current.recipientId, senderStatus: "active", recipientPublished: true,
    blockedEitherDirection: false, pendingEitherDirection: false, requestsInLast24Hours: 0,
    topic: current.topic, message: current.message,
    ...overrides,
  };
}

function memoryRepository(initialRequest: ConnectionRequest | undefined = undefined) {
  let current = initialRequest;
  let currentContext = context();
  const notifications: CreateConnectionAtomicInput["notifications"] = [];
  const repository: ConnectionRepository = {
    getCreateContext: async (senderId, recipientId, input) => context({
      ...currentContext, senderId, recipientId, topic: input.topic, message: input.message,
    }),
    createRequestAtomic: async (input) => {
      if (current) return { created: false };
      current = input.request;
      notifications.push(...input.notifications);
      return { created: true };
    },
    getRequest: async (id) => current?.id === id ? current : undefined,
    resolveRequestAtomic: async (input) => {
      if (!current || current.id !== input.requestId || current.status !== "pending") return undefined;
      if ((input.action === "withdraw" && current.senderId !== input.actorId)
        || (input.action !== "withdraw" && current.recipientId !== input.actorId)) return undefined;
      current = { ...current, status: input.status, resolvedAt: input.now, updatedAt: input.now };
      return current;
    },
    listRequests: async (): Promise<ConnectionPage> => ({ items: current ? [current] : [], nextCursor: undefined }),
    hasAcceptedRelationship: async (left, right) => current?.status === "accepted"
      && ((current.senderId === left && current.recipientId === right) || (current.senderId === right && current.recipientId === left)),
  };
  return {
    repository,
    get current() { return current; },
    setContext(next: ConnectionPolicyContext) { currentContext = next; },
    notifications,
  };
}

test("creation is server-owned, normalizes input, and keeps the notification batch boundary empty until event copy is added", async () => {
  const store = memoryRepository();
  const service = createConnectionService(store.repository, () => "request-created");

  const created = await service.createRequest("member-1", {
    recipientId: "member-2", topic: "  AI collaboration ", message: "  I would like to exchange ideas about a campus AI collaboration.  ",
  }, now);

  assert.deepEqual(created, request({ id: "request-created" }));
  assert.equal(store.current?.senderId, "member-1");
  assert.equal(store.current?.topic, "AI collaboration");
  assert.equal(store.current?.message, "I would like to exchange ideas about a campus AI collaboration.");
  assert.deepEqual(store.notifications, []);
});

test("creation rejects an inactive sender before a request can be persisted", async () => {
  const store = memoryRepository();
  store.setContext(context({ senderStatus: "connection_suspended" }));
  const service = createConnectionService(store.repository);

  await assert.rejects(
    () => service.createRequest("member-1", { recipientId: "member-2", topic: "AI collaboration", message: request().message }, now),
    (error: unknown) => error instanceof ConnectionServiceError && error.code === "sender_ineligible",
  );
  assert.equal(store.current, undefined);
});

test("withdrawn requests remain in the rolling count and prevent a sixth request", async () => {
  const store = memoryRepository();
  store.setContext(context({ requestsInLast24Hours: 5 }));
  const service = createConnectionService(store.repository);

  await assert.rejects(
    () => service.createRequest("member-1", { recipientId: "member-2", topic: "AI collaboration", message: request().message }, now),
    (error: unknown) => error instanceof ConnectionServiceError && error.code === "daily_limit",
  );
  assert.equal(store.current, undefined);
});

test("an atomic create loss rechecks policy and returns the typed concurrent duplicate result", async () => {
  const store = memoryRepository(request({ id: "concurrent", senderId: "member-2", recipientId: "member-1" }));
  store.setContext(context({ pendingEitherDirection: true }));
  const service = createConnectionService(store.repository);

  await assert.rejects(
    () => service.createRequest("member-1", { recipientId: "member-2", topic: "AI collaboration", message: request().message }, now),
    (error: unknown) => error instanceof ConnectionServiceError && error.code === "duplicate_pending",
  );
});

test("only the recipient accepts or declines while only the sender withdraws", async () => {
  const store = memoryRepository(request());
  const service = createConnectionService(store.repository);

  await assert.rejects(() => service.resolveRequest("member-1", "request-1", "accept", now), /forbidden/i);
  assert.deepEqual(await service.resolveRequest("member-2", "request-1", "accept", now), request({ status: "accepted", resolvedAt: now }));
});

test("a repeated identical resolution is idempotent but a conflicting resolution is 409-ready", async () => {
  const store = memoryRepository(request({ status: "declined", resolvedAt: now, updatedAt: now }));
  const service = createConnectionService(store.repository);

  assert.deepEqual(await service.resolveRequest("member-2", "request-1", "decline", now + 1), store.current);
  await assert.rejects(
    () => service.resolveRequest("member-1", "request-1", "withdraw", now + 1),
    (error: unknown) => error instanceof ConnectionServiceError && error.status === 409 && error.code === "state_conflict",
  );
});

test("accepted relationship lookup is symmetric and inbox results are scoped by the repository", async () => {
  const store = memoryRepository(request({ status: "accepted", resolvedAt: now }));
  const service = createConnectionService(store.repository);

  assert.equal(await service.hasAcceptedRelationship("member-1", "member-2"), true);
  assert.equal(await service.hasAcceptedRelationship("member-2", "member-1"), true);
  assert.deepEqual(await service.listInbox("member-1", "accepted"), { items: [store.current], nextCursor: undefined });
});

test("D1 inbox pagination has a stable createdAt/id cursor and never returns more than thirty rows", async () => {
  const rows = Array.from({ length: 31 }, (_, index) => ({
    ...request({ id: `request-${31 - index}`, createdAt: now - index, updatedAt: now - index }),
    resolvedAt: null,
  }));
  let where: unknown;
  let order: unknown[] = [];
  let limit: number | undefined;
  const builder = {
    where: (condition: unknown) => { where = condition; return builder; },
    orderBy: (...terms: unknown[]) => { order = terms; return builder; },
    limit: (value: number) => { limit = value; return Promise.resolve(rows); },
  };
  const db = { select: () => ({ from: () => builder }) };
  const repository = createConnectionRepository(db as never);

  const page = await repository.listRequests("member-1", "accepted", { createdAt: now, id: "request-31" });

  assert.equal(limit, 31);
  assert.equal(page.items.length, 30);
  assert.deepEqual(page.nextCursor, { createdAt: now - 29, id: "request-2" });
  const dialect = new SQLiteSyncDialect();
  const predicate = dialect.sqlToQuery(where as never);
  assert.match(predicate.sql, /"connection_requests"\."created_at" < \?/);
  assert.match(predicate.sql, /"connection_requests"\."created_at" = \? and "connection_requests"\."id" < \?/);
  assert.ok(predicate.params.includes("accepted"));
  assert.equal(order.length, 2);
});
