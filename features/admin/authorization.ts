import type { Session } from "../identity/types";

export const AUDIT_ACTIONS = [
  "application.approved",
  "application.changes_requested",
  "application.rejected",
  "school.coordinate_suggested",
  "school.coordinate_confirmed",
  "contribution.confirmed",
  "member.hidden",
  "member.restored",
  "member.connections_suspended",
  "member.account_suspended",
  "member.self_deleted",
  "demo.seeded",
] as const;

export type AuditAction = (typeof AUDIT_ACTIONS)[number];

export type AuditRecord = {
  id: string;
  actorUserId: string;
  targetType: "application" | "school" | "contribution" | "member" | "demo";
  targetId: string;
  action: AuditAction;
  diffJson: string;
  createdAt: number;
};

export class AdminAuthorizationError extends Error {
  constructor() {
    super("Forbidden: verified demo-admin session required");
    this.name = "AdminAuthorizationError";
  }
}

/** Authorizes only the identity derived from the signed fixed Demo session. */
export function requireAdmin(session: Session | unknown): "demo-admin" {
  if (!session || typeof session !== "object") throw new AdminAuthorizationError();
  const identity = (session as { identity?: unknown }).identity;
  if (!identity || typeof identity !== "object") throw new AdminAuthorizationError();
  const { id, role } = identity as { id?: unknown; role?: unknown };
  if (id !== "demo-admin" || role !== "admin") throw new AdminAuthorizationError();
  return "demo-admin";
}

export type AdminRouteDependencies = {
  isDemoMode(): boolean;
  requireSession(request: Request): Promise<Session>;
};

export type AdminRouteAuthorization =
  | { ok: true; adminId: "demo-admin" }
  | { ok: false; response: Response };

/** Shared API boundary: Demo mode is checked before signed-session authorization. */
export async function authorizeAdminRoute(
  request: Request,
  dependencies: AdminRouteDependencies,
): Promise<AdminRouteAuthorization> {
  if (!dependencies.isDemoMode()) return { ok: false, response: Response.json({ error: "Not found" }, { status: 404 }) };
  try {
    const session = await dependencies.requireSession(request);
    return { ok: true, adminId: requireAdmin(session) };
  } catch {
    return { ok: false, response: Response.json({ error: "Forbidden" }, { status: 403 }) };
  }
}
