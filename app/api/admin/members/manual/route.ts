import { getDb } from "../../../../../db";
import { authorizeAdminRoute } from "../../../../../features/admin/authorization";
import { createManualMemberService } from "../../../../../features/admin/manual-members";
import { isDemoMode } from "../../../../../features/identity/demo-auth";
import { requireActiveSession } from "../../../../../features/identity/active-account";
import { createManualMemberRepository } from "../../../../../lib/db/repositories/manual-members";

export async function POST(request: Request) {
  const authorization = await authorizeAdminRoute(request, { isDemoMode, requireSession: requireActiveSession });
  if (!authorization.ok) return authorization.response;
  try { const result = await createManualMemberService(createManualMemberRepository(getDb())).create(await request.json(), authorization.adminId, Date.now()); return Response.json({ id: result.profile.id, slug: result.profile.slug, publishStatus: result.profile.publishStatus }, { status: 201 }); }
  catch (error) { return Response.json({ error: error instanceof Error ? error.message : "Invalid manual member input" }, { status: 400 }); }
}
