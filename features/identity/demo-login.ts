import {
  DemoLoginValidationError,
  isDemoMode,
  readDemoLoginRequest,
  resolveDemoIdentity,
} from "./demo-auth";
import { createDemoSession, serializeDemoSessionCookie } from "./session";
import type { DemoIdentity } from "./types";

export type DemoLoginDependencies = {
  isDemoMode: typeof isDemoMode;
  now: () => number;
  ensureIdentity: (identity: DemoIdentity, now: number) => Promise<void>;
  createSession: typeof createDemoSession;
  serializeCookie: typeof serializeDemoSessionCookie;
  reportInternalFailure: (error: unknown) => void;
};

/** Keeps the HTTP boundary safe while allowing the D1 dependency to stay in the route adapter. */
export async function handleDemoLogin(request: Request, dependencies: DemoLoginDependencies): Promise<Response> {
  if (!dependencies.isDemoMode()) return Response.json({ error: "Demo mode is disabled" }, { status: 403 });

  let body;
  try {
    body = await readDemoLoginRequest(request);
  } catch (error) {
    if (error instanceof DemoLoginValidationError) {
      return Response.json({ error: error.message }, { status: 400 });
    }
    dependencies.reportInternalFailure(error);
    return Response.json({ error: "Unable to start demo session" }, { status: 500 });
  }

  try {
    const now = dependencies.now();
    const identity = resolveDemoIdentity(body.identity);
    await dependencies.ensureIdentity(identity, now);
    const session = await dependencies.createSession(body.identity, now);
    const response = new Response(null, { status: 303, headers: { Location: body.returnTo ?? "/" } });
    response.headers.append("Set-Cookie", dependencies.serializeCookie(session, now));
    return response;
  } catch (error) {
    dependencies.reportInternalFailure(error);
    return Response.json({ error: "Unable to start demo session" }, { status: 500 });
  }
}
