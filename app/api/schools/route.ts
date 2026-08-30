import { createRuntimeSchoolAdminService, parseSchoolAdminAction } from "../../../features/admin/schools";
import { resolveRequestUserId } from "../../../features/identity/request-user";

type SelectedSchoolInput = { name: string; campus: string; city: string; longitude: number; latitude: number };
type SchoolSelectionService = { selectAmapSchool(actorId: string, input: SelectedSchoolInput, now: number): Promise<unknown> };

export type SchoolSelectionRouteDependencies = {
  authenticate(request: Request): Promise<string | null>;
  service(): SchoolSelectionService | Promise<SchoolSelectionService>;
  now(): number;
};

async function currentUserId(request: Request): Promise<string | null> {
  try {
    return await resolveRequestUserId(request);
  } catch {
    return null;
  }
}

export async function handleSchoolSelectionPost(request: Request, dependencies: SchoolSelectionRouteDependencies): Promise<Response> {
  const actorId = await dependencies.authenticate(request);
  if (!actorId) return Response.json({ error: "请先登录后再选择学校" }, { status: 401 });
  try {
    const action = parseSchoolAdminAction(await request.json());
    if (action.action !== "select_amap") throw new Error("Invalid school action");
    const { action: _action, ...input } = action;
    void _action;
    const school = await (await dependencies.service()).selectAmapSchool(actorId, input, dependencies.now());
    return Response.json(school, { status: 201 });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "学校保存失败" }, { status: 400 });
  }
}

const runtimeDependencies: SchoolSelectionRouteDependencies = {
  authenticate: currentUserId,
  service: createRuntimeSchoolAdminService,
  now: Date.now,
};

export async function POST(request: Request) {
  return handleSchoolSelectionPost(request, runtimeDependencies);
}
