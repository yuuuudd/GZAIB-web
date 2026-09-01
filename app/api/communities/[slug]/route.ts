import { createRuntimeCommunityDirectoryService } from "../../../../features/communities/service";
import type { PublicCommunity } from "../../../../features/communities/types";
import { resolveRequestUserId } from "../../../../features/identity/request-user";

const publicCache = { "Cache-Control": "public, max-age=60, stale-while-revalidate=300" };
const privateCache = { "Cache-Control": "private, no-store" };

type CommunityDetailService = { getBySlug(slug: string, viewerId?: string): Promise<PublicCommunity | undefined> };
export type CommunityDetailDependencies = {
  viewerId(request: Request): Promise<string | null>;
  service(): CommunityDetailService | Promise<CommunityDetailService>;
};
type RouteContext = { params: Promise<{ slug: string }> };

const runtimeDependencies: CommunityDetailDependencies = {
  viewerId: resolveRequestUserId,
  service: createRuntimeCommunityDirectoryService,
};

export async function handleCommunityDetail(request: Request, context: RouteContext, dependencies: CommunityDetailDependencies): Promise<Response> {
  const slug = (await context.params).slug;
  if (!/^[a-z0-9][a-z0-9-]{0,79}$/.test(slug)) return Response.json({ error: "社群不存在" }, { status: 404, headers: publicCache });
  let viewerId: string | undefined;
  try { viewerId = (await dependencies.viewerId(request)) ?? undefined; } catch { viewerId = undefined; }
  try {
    const community = await (await dependencies.service()).getBySlug(slug, viewerId);
    if (!community) return Response.json({ error: "社群不存在" }, { status: 404, headers: publicCache });
    return Response.json({ community }, { headers: viewerId ? privateCache : publicCache });
  } catch (error) {
    console.error("Unable to load public community", error);
    return Response.json({ error: "社群资料暂时无法读取" }, { status: 503, headers: publicCache });
  }
}

export async function GET(request: Request, context: RouteContext) {
  return handleCommunityDetail(request, context, runtimeDependencies);
}
