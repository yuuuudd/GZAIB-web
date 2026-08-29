import {
  deleteOwnAccount,
  handleAccountDeletionRequest,
} from "../../../../features/identity/account-deletion";
import { requireActiveSession } from "../../../../features/identity/active-account";

export async function DELETE(request: Request) {
  return handleAccountDeletionRequest(request, {
    requireActiveSession,
    deleteOwnAccount,
    now: Date.now,
  });
}
