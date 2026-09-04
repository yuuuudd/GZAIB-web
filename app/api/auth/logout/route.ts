import { NextResponse } from "next/server";
import { clearSession } from "../../../../features/identity/session";
import { clearDatabaseSessionCookie, revokeRuntimeDatabaseSession } from "../../../../features/identity/database-session";

export async function POST(request: Request) {
  await revokeRuntimeDatabaseSession(request);
  const response = new NextResponse(null, { status: 303, headers: { Location: "/" } });
  clearSession(response);
  response.headers.append("Set-Cookie", clearDatabaseSessionCookie());
  return response;
}
