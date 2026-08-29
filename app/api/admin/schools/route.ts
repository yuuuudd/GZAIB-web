import { authorizeAdminRoute } from "../../../../features/admin/authorization";
import { createRuntimeSchoolAdminService, parseSchoolAdminAction } from "../../../../features/admin/schools";
import { isDemoMode } from "../../../../features/identity/demo-auth";
import { requireSession } from "../../../../features/identity/session";

export async function POST(request: Request) {
  const authorization = await authorizeAdminRoute(request, { isDemoMode, requireSession });
  if (!authorization.ok) return authorization.response;
  try {
    const action = parseSchoolAdminAction(await request.json());
    const service = await createRuntimeSchoolAdminService();
    const result = action.action === "propose"
      ? await service.proposeSchool(authorization.adminId, action, Date.now())
      : await service.confirmSchoolCoordinate(authorization.adminId, action.schoolId, Date.now());
    return Response.json(result);
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Invalid school action" }, { status: 400 });
  }
}
