import { getDb } from "../../../../db";
import { createContactCardService } from "../../../../features/connections/contact-card";
import { createContactCardRouteHandlers } from "../../../../features/connections/contact-card-route";
import { requireRequestUserSession } from "../../../../features/identity/request-user";
import { createContactCardRepository } from "../../../../lib/db/repositories/contact-cards";

const handlers = createContactCardRouteHandlers({
  requireActiveSession: requireRequestUserSession,
  createService: () => createContactCardService(createContactCardRepository(getDb())),
});

export const GET = handlers.GET;
export const PUT = handlers.PUT;
export const DELETE = handlers.DELETE;
