import { createRuntimeSafetyService, SafetyServiceError } from "../../../features/safety/service";
import { requireRequestUserSession } from "../../../features/identity/request-user";
const headers = { "Cache-Control": "private, no-store" };
export async function POST(request: Request) {
  let session; try { session = await requireRequestUserSession(request); } catch { return Response.json({ error: "请先登录有效账号" }, { status: 401, headers }); }
  try { const body = await request.json(); if (!body || typeof body !== "object" || Array.isArray(body) || typeof (body as { targetMemberSlug?: unknown }).targetMemberSlug !== "string") throw new SafetyServiceError("invalid_report"); const service = await createRuntimeSafetyService(); const targetUserId = await service.resolvePublicMemberId((body as { targetMemberSlug: string }).targetMemberSlug); if (!targetUserId) throw new SafetyServiceError("not_found"); const input = { ...(body as Record<string, unknown>) }; delete input.targetMemberSlug; const report = await service.submitReport(session.identity.id, { ...input, targetUserId }, Date.now()); return Response.json({ report: { id: report.id, category: report.category, status: report.status } }, { status: 201, headers }); }
  catch (error) { const status = error instanceof SafetyServiceError && error.code === "invalid_report" ? 400 : error instanceof SafetyServiceError && error.code === "not_found" ? 404 : 503; return Response.json({ error: status === 400 ? "举报内容不符合要求" : "暂时无法提交举报" }, { status, headers }); }
}
