import { createRuntimeCommunityDirectoryService, type CommunityDirectoryResult } from "../../../features/communities/service";
import type { CommunityDirectoryQuery } from "../../../features/communities/types";
import { resolveRequestUserId } from "../../../features/identity/request-user";

const publicCache = { "Cache-Control": "public, max-age=60, stale-while-revalidate=300" };
const privateCache = { "Cache-Control": "private, no-store" };

type CommunityListService = { list(query: CommunityDirectoryQuery, viewerId?: string): Promise<CommunityDirectoryResult> };
export type CommunityListDependencies = {
  viewerId(request: Request): Promise<string | null>;
  service(): CommunityListService | Promise<CommunityListService>;
};

function queryFromRequest(request: Request): CommunityDirectoryQuery | undefined {
  const url = new URL(request.url);
  const take = (name: string) => {
    const value = url.searchParams.get(name);
    if (value === null) return undefined;
    return value.length <= 100 ? value : null;
  };
  const q = take("q"); const city = take("city"); const locationMode = take("locationMode"); const focus = take("focus");
  if ([q, city, locationMode, focus].some((value) => value === null)) return undefined;
  if (locationMode !== undefined && locationMode !== "city" && locationMode !== "hybrid" && locationMode !== "online") return undefined;
  return {
    ...(q ? { q } : {}), ...(city ? { city } : {}), ...(locationMode ? { locationMode } : {}), ...(focus ? { focus } : {}),
  };
}

const runtimeDependencies: CommunityListDependencies = {
  viewerId: resolveRequestUserId,
  service: createRuntimeCommunityDirectoryService,
};

export async function handleCommunityList(request: Request, dependencies: CommunityListDependencies): Promise<Response> {
  const query = queryFromRequest(request);
  if (!query) return Response.json({ error: "社群目录筛选条件不正确" }, { status: 400, headers: publicCache });
  let viewerId: string | undefined;
  try { viewerId = (await dependencies.viewerId(request)) ?? undefined; } catch { viewerId = undefined; }
  try {
    const result = await (await dependencies.service()).list(query, viewerId);
    return Response.json(result, { headers: viewerId ? privateCache : publicCache });
  } catch (error) {
    console.error("Unable to load public communities", error);
    return Response.json({ error: "社群目录暂时无法读取" }, { status: 503, headers: publicCache });
  }
}

export async function GET(request: Request) {
  return handleCommunityList(request, runtimeDependencies);
}
