import {
  CommunityMutationError,
  createRuntimeCommunityMutationService,
  type CommunityMutationService,
} from "../../../features/communities/service";
import { resolveRequestUserId } from "../../../features/identity/request-user";

export type CommunityClaimDependencies = {
  resolveUserId(request: Request): Promise<string | null>;
  service(): Pick<CommunityMutationService, "submitClaim"> | Promise<Pick<CommunityMutationService, "submitClaim">>;
  now(): number;
};

const runtimeDependencies: CommunityClaimDependencies = {
  resolveUserId: resolveRequestUserId,
  service: createRuntimeCommunityMutationService,
  now: Date.now,
};

const privateHeaders = { "Cache-Control": "private, no-store" };

export async function handleCommunityClaim(request: Request, dependencies: CommunityClaimDependencies): Promise<Response> {
  let userId: string | null = null;
  try { userId = await dependencies.resolveUserId(request); } catch {
    console.error("Community claim identity resolution failed");
    return Response.json({ error: "暂时无法验证登录状态" }, { status: 500, headers: privateHeaders });
  }
  if (!userId) return Response.json({ error: "请先登录后再认领社群" }, { status: 401, headers: privateHeaders });
  let input: unknown;
  try { input = await request.json(); } catch { return Response.json({ error: "认领资料格式不正确" }, { status: 400, headers: privateHeaders }); }
  try {
    const claim = await (await dependencies.service()).submitClaim(userId, input, dependencies.now());
    return Response.json({ claim: {
      id: claim.id,
      communityId: claim.communityId,
      status: claim.status,
      submittedAt: claim.submittedAt,
    } }, { status: 201, headers: privateHeaders });
  } catch (error) {
    if (error instanceof CommunityMutationError) return Response.json({ error: error.message }, { status: 400, headers: privateHeaders });
    console.error("Community claim storage failed");
    return Response.json({ error: "暂时无法提交社群认领" }, { status: 500, headers: privateHeaders });
  }
}

export async function POST(request: Request) {
  return handleCommunityClaim(request, runtimeDependencies);
}
