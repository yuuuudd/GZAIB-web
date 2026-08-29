import { authorizeAdminRoute } from "../../../../../features/admin/authorization";
import { isDemoMode } from "../../../../../features/identity/demo-auth";
import { requireSession } from "../../../../../features/identity/session";
import { parseReviewDecision, reviewApplication } from "../../../../../features/applications/review";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: RouteContext) {
  const authorization = await authorizeAdminRoute(request, { isDemoMode, requireSession });
  if (!authorization.ok) return authorization.response;
  try {
    const decision = parseReviewDecision(await request.json());
    const applicationId = (await context.params).id;
    const result = await reviewApplication(authorization.adminId, applicationId, decision, Date.now());
    return Response.json(result);
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Invalid review" }, { status: 400 });
  }
}
