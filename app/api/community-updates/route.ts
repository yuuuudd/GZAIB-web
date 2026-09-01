import {
  CommunityMutationError,
  createRuntimeCommunityMutationService,
  type CommunityMutationService,
} from "../../../features/communities/service";
import { resolveRequestUserId } from "../../../features/identity/request-user";

export type CommunityUpdateDependencies = {
  resolveUserId(request: Request): Promise<string | null>;
  service(): Pick<CommunityMutationService, "submitUpdate"> | Promise<Pick<CommunityMutationService, "submitUpdate">>;
  now(): number;
};

const runtimeDependencies: CommunityUpdateDependencies = {
  resolveUserId: resolveRequestUserId,
  service: createRuntimeCommunityMutationService,
  now: Date.now,
};

const privateHeaders = { "Cache-Control": "private, no-store" };

export async function handleCommunityUpdate(request: Request, dependencies: CommunityUpdateDependencies): Promise<Response> {
  let userId: string | null = null;
  try { userId = await dependencies.resolveUserId(request); } catch {
    console.error("Community update identity resolution failed");
    return Response.json({ error: "暂时无法验证登录状态" }, { status: 500, headers: privateHeaders });
  }
  if (!userId) return Response.json({ error: "请先登录后再提交社群动态" }, { status: 401, headers: privateHeaders });
  let input: unknown;
  try { input = await request.json(); } catch { return Response.json({ error: "社群动态格式不正确" }, { status: 400, headers: privateHeaders }); }
  try {
    const update = await (await dependencies.service()).submitUpdate(userId, input, dependencies.now());
    return Response.json({ update: {
      id: update.id,
      communityId: update.communityId,
      status: update.status,
      submittedAt: update.submittedAt,
    } }, { status: 201, headers: privateHeaders });
  } catch (error) {
    if (error instanceof CommunityMutationError) return Response.json({ error: error.message }, { status: 400, headers: privateHeaders });
    console.error("Community update storage failed");
    return Response.json({ error: "暂时无法提交社群动态" }, { status: 500, headers: privateHeaders });
  }
}

export async function POST(request: Request) {
  return handleCommunityUpdate(request, runtimeDependencies);
}
