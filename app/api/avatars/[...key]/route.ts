import { handleAvatarRead } from "../../../../features/directory/avatar";
import { readAvatarObject } from "../../../../lib/r2";

type RouteContext = { params: Promise<{ key: string[] }> };

export async function GET(_request: Request, context: RouteContext) {
  return handleAvatarRead((await context.params).key, readAvatarObject, (error) => {
    console.error("Avatar read failed", error instanceof Error ? error.message : "Unknown error");
  });
}
