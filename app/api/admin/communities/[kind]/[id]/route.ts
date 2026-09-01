import {
  authorizeAdminRoute,
  type AdminRouteDependencies,
} from "../../../../../../features/admin/authorization";
import {
  CommunityAdminError,
  createRuntimeCommunityAdminService,
  parseCommunityReviewAction,
  type CommunityAdminService,
  type CommunityReviewKind,
} from "../../../../../../features/admin/communities";
import { requireActiveSession } from "../../../../../../features/identity/active-account";
import { isDemoMode } from "../../../../../../features/identity/demo-auth";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ kind: string; id: string }> };

export type CommunityAdminRouteDependencies = AdminRouteDependencies & {
  service(): Pick<CommunityAdminService, "review"> | Promise<Pick<CommunityAdminService, "review">>;
  now(): number;
};

const privateHeaders = { "Cache-Control": "private, no-store" };

const runtimeDependencies: CommunityAdminRouteDependencies = {
  isDemoMode,
  requireSession: requireActiveSession,
  service: createRuntimeCommunityAdminService,
  now: Date.now,
};

function target(value: { kind: string; id: string }): { kind: CommunityReviewKind; id: string } {
  if (value.kind !== "profile" && value.kind !== "claim" && value.kind !== "update") {
    throw new CommunityAdminError("invalid_target", "审核类型无效");
  }
  const id = value.id;
  const hasControlCharacter = [...id].some((character) => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127);
  if (!id || id.length > 160 || id.trim() !== id || id.normalize("NFKC") !== id || hasControlCharacter) {
    throw new CommunityAdminError("invalid_target", "审核记录无效");
  }
  return { kind: value.kind, id };
}

/** Shared review boundary. authorizeAdminRoute always runs before params, JSON, or service resolution. */
export async function handleCommunityAdminReview(
  request: Request,
  context: RouteContext,
  dependencies: CommunityAdminRouteDependencies,
): Promise<Response> {
  const authorization = await authorizeAdminRoute(request, dependencies);
  if (!authorization.ok) {
    authorization.response.headers.set("Cache-Control", "private, no-store");
    return authorization.response;
  }

  try {
    const reviewTarget = target(await context.params);
    const action = parseCommunityReviewAction(await request.json());
    const result = await (await dependencies.service()).review(
      authorization.adminId,
      reviewTarget.kind,
      reviewTarget.id,
      action,
      dependencies.now(),
    );
    return Response.json({ review: { kind: result.kind, id: result.id, status: result.status } }, { headers: privateHeaders });
  } catch (error) {
    if (error instanceof CommunityAdminError) {
      const status = error.code === "state_changed" ? 409 : 400;
      return Response.json(
        { error: status === 409 ? "审核状态已变化，请刷新后重试" : "审核操作无效" },
        { status, headers: privateHeaders },
      );
    }
    if (error instanceof SyntaxError) {
      return Response.json({ error: "审核操作无效" }, { status: 400, headers: privateHeaders });
    }
    console.error("Community admin review failed");
    return Response.json({ error: "暂时无法完成审核" }, { status: 500, headers: privateHeaders });
  }
}

export async function POST(request: Request, context: RouteContext) {
  return handleCommunityAdminReview(request, context, runtimeDependencies);
}
