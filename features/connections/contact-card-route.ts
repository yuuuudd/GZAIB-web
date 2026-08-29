import { createOwnContactCardHandler, type createContactCardService } from "./contact-card";

type ContactCardService = ReturnType<typeof createContactCardService>;
type ActiveSession = { identity: { id: string } };

const privateHeaders = { "Cache-Control": "private, no-store" };

/** Dependency-injected route delegate; the Next entry point supplies the real session and D1 service. */
export function createContactCardRouteHandlers(dependencies: {
  requireActiveSession(request: Request): Promise<ActiveSession>;
  createService(): ContactCardService;
}) {
  async function handler(request: Request) {
    let session: ActiveSession;
    try { session = await dependencies.requireActiveSession(request); }
    catch { return undefined; }
    try {
      return createOwnContactCardHandler({
        requireSession: async () => session,
        service: dependencies.createService(),
        now: () => Date.now(),
      });
    } catch { return null; }
  }
  return {
    async GET(request: Request) {
      const route = await handler(request);
      if (route === undefined) return Response.json({ error: "请先登录有效账号" }, { status: 401, headers: privateHeaders });
      if (route === null) return Response.json({ error: "联系方式暂时不可用" }, { status: 503, headers: privateHeaders });
      return route.GET(request);
    },
    async PUT(request: Request) {
      const route = await handler(request);
      if (route === undefined) return Response.json({ error: "请先登录有效账号" }, { status: 401, headers: privateHeaders });
      if (route === null) return Response.json({ error: "联系方式暂时不可用" }, { status: 503, headers: privateHeaders });
      return route.PUT(request);
    },
  };
}
