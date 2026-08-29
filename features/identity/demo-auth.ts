import type { DemoIdentity, DemoIdentityInput } from "./types";

export class DemoLoginValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DemoLoginValidationError";
  }
}

const identities: Record<DemoIdentityInput, DemoIdentity> = {
  member: { id: "demo-member", role: "member", displayName: "演示共建者" },
  admin: { id: "demo-admin", role: "admin", displayName: "演示运营员" },
};

export function resolveDemoIdentity(input: unknown): DemoIdentity {
  if (input !== "member" && input !== "admin") {
    throw new DemoLoginValidationError("Invalid demo identity");
  }

  return identities[input];
}

export function isDemoMode(environment: Record<string, string | undefined> = process.env): boolean {
  return environment.DEMO_MODE === "true";
}

export type DemoLoginRequest = {
  identity: DemoIdentityInput;
  returnTo?: string;
};

function isSafeReturnTo(value: string): boolean {
  if (!value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) return false;

  try {
    return new URL(value, "https://demo.local").origin === "https://demo.local";
  } catch {
    return false;
  }
}

/** Validates the complete untrusted login body; fields cannot carry role or user-id claims. */
export function parseDemoLoginRequest(value: unknown): DemoLoginRequest {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new DemoLoginValidationError("Invalid demo login request");
  }

  const request = value as Record<string, unknown>;
  if (Object.keys(request).some((key) => key !== "identity" && key !== "returnTo")) {
    throw new DemoLoginValidationError("Invalid demo login request");
  }

  const identity = request.identity;
  if (identity !== "member" && identity !== "admin") {
    throw new DemoLoginValidationError("Invalid demo identity");
  }

  if (request.returnTo === undefined) return { identity };
  if (typeof request.returnTo !== "string" || !isSafeReturnTo(request.returnTo)) {
    throw new DemoLoginValidationError("Invalid return location");
  }

  return { identity, returnTo: request.returnTo };
}

/** Reads only the two request encodings used by the API and its non-JavaScript form controls. */
export async function readDemoLoginRequest(request: Request): Promise<DemoLoginRequest> {
  try {
    const contentType = request.headers.get("content-type")?.split(";", 1)[0];
    if (contentType === "application/json") return parseDemoLoginRequest(await request.json());
    if (contentType === "application/x-www-form-urlencoded" || contentType === "multipart/form-data") {
      return parseDemoLoginRequest(Object.fromEntries(await request.formData()));
    }
  } catch (error) {
    if (error instanceof DemoLoginValidationError) throw error;
    throw new DemoLoginValidationError("Invalid demo login request");
  }
  throw new DemoLoginValidationError("Invalid demo login request");
}
