import assert from "node:assert/strict";
import test from "node:test";
import { SQLiteSyncDialect } from "drizzle-orm/sqlite-core";
import { connectionRequests, notifications } from "../../db/schema";
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
    senderId: current.senderId, recipientId: current.recipientId, senderStatus: "active", senderApproved: true, senderPublished: true, recipientPublished: true,
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
      const status = input.action === "accept" ? "accepted" : input.action === "decline" ? "declined" : "withdrawn";
      current = { ...current, status, resolvedAt: input.now, updatedAt: input.now };
      notifications.push(...input.notifications);
      return current;
    },
    listRequests: async (): Promise<ConnectionPage> => ({ items: current ? [current] : [], nextCursor: undefined }),
    hasAcceptedRelationship: async (left, right) => current?.status === "accepted"
      && ((current.senderId === left && current.recipientId === right) || (current.senderId === right && current.recipientId === left)),
    getNotificationTarget: async (userId: string) => ({
      userId,
      displayName: userId === "member-1" ? "林同学" : "陈同学",
      email: `${userId}@example.test`,
    }),
    updateNotificationDelivery: async () => undefined,
  };
  return {
    repository,
    get current() { return current; },
    setContext(next: ConnectionPolicyContext) { currentContext = next; },
    notifications,
  };
}

test("creation atomically persists the received notification before optional email delivery", async () => {
  const store = memoryRepository();
  const sent: unknown[] = [];
  const service = createConnectionService(store.repository, () => "request-created", {
    createNotificationId: () => "notification-1",
    emailSender: { async send(email) {
      assert.equal(store.notifications.length, 1, "email is attempted only after the atomic notification batch");
      sent.push(email);
      return { status: "sent" };
    } },
  });

  const created = await service.createRequest("member-1", {
    recipientId: "member-2", topic: "  AI collaboration ", message: "  I would like to exchange ideas about a campus AI collaboration.  ",
  }, now);

  assert.deepEqual(created, request({ id: "request-created" }));
  assert.equal(store.current?.senderId, "member-1");
  assert.equal(store.current?.topic, "AI collaboration");
  assert.equal(store.current?.message, "I would like to exchange ideas about a campus AI collaboration.");
  assert.deepEqual(store.notifications, [{
    id: "notification-1", userId: "member-2", type: "connection_received",
    title: "你收到一条新的连接请求", body: "林同学想和你聊聊：AI collaboration",
    href: "/me/connections?box=received", dedupeKey: "connection:request-created:pending",
    deliveryStatus: "pending", createdAt: now,
  }]);
  assert.deepEqual(sent, [{
    to: "member-2@example.test",
    event: {
      type: "connection_received", userId: "member-2", requestId: "request-created",
      peerName: "林同学", topic: "AI collaboration", createdAt: now,
    },
  }]);
});

