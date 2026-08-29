import { createConnectionRouteHandlers } from "../../../features/connections/route-handlers";
import { createContactCardService } from "../../../features/connections/contact-card";
import { createRuntimeConnectionService } from "../../../features/connections/service";
import { resolvePublicConnectionRecipientId } from "../../../features/connections/recipient-resolver";
import { requireActiveSession } from "../../../features/identity/active-account";
import { getDb } from "../../../db";
import { createContactCardRepository } from "../../../lib/db/repositories/contact-cards";

const handlers = createConnectionRouteHandlers({
  requireActiveSession,
  createService: () => createRuntimeConnectionService(),
  resolveRecipientId: resolvePublicConnectionRecipientId,
  getVisibleContactCard: (viewerId, ownerId) => createContactCardService(createContactCardRepository(getDb())).getVisibleContactCard(viewerId, ownerId),
  now: Date.now,
});

export const POST = handlers.POST;
export const GET = handlers.GET;
