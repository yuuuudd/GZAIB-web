import {
  CommunityMutationError,
  createRuntimeCommunityMutationService,
  type CommunityMutationService,
} from "../../../features/communities/service";
import { resolveRequestUserId } from "../../../features/identity/request-user";

export type CommunityFollowDependencies = {
  resolveUserId(request: Request): Promise<string | null>;
  service(): Pick<CommunityMutationService, "setFollow"> | Promise<Pick<CommunityMutationService, "setFollow">>;
  now(): number;
};

const runtimeDependencies: CommunityFollowDependencies = {
  resolveUserId: resolveRequestUserId,
  service: createRuntimeCommunityMutationService,
  now: Date.now,
};

const privateHeaders = { "Cache-Control": "private, no-store" };

function followInput(value: unknown): { communityId: string; following: boolean } {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new CommunityMutationError("关注资料格式不正确");
  const input = value as Record<string, unknown>;
  const keys = Object.keys(input);
  if (keys.length !== 2 || !keys.includes("communityId") || !keys.includes("following")) throw new CommunityMutationError("关注资料包含不允许的字段");
  if (typeof input.communityId !== "string" || typeof input.following !== "boolean") throw new CommunityMutationError("关注资料格式不正确");
  return { communityId: input.communityId, following: input.following };
}

export async function handleCommunityFollow(request: Request, dependencies: CommunityFollowDependencies): Promise<Response> {
  let userId: string | null = null;
  try { userId = await dependencies.resolveUserId(request); } catch {
    console.error("Community follow identity resolution failed");
    return Response.json({ error: "暂时无法验证登录状态" }, { status: 500, headers: privateHeaders });
  }
  if (!userId) return Response.json({ error: "请先登录后再关注社群" }, { status: 401, headers: privateHeaders });
  let body: unknown;
  try { body = await request.json(); } catch { return Response.json({ error: "关注资料格式不正确" }, { status: 400, headers: privateHeaders }); }
  try {
    const input = followInput(body);
    await (await dependencies.service()).setFollow(userId, input.communityId, input.following, dependencies.now());
    return Response.json({ follow: input }, { headers: privateHeaders });
  } catch (error) {
    if (error instanceof CommunityMutationError) return Response.json({ error: error.message }, { status: 400, headers: privateHeaders });
    console.error("Community follow storage failed");
    return Response.json({ error: "暂时无法更新关注状态" }, { status: 500, headers: privateHeaders });
  }
}

export async function POST(request: Request) {
  return handleCommunityFollow(request, runtimeDependencies);
}
