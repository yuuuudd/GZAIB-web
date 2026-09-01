import {
  CommunityMutationError,
  createRuntimeCommunityMutationService,
  type CommunityMutationService,
} from "../../../features/communities/service";
import { resolveRequestUserId } from "../../../features/identity/request-user";

export type CommunitySubmissionDependencies = {
  resolveUserId(request: Request): Promise<string | null>;
  service(): Pick<CommunityMutationService, "submitProfile"> | Promise<Pick<CommunityMutationService, "submitProfile">>;
  now(): number;
};

const runtimeDependencies: CommunitySubmissionDependencies = {
  resolveUserId: resolveRequestUserId,
  service: createRuntimeCommunityMutationService,
  now: Date.now,
};

const privateHeaders = { "Cache-Control": "private, no-store" };

function submissionInput(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new CommunityMutationError("投稿资料格式不正确");
  const { kind, communityId, ...profile } = value as Record<string, unknown>;
  return { kind, communityId: communityId === undefined ? null : communityId, profile };
}

export async function handleCommunitySubmission(request: Request, dependencies: CommunitySubmissionDependencies): Promise<Response> {
  let userId: string | null = null;
  try { userId = await dependencies.resolveUserId(request); } catch {
    console.error("Community profile submission identity resolution failed");
    return Response.json({ error: "暂时无法验证登录状态" }, { status: 500, headers: privateHeaders });
  }
  if (!userId) return Response.json({ error: "请先登录后再提交社群" }, { status: 401, headers: privateHeaders });
  let body: unknown;
  try { body = await request.json(); } catch { return Response.json({ error: "投稿资料格式不正确" }, { status: 400, headers: privateHeaders }); }
  try {
    const input = submissionInput(body);
    const submission = await (await dependencies.service()).submitProfile(
      userId,
      input.kind as "create" | "update",
      input.communityId as string | null,
      input.profile,
      dependencies.now(),
    );
    return Response.json({ submission: {
      id: submission.id,
      kind: submission.kind,
      communityId: submission.communityId,
      status: submission.status,
      submittedAt: submission.submittedAt,
    } }, { status: 201, headers: privateHeaders });
  } catch (error) {
    if (error instanceof CommunityMutationError) return Response.json({ error: error.message }, { status: 400, headers: privateHeaders });
    console.error("Community profile submission storage failed");
    return Response.json({ error: "暂时无法提交社群资料" }, { status: 500, headers: privateHeaders });
  }
}

export async function POST(request: Request) {
  return handleCommunitySubmission(request, runtimeDependencies);
}
