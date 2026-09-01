import { validateActivityProposal, type ActivityProposalInput } from "../../../features/activities/proposals";
import { resolveRequestUserId } from "../../../features/identity/request-user";

type SavedProposal = { id: string; status: "pending" };
type ProposalWrite = ActivityProposalInput & { id: string; userId: string; submittedAt: number };

export type ActivityProposalDependencies = {
  resolveUserId(request: Request): Promise<string | null>;
  save(input: ProposalWrite): Promise<SavedProposal>;
  now(): number;
  id(): string;
};

const privateHeaders = { "Cache-Control": "private, no-store" };

export async function handleActivityProposal(request: Request, dependencies: ActivityProposalDependencies): Promise<Response> {
  let userId: string | null;
  try { userId = await dependencies.resolveUserId(request); }
  catch { return Response.json({ error: "暂时无法验证登录状态" }, { status: 500, headers: privateHeaders }); }
  if (!userId) return Response.json({ error: "请先登录后再申请共建活动" }, { status: 401, headers: privateHeaders });
  let body: unknown;
  try { body = await request.json(); }
  catch { return Response.json({ error: "活动申请格式不正确" }, { status: 400, headers: privateHeaders }); }
  const validated = validateActivityProposal(body);
  if (!validated.ok) return Response.json({ error: validated.errors[0] }, { status: 400, headers: privateHeaders });
  try {
    const saved = await dependencies.save({ ...validated.value, id: dependencies.id(), userId, submittedAt: dependencies.now() });
    return Response.json({ proposal: saved }, { status: 201, headers: privateHeaders });
  } catch {
    return Response.json({ error: "暂时无法保存活动申请" }, { status: 500, headers: privateHeaders });
  }
}

const runtimeDependencies: ActivityProposalDependencies = {
  resolveUserId: resolveRequestUserId,
  id: () => crypto.randomUUID(),
  now: Date.now,
  async save(input) {
    const [{ getDb }, { activityProposals }] = await Promise.all([import("../../../db"), import("../../../db/schema")]);
    await getDb().insert(activityProposals).values({
      id: input.id, userId: input.userId, title: input.title, summary: input.summary,
      stage: input.stage as "idea" | "preparing" | "scheduled", timeNote: input.timeNote ?? null,
      location: input.location ?? null, supportNeeded: input.supportNeeded ?? null,
      linksJson: JSON.stringify(input.links), status: "pending", submittedAt: input.submittedAt, updatedAt: input.submittedAt,
    });
    return { id: input.id, status: "pending" };
  },
};

export async function POST(request: Request) {
  return handleActivityProposal(request, runtimeDependencies);
}
