import { createRuntimeSafetyService, SafetyServiceError } from "../../../../features/safety/service";
import { requireRequestUserSession } from "../../../../features/identity/request-user";

const headers = { "Cache-Control": "private, no-store" };
async function actor(request: Request) { try { return (await requireRequestUserSession(request)).identity.id; } catch { return undefined; } }
function failure(error: unknown) {
  if (error instanceof SafetyServiceError) return Response.json({ error: error.code === "not_found" ? "成员不可用" : "请求无效" }, { status: error.code === "not_found" ? 404 : error.code === "invalid_target" ? 400 : 409, headers });
  return Response.json({ error: "暂时无法处理请求" }, { status: 503, headers });
}
export async function GET(request: Request) {
  const userId = await actor(request); if (!userId) return Response.json({ error: "请先登录有效账号" }, { status: 401, headers });
  try { return Response.json({ items: await (await createRuntimeSafetyService()).listBlockedUsers(userId) }, { headers }); } catch (error) { return failure(error); }
}
export async function POST(request: Request) {
  const userId = await actor(request); if (!userId) return Response.json({ error: "请先登录有效账号" }, { status: 401, headers });
  try { const body = await request.json(); if (!body || typeof body !== "object" || Array.isArray(body) || Object.keys(body).length !== 1 || typeof (body as { memberSlug?: unknown }).memberSlug !== "string") throw new SafetyServiceError("invalid_target"); const service = await createRuntimeSafetyService(); const blockedId = await service.resolvePublicMemberId((body as { memberSlug: string }).memberSlug); if (!blockedId) throw new SafetyServiceError("not_found"); await service.blockUser(userId, blockedId, Date.now()); return Response.json({ blocked: true }, { status: 201, headers }); } catch (error) { return failure(error); }
}
export async function DELETE(request: Request) {
  const userId = await actor(request); if (!userId) return Response.json({ error: "请先登录有效账号" }, { status: 401, headers });
  try { const body = await request.json(); if (!body || typeof body !== "object" || Array.isArray(body) || Object.keys(body).length !== 1 || typeof (body as { blockedId?: unknown }).blockedId !== "string") throw new SafetyServiceError("invalid_target"); await (await createRuntimeSafetyService()).unblockUser(userId, (body as { blockedId: string }).blockedId); return new Response(null, { status: 204, headers }); } catch (error) { return failure(error); }
}
