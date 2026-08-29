import { authorizeAdminRoute } from "../../../../features/admin/authorization";
import { isDemoMode } from "../../../../features/identity/demo-auth";
import { requireSession } from "../../../../features/identity/session";
import { createRuntimeDemoSeedRepository, seedDemoData } from "../../../../db/demo-seed";

export async function POST(request: Request) {
  const authorization = await authorizeAdminRoute(request, { isDemoMode, requireSession });
  if (!authorization.ok) return authorization.response;
  try {
    const counts = await seedDemoData(authorization.adminId, await createRuntimeDemoSeedRepository(), Date.now());
    return Response.json({ initialized: true, counts });
  } catch (error) {
    console.error("Unable to initialize Demo data", error);
    return Response.json({ error: "Unable to initialize Demo data" }, { status: 500 });
  }
}
