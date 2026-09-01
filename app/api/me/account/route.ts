import {
  deleteOwnAccount,
  handleAccountDeletionRequest,
} from "../../../../features/identity/account-deletion";
import { requireRequestUserSession } from "../../../../features/identity/request-user";

export async function DELETE(request: Request) {
  return handleAccountDeletionRequest(request, {
    requireActiveSession: requireRequestUserSession,
    deleteOwnAccount,
    now: Date.now,
  });
}
