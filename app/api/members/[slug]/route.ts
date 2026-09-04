import { createRuntimeProfileAccessService, resolveRuntimeProfileViewer } from "../../../../features/directory/profile-access";
import { resolveConnectionCtaState } from "../../../../features/connections/cta-state";
import { resolvePublicConnectionRecipientId } from "../../../../features/connections/recipient-resolver";
import { createConnectionRepository } from "../../../../lib/db/repositories/connections";
import { getDb } from "../../../../db";

type RouteContext = { params: Promise<{ slug: string }> };

export async function GET(request: Request, context: RouteContext) {
  const slug = (await context.params).slug;
  if (!slug || slug.length > 160) return Response.json({ error: "成员不存在" }, { status: 404 });
  try {
    const viewer = await resolveRuntimeProfileViewer(request);
    const [profile, connection] = await Promise.all([
      (await createRuntimeProfileAccessService()).getProfile(slug, viewer),
      resolveConnectionCtaState(viewer, slug, {
        resolveRecipientId: resolvePublicConnectionRecipientId,
        repository: createConnectionRepository(getDb()),
        now: Date.now,
      }),
    ]);
    return profile
      ? Response.json({ profile, connection }, { headers: { "Cache-Control": "private, no-store" } })
      : Response.json({ error: "成员不存在" }, { status: 404 });
  } catch (error) {
    console.error("Unable to load public member", error);
    return Response.json({ error: "成员资料暂时无法读取" }, { status: 503 });
  }
}
