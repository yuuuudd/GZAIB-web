import {
  ApplicationServiceError,
  getApplicationStatus,
  submitApplication,
  type ApplicationService,
} from "../../../features/applications/service";
import { requireActiveSession } from "../../../features/identity/active-account";

type ApplicationRouteService = Pick<ApplicationService, "getApplicationStatus" | "submitApplication">;

export type ApplicationRouteDependencies = {
  authenticate(request: Request): Promise<string | null>;
  service(): ApplicationRouteService | Promise<ApplicationRouteService>;
  now(): number;
};

async function currentUserId(request: Request): Promise<string | null> {
  try {
    return (await requireActiveSession(request)).identity.id;
  } catch {
    return null;
  }
}

/**
 * The route delegates to the feature runtime service, whose D1 adapter includes
 * the in-app NotificationSender. Keeping this object dependency-free also makes
 * the exact production wiring observable in the route regression test.
 */
export function runtimeApplicationRouteService(): ApplicationRouteService {
  return { getApplicationStatus, submitApplication };
}

export async function handleApplicationGet(request: Request, dependencies: ApplicationRouteDependencies) {
  const userId = await dependencies.authenticate(request);
  if (!userId) return Response.json({ error: "请先选择演示身份" }, { status: 401 });
  try {
    return Response.json({ application: await (await dependencies.service()).getApplicationStatus(userId) });
  } catch (error) {
    console.error("Unable to get application", error);
    return Response.json({ error: "暂时无法读取申请状态" }, { status: 500 });
  }
}

export async function handleApplicationPost(request: Request, dependencies: ApplicationRouteDependencies) {
  const userId = await dependencies.authenticate(request);
  if (!userId) return Response.json({ error: "请先选择演示身份" }, { status: 401 });
  let input: unknown;
  try {
    input = await request.json();
  } catch {
    return Response.json({ error: "申请资料格式不正确" }, { status: 400 });
  }
  try {
    const application = await (await dependencies.service()).submitApplication(userId, input, dependencies.now());
    return Response.json({ application }, { status: 201 });
  } catch (error) {
    if (error instanceof ApplicationServiceError) return Response.json({ error: error.message }, { status: 400 });
    console.error("Unable to submit application", error);
    return Response.json({ error: "暂时无法提交申请" }, { status: 500 });
  }
}

const runtimeDependencies: ApplicationRouteDependencies = {
  authenticate: currentUserId,
  service: runtimeApplicationRouteService,
  now: Date.now,
};

export async function GET(request: Request) {
  return handleApplicationGet(request, runtimeDependencies);
}

export async function POST(request: Request) {
  return handleApplicationPost(request, runtimeDependencies);
}
