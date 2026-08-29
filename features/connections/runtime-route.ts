import { createConnectionRouteHandlers } from "./route-handlers";
import type { ConnectionRequest } from "./types";

type ActiveSession = { identity: { id: string; role?: string } };
type LiveContactService = { getVisibleContactCard(viewerId: string, ownerId: string): Promise<{ wechat?: string; email?: string; otherLabel?: string; otherValue?: string } | undefined> };
type RuntimeService = {
  createRequest(senderId: string, input: { recipientId: string; topic: string; message: string }, now: number): Promise<ConnectionRequest>;
  listInbox(userId: string, box: "received" | "sent" | "accepted", cursor?: { createdAt: number; id: string }): Promise<{ items: ConnectionRequest[]; nextCursor?: { createdAt: number; id: string } }>;
  resolveRequest(actorId: string, requestId: string, action: "accept" | "decline" | "withdraw", now: number): Promise<ConnectionRequest>;
};

/** Production composition seam: tests execute this exact adapter with controlled session/D1 primitives. */
export function createRuntimeConnectionRouteAdapter(dependencies: {
  requireActiveSession(request: Request): Promise<ActiveSession>;
  createRuntimeService(): Promise<RuntimeService>;
  resolveRecipientId(slug: string): Promise<string | undefined>;
  createLiveContactService(): LiveContactService;
  now(): number;
}) {
  return createConnectionRouteHandlers({
    requireActiveSession: dependencies.requireActiveSession,
    createService: dependencies.createRuntimeService,
    resolveRecipientId: dependencies.resolveRecipientId,
    getVisibleContactCard: (viewerId, ownerId) => dependencies.createLiveContactService().getVisibleContactCard(viewerId, ownerId),
    now: dependencies.now,
  });
}

/** Defers platform/D1 imports until an API request is handled, keeping route-module import safe in non-Worker tooling. */
export async function createDefaultRuntimeConnectionRouteAdapter() {
  const [identity, service, resolver, cards, repository, database] = await Promise.all([
    import("../identity/active-account"), import("./service"), import("./recipient-resolver"), import("./contact-card"),
    import("../../lib/db/repositories/contact-cards"), import("../../db"),
  ]);
  return createRuntimeConnectionRouteAdapter({
    requireActiveSession: identity.requireActiveSession,
    createRuntimeService: service.createRuntimeConnectionService,
    resolveRecipientId: resolver.resolvePublicConnectionRecipientId,
    createLiveContactService: () => cards.createContactCardService(repository.createContactCardRepository(database.getDb())),
    now: Date.now,
  });
}
