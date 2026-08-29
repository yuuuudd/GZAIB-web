import { createApplicationRepository } from "../../../lib/db/repositories/applications";
import { getDb } from "../../../db";
import { ApplicationServiceError, createApplicationService } from "../../../features/applications/service";
import { requireActiveSession } from "../../../features/identity/active-account";

async function currentUserId(request: Request): Promise<string | null> {
  try {
    return (await requireActiveSession(request)).identity.id;
  } catch {
    return null;
  }
}

function service() {
  return createApplicationService(createApplicationRepository(getDb()));
}

export async function GET(request: Request) {
  const userId = await currentUserId(request);
  if (!userId) return Response.json({ error: "请先选择演示身份" }, { status: 401 });
  try {
    return Response.json({ application: await service().getApplicationStatus(userId) });
  } catch (error) {
    console.error("Unable to get application", error);
    return Response.json({ error: "暂时无法读取申请状态" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const userId = await currentUserId(request);
  if (!userId) return Response.json({ error: "请先选择演示身份" }, { status: 401 });
  let input: unknown;
  try {
    input = await request.json();
  } catch {
    return Response.json({ error: "申请资料格式不正确" }, { status: 400 });
  }
  try {
    const application = await service().submitApplication(userId, input, Date.now());
    return Response.json({ application }, { status: 201 });
  } catch (error) {
    if (error instanceof ApplicationServiceError) return Response.json({ error: error.message }, { status: 400 });
    console.error("Unable to submit application", error);
    return Response.json({ error: "暂时无法提交申请" }, { status: 500 });
  }
}
