import { authorizeAdminRoute } from "../../../../../features/admin/authorization";
import { isDemoMode } from "../../../../../features/identity/demo-auth";
import { requireActiveSession } from "../../../../../features/identity/active-account";
import { createRuntimeSafetyService, SafetyServiceError } from "../../../../../features/safety/service";
import { REPORT_RESOLUTIONS } from "../../../../../features/safety/types";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ id: string }> };
export async function POST(request: Request, context: Context) {
  const authorization = await authorizeAdminRoute(request, { isDemoMode, requireSession: requireActiveSession });
  if (!authorization.ok) { authorization.response.headers.set("Cache-Control", "private, no-store"); return authorization.response; }
  try { const body = await request.json(); const resolution = body && typeof body === "object" && !Array.isArray(body) && Object.keys(body as object).length === 1 ? (body as { resolution?: unknown }).resolution : undefined; if (!REPORT_RESOLUTIONS.includes(resolution as never)) throw new SafetyServiceError("invalid_resolution"); const report = await (await createRuntimeSafetyService()).resolveReport(authorization.adminId, (await context.params).id, resolution as never, Date.now()); return Response.json({ report: { id: report.id, status: report.status, resolution: report.resolution } }, { headers: { "Cache-Control": "private, no-store" } }); }
  catch (error) { const status = error instanceof SafetyServiceError && error.code === "state_conflict" ? 409 : 400; return Response.json({ error: status === 409 ? "该举报已被处理" : "处理操作无效" }, { status, headers: { "Cache-Control": "private, no-store" } }); }
}