test("final connection actions persist one notification atomically and keep a failed email outside the status transition", async () => {
  const store = memoryRepository(request());
  const deliveryStatuses: Array<{ dedupeKey: string; status: string }> = [];
  store.repository.updateNotificationDelivery = async (dedupeKey, status) => { deliveryStatuses.push({ dedupeKey, status }); };
  const service = createConnectionService(store.repository, () => "request-created", {
    createNotificationId: () => "notification-accepted",
    emailSender: { async send() { throw new Error("simulated adapter failure"); } },
  });

  const resolved = await service.resolveRequest("member-2", "request-1", "accept", now);
  const retried = await service.resolveRequest("member-2", "request-1", "accept", now + 1);

  assert.equal(resolved.status, "accepted");
  assert.equal(retried.status, "accepted");
  assert.deepEqual(store.notifications, [{
    id: "notification-accepted", userId: "member-1", type: "connection_accepted",
    title: "你的连接请求已被接受", body: "陈同学接受了你的连接请求：AI collaboration",
    href: "/me/connections?box=accepted", dedupeKey: "connection:request-1:accepted",
    deliveryStatus: "pending", createdAt: now,
  }]);
  assert.deepEqual(deliveryStatuses, [{ dedupeKey: "connection:request-1:accepted", status: "failed" }]);
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

test("creation rejects an active sender lacking approval or a published profile before persistence", async () => {
  for (const senderContext of [context({ senderApproved: false }), context({ senderPublished: false })]) {
    const store = memoryRepository();
    store.setContext(senderContext);
    const service = createConnectionService(store.repository);
    await assert.rejects(
      () => service.createRequest("member-1", { recipientId: "member-2", topic: "AI collaboration", message: request().message }, now),
      (error: unknown) => error instanceof ConnectionServiceError && error.code === "sender_ineligible",
    );
    assert.equal(store.current, undefined);
  }
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
  let reads = 0;
  const store = memoryRepository();
  const repository: ConnectionRepository = {
    ...store.repository,
    getCreateContext: async (senderId, recipientId, input) => context({
      senderId, recipientId, topic: input.topic, message: input.message, pendingEitherDirection: reads++ > 0,
    }),
    createRequestAtomic: async () => ({ created: false }),
  };
  const service = createConnectionService(repository);

  await assert.rejects(
    () => service.createRequest("member-1", { recipientId: "member-2", topic: "AI collaboration", message: request().message }, now),
    (error: unknown) => error instanceof ConnectionServiceError && error.code === "duplicate_pending",
  );
  assert.equal(reads, 2);
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

test("D1 received, sent, and accepted inboxes apply their distinct ownership filters", async () => {
  const predicates = new Map<string, unknown>();
  for (const box of ["received", "sent", "accepted"] as const) {
    let where: unknown;
    const builder = {
      where: (condition: unknown) => { where = condition; return builder; },
      orderBy: () => builder,
      limit: () => Promise.resolve([]),
    };
    const db = { select: () => ({ from: () => builder }) };
    await createConnectionRepository(db as never).listRequests("member-1", box, { createdAt: now, id: "request-1" });
    predicates.set(box, where);
  }

  const dialect = new SQLiteSyncDialect();
  const received = dialect.sqlToQuery(predicates.get("received") as never);
  const sent = dialect.sqlToQuery(predicates.get("sent") as never);
  const accepted = dialect.sqlToQuery(predicates.get("accepted") as never);
  assert.ok(received.params.includes("member-1"));
  assert.equal(received.params.includes("accepted"), false);
  assert.ok(sent.params.includes("member-1"));
  assert.equal(sent.params.includes("accepted"), false);
  assert.ok(accepted.params.includes("accepted"));
  assert.equal(accepted.params.filter((value) => value === "member-1").length, 2);
  for (const query of [received, sent, accepted]) {
    assert.match(query.sql, /"connection_requests"\."created_at" < \?/);
    assert.match(query.sql, /"connection_requests"\."created_at" = \? and "connection_requests"\."id" < \?/);
  }
});

test("D1 guarded creation requires an approved, published active sender and includes the 24-hour boundary", async () => {
  let guardedInsert: unknown;
  const db = {
    insert: () => ({ select: (query: unknown) => { guardedInsert = query; return {}; } }),
    batch: async () => [{ meta: { changes: 0 } }],
  };
  const repository = createConnectionRepository(db as never);
  await repository.createRequestAtomic({ request: request({ createdAt: now }), notifications: [] });

  const query = new SQLiteSyncDialect().sqlToQuery(guardedInsert as never);
  assert.match(query.sql, /sender_application\.status = 'approved'/);
  assert.match(query.sql, /sender_profile\.publish_status = 'published'/);
  assert.match(query.sql, /daily_request\.created_at >= \?/);
  assert.ok(query.params.includes(now - 86_400_000));
});

test("repository derives a transition status from the action instead of a caller-supplied target", async () => {
  let set: Record<string, unknown> | undefined;
  const db = {
    update: () => ({ set: (value: Record<string, unknown>) => { set = value; return { where: () => ({}) }; } }),
    batch: async () => [{ meta: { changes: 0 } }],
  };
  const repository = createConnectionRepository(db as never);
  await repository.resolveRequestAtomic({
    requestId: "request-1", actorId: "member-2", action: "accept", now, notifications: [], status: "withdrawn",
  } as never);
  assert.equal(set?.status, "accepted");
});

type AtomicOperation = { table: unknown; query: unknown };

function atomicBatchCapture(firstChanges = 0) {
  let batch: AtomicOperation[] = [];
  const db = {
    insert(table: unknown) {
      return {
        select(query: unknown) {
          const operation = { table, query } satisfies AtomicOperation;
          return {
            ...operation,
            onConflictDoNothing: () => operation,
          };
        },
      };
    },
    update(table: unknown) {
      return {
        set: () => ({ where: (query: unknown) => ({ table, query } satisfies AtomicOperation) }),
      };
    },
    async batch(operations: AtomicOperation[]) {
      batch = operations;
      return operations.map((_, index) => ({ meta: { changes: index === 0 ? firstChanges : 0 } }));
    },
  };
  return { db, batch: () => batch };
}

const notification = {
  id: "notification-1", userId: "member-2", type: "connection_received", title: "收到新连接",
  body: "成员想和你聊聊：AI collaboration", href: "/me/connections?box=received",
  dedupeKey: "connection:request-1:pending", deliveryStatus: "pending" as const, createdAt: now,
};

test("D1 creation batches a non-empty guarded notification insert after the guarded request insert", async () => {
  const capture = atomicBatchCapture();
  await createConnectionRepository(capture.db as never).createRequestAtomic({ request: request(), notifications: [notification] });
  const operations = capture.batch();
  assert.equal(operations.length, 2);
  assert.equal(operations[0]?.table, connectionRequests);
  assert.equal(operations[1]?.table, notifications);
  const notificationQuery = new SQLiteSyncDialect().sqlToQuery(operations[1]?.query as never);
  assert.match(notificationQuery.sql, /where exists \(select 1 from connection_requests where id = \?\)/i);
  assert.ok(notificationQuery.params.includes("request-1"));
});

test("D1 resolution batches a non-empty notification only after its guarded transition", async () => {
  const capture = atomicBatchCapture();
  await createConnectionRepository(capture.db as never).resolveRequestAtomic({
    requestId: "request-1", actorId: "member-2", action: "accept", now, notifications: [{
      ...notification, id: "notification-accepted", userId: "member-1", type: "connection_accepted",
      dedupeKey: "connection:request-1:accepted",
    }],
  });
  const operations = capture.batch();
  assert.equal(operations.length, 2);
  assert.equal(operations[0]?.table, connectionRequests);
  assert.equal(operations[1]?.table, notifications);
  const notificationQuery = new SQLiteSyncDialect().sqlToQuery(operations[1]?.query as never);
  assert.match(notificationQuery.sql, /where exists \(\s*select 1 from connection_requests/i);
  assert.ok(notificationQuery.params.includes("request-1"));
  assert.ok(notificationQuery.params.includes("accepted"));
  assert.ok(notificationQuery.params.includes(now));
});
