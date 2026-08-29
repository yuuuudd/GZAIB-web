import { NextResponse } from "next/server";
import { getDb } from "../../../../db";
import { ensureDemoIdentity } from "../../../../lib/db/repositories/identity";
import { isDemoMode, readDemoLoginRequest, resolveDemoIdentity } from "../../../../features/identity/demo-auth";
import { createDemoSession, serializeDemoSessionCookie } from "../../../../features/identity/session";

export async function POST(request: Request) {
  if (!isDemoMode()) return NextResponse.json({ error: "Demo mode is disabled" }, { status: 403 });

  try {
    const body = await readDemoLoginRequest(request);
    const now = Date.now();
    const identity = resolveDemoIdentity(body.identity);
    await ensureDemoIdentity(getDb(), identity, now);

    const response = new NextResponse(null, {
      status: 303,
      headers: { Location: body.returnTo ?? "/" },
    });
    response.headers.append("Set-Cookie", serializeDemoSessionCookie(await createDemoSession(body.identity, now), now));
    return response;
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to start demo session" }, { status: 400 });
  }
}
