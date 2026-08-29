import { getDb } from "../../../../db";
import { createContactCardService, createOwnContactCardHandler } from "../../../../features/connections/contact-card";
import { requireActiveSession } from "../../../../features/identity/active-account";
import { createContactCardRepository } from "../../../../lib/db/repositories/contact-cards";

const privateHeaders = { "Cache-Control": "private, no-store" };

async function handler(request: Request) {
  let session;
  try { session = await requireActiveSession(request); }
  catch { return undefined; }
  try {
    return createOwnContactCardHandler({
      requireSession: async () => session,
      service: createContactCardService(createContactCardRepository(getDb())),
      now: () => Date.now(),
    });
  } catch { return null; }
}

export async function GET(request: Request) {
  const route = await handler(request);
  if (route === undefined) return Response.json({ error: "请先登录有效账号" }, { status: 401, headers: privateHeaders });
  if (route === null) return Response.json({ error: "联系方式暂时不可用" }, { status: 503, headers: privateHeaders });
  return route.GET(request);
}

export async function PUT(request: Request) {
  const route = await handler(request);
  if (route === undefined) return Response.json({ error: "请先登录有效账号" }, { status: 401, headers: privateHeaders });
  if (route === null) return Response.json({ error: "联系方式暂时不可用" }, { status: 503, headers: privateHeaders });
  return route.PUT(request);
}
