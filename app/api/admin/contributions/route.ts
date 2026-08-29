import { authorizeAdminRoute } from "../../../../features/admin/authorization";
import { confirmContribution, parseContributionInput } from "../../../../features/contributions/service";
import { isDemoMode } from "../../../../features/identity/demo-auth";
import { requireActiveSession } from "../../../../features/identity/active-account";

export async function POST(request: Request) {
  const authorization = await authorizeAdminRoute(request, { isDemoMode, requireSession: requireActiveSession });
  if (!authorization.ok) return authorization.response;
  try {
    const input = parseContributionInput(await request.json());
    return Response.json(await confirmContribution(authorization.adminId, input, Date.now()));
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Invalid contribution" }, { status: 400 });
  }
}
