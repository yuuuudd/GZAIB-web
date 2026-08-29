import { handleAvatarUpload, storeAvatar } from "../../../../features/directory/avatar";
import { requireSession } from "../../../../features/identity/session";
import { removeAvatarObject, replaceAvatarReferences } from "../../../../lib/r2";

function reportAvatarFailure(error: unknown) {
  console.error("Avatar operation failed", error instanceof Error ? error.message : "Unknown error");
}

export async function POST(request: Request) {
  return handleAvatarUpload(request, {
    authenticate: async (currentRequest) => {
      try {
        return (await requireSession(currentRequest)).identity.id;
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
