import { createRuntimeProfileAccessService, resolveRuntimeProfileViewer } from "../../../../features/directory/profile-access";

type RouteContext = { params: Promise<{ slug: string }> };

export async function GET(request: Request, context: RouteContext) {
  const slug = (await context.params).slug;
  if (!slug || slug.length > 160) return Response.json({ error: "成员不存在" }, { status: 404 });
  try {
    const profile = await (await createRuntimeProfileAccessService()).getProfile(slug, await resolveRuntimeProfileViewer(request));
    return profile
      ? Response.json({ profile }, { headers: { "Cache-Control": "private, no-store" } })
      : Response.json({ error: "成员不存在" }, { status: 404 });
  } catch (error) {
    console.error("Unable to load public member", error);
    return Response.json({ error: "成员资料暂时无法读取" }, { status: 503 });
  }
}
