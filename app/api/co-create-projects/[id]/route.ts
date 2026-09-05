import type { CoCreateProjectInput } from "../../../../features/co-create/projects";
import { validateCoCreateProject } from "../../../../features/co-create/projects";
import { resolveRequestUserId } from "../../../../features/identity/request-user";

export type UpdateProjectDependencies = {
  resolveUserId(request: Request): Promise<string | null>;
  updateOwned(id: string, ownerUserId: string, input: CoCreateProjectInput, updatedAt: number): Promise<boolean>;
  setPublishStatusOwned(id: string, ownerUserId: string, status: "published" | "archived", updatedAt: number): Promise<boolean>;
  now(): number;
};

const privateHeaders = { "Cache-Control": "private, no-store" };

export async function handleUpdateCoCreateProject(request: Request, id: string, dependencies: UpdateProjectDependencies) {
  let userId: string | null;
  try { userId = await dependencies.resolveUserId(request); }
  catch { return Response.json({ error: "暂时无法验证登录状态" }, { status: 500, headers: privateHeaders }); }
  if (!userId) return Response.json({ error: "请先登录" }, { status: 401, headers: privateHeaders });
  let body: unknown;
  try { body = await request.json(); }
  catch { return Response.json({ error: "项目格式不正确" }, { status: 400, headers: privateHeaders }); }
  const action = body && typeof body === "object" && !Array.isArray(body) ? (body as { action?: unknown }).action : undefined;
  let updated = false;
  if (action === "archive" || action === "publish") {
    updated = await dependencies.setPublishStatusOwned(id, userId, action === "archive" ? "archived" : "published", dependencies.now());
  } else {
    const validated = validateCoCreateProject(body);
    if (!validated.ok) return Response.json({ error: validated.errors[0] }, { status: 400, headers: privateHeaders });
    updated = await dependencies.updateOwned(id, userId, validated.value, dependencies.now());
  }
  if (!updated) return Response.json({ error: "项目不存在或无权修改" }, { status: 404, headers: privateHeaders });
  return Response.json({ ok: true }, { headers: privateHeaders });
}

async function dependencies(): Promise<UpdateProjectDependencies> {
  const [{ getDb }, { createCoCreateProjectRepository }] = await Promise.all([import("../../../../db"), import("../../../../lib/db/repositories/co-create-projects")]);
  const repository = createCoCreateProjectRepository(getDb());
  return { resolveUserId: resolveRequestUserId, updateOwned: repository.updateOwned, setPublishStatusOwned: repository.setPublishStatusOwned, now: Date.now };
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  return handleUpdateCoCreateProject(request, (await context.params).id, await dependencies());
}
