import { handleAvatarUpload, storeAvatar } from "../../../../features/directory/avatar";
import { requireActiveSession } from "../../../../features/identity/active-account";
import { removeAvatarObject, replaceAvatarReferences } from "../../../../lib/r2";

function reportAvatarFailure(error: unknown) {
  console.error("Avatar operation failed", error instanceof Error ? error.message : "Unknown error");
}

export async function POST(request: Request) {
  return handleAvatarUpload(request, {
    authenticate: async (currentRequest) => {
      try {
        return (await requireActiveSession(currentRequest)).identity.id;
      } catch {
        return null;
      }
    },
    store: storeAvatar,
    replaceReferences: replaceAvatarReferences,
    remove: removeAvatarObject,
    reportFailure: reportAvatarFailure,
  });
}
