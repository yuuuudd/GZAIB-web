import { authorizeAdminRoute } from "../../../../../features/admin/authorization";
import { createRuntimeMemberStatusService, parseMemberStatusAction } from "../../../../../features/admin/member-status";
import { isDemoMode } from "../../../../../features/identity/demo-auth";
import { requireActiveSession } from "../../../../../features/identity/active-account";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: RouteContext) {
  const authorization = await authorizeAdminRoute(request, { isDemoMode, requireSession: requireActiveSession });
  if (!authorization.ok) return authorization.response;
  try {
    const action = parseMemberStatusAction(await request.json());
    const service = await createRuntimeMemberStatusService();
    return Response.json(await service.updateMemberStatus(authorization.adminId, (await context.params).id, action, Date.now()));
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Invalid member action" }, { status: 400 });
  }
}
