import { getDb } from "../../../../db";
import { createContactCardService } from "../../../../features/connections/contact-card";
import { createContactCardRouteHandlers } from "../../../../features/connections/contact-card-route";
import { requireActiveSession } from "../../../../features/identity/active-account";
import { createContactCardRepository } from "../../../../lib/db/repositories/contact-cards";

const handlers = createContactCardRouteHandlers({
  requireActiveSession,
  createService: () => createContactCardService(createContactCardRepository(getDb())),
});

export const GET = handlers.GET;
export const PUT = handlers.PUT;
