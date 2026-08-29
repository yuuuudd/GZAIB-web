import { requireActiveSession } from "../../../../../features/identity/active-account";
import { createRuntimeSafetyService } from "../../../../../features/safety/service";
type Context = { params: Promise<{ id: string }> };
export async function GET(request: Request, context: Context) {
  let session; try { session = await requireActiveSession(request); } catch { return Response.json({ error: "请先登录有效账号" }, { status: 401, headers: { "Cache-Control": "private, no-store" } }); }
  const report = await (await createRuntimeSafetyService()).getOwnReport(session.identity.id, (await context.params).id);
  if (!report) return Response.json({ error: "举报记录不存在" }, { status: 404, headers: { "Cache-Control": "private, no-store" } });
  return Response.json({ report }, { headers: { "Cache-Control": "private, no-store" } });
}
