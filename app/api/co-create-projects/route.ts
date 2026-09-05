import { validateCoCreateProject, type CoCreateProjectInput } from "../../../features/co-create/projects";
import { resolveRequestUserId } from "../../../features/identity/request-user";

type Write = CoCreateProjectInput & { id: string; ownerUserId: string; createdAt: number; updatedAt: number };
export type CreateProjectDependencies = {
  resolveUserId(request: Request): Promise<string | null>;
  create(input: Write): Promise<{ id: string; publishStatus: "published" }>;
  id(): string;
  now(): number;
};

const privateHeaders = { "Cache-Control": "private, no-store" };

export async function handleCreateCoCreateProject(request: Request, dependencies: CreateProjectDependencies) {
  let userId: string | null;
  try { userId = await dependencies.resolveUserId(request); }
  catch { return Response.json({ error: "暂时无法验证登录状态" }, { status: 500, headers: privateHeaders }); }
  if (!userId) return Response.json({ error: "请先登录后再发起共创" }, { status: 401, headers: privateHeaders });
  let body: unknown;
  try { body = await request.json(); }
  catch { return Response.json({ error: "项目格式不正确" }, { status: 400, headers: privateHeaders }); }
  const validated = validateCoCreateProject(body);
  if (!validated.ok) return Response.json({ error: validated.errors[0] }, { status: 400, headers: privateHeaders });
  const now = dependencies.now();
  try {
    const saved = await dependencies.create({ ...validated.value, id: dependencies.id(), ownerUserId: userId, createdAt: now, updatedAt: now });
    return Response.json({ project: saved }, { status: 201, headers: privateHeaders });
  } catch { return Response.json({ error: "暂时无法保存项目" }, { status: 500, headers: privateHeaders }); }
}

const runtimeDependencies: CreateProjectDependencies = {
  resolveUserId: resolveRequestUserId, id: () => crypto.randomUUID(), now: Date.now,
  async create(input) {
    const [{ getDb }, { createCoCreateProjectRepository }] = await Promise.all([import("../../../db"), import("../../../lib/db/repositories/co-create-projects")]);
    return createCoCreateProjectRepository(getDb()).create(input);
  },
};

export function POST(request: Request) { return handleCreateCoCreateProject(request, runtimeDependencies); }
