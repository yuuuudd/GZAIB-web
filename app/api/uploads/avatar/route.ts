import { handleAvatarUpload, storeAvatar } from "../../../../features/directory/avatar";
import { resolveRequestUserId } from "../../../../features/identity/request-user";
import { removeAvatarObject, replaceAvatarReferences } from "../../../../lib/r2";

function reportAvatarFailure(error: unknown) {
  console.error("Avatar operation failed", error instanceof Error ? error.message : "Unknown error");
}

export async function POST(request: Request) {
  return handleAvatarUpload(request, {
    authenticate: async (currentRequest) => {
      try {
        return await resolveRequestUserId(currentRequest);
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
