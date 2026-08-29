import { getDb } from "../../../../db";
import { ensureDemoIdentity } from "../../../../lib/db/repositories/identity";
import { isDemoMode } from "../../../../features/identity/demo-auth";
import { handleDemoLogin } from "../../../../features/identity/demo-login";
import { createDemoSession, serializeDemoSessionCookie } from "../../../../features/identity/session";

function reportInternalFailure(error: unknown) {
  const secret = process.env.DEMO_SESSION_SECRET;
  const detail = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
  console.error("Demo login internal failure", secret ? detail.replaceAll(secret, "[REDACTED]") : detail);
}

export async function POST(request: Request) {
  return handleDemoLogin(request, {
    isDemoMode,
    now: Date.now,
    ensureIdentity: (identity, now) => ensureDemoIdentity(getDb(), identity, now),
    createSession: createDemoSession,
    serializeCookie: serializeDemoSessionCookie,
    reportInternalFailure,
  });
}
