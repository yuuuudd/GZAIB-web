import { NextResponse } from "next/server";
import { clearSession } from "../../../../features/identity/session";

export async function POST() {
  const response = new NextResponse(null, { status: 303, headers: { Location: "/" } });
  return clearSession(response);
}
