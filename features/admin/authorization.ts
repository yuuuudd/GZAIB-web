import type { Session } from "../identity/types";
import { authorizeChatGPTAdmin, ensureRuntimeAdminAccount, type RuntimeAdmin, type TrustedChatGPTUser } from "./identity";

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
  "member.manually_created_draft",
  "member.manually_created_published",
  "report.dismissed",
  "report.warned",
  "community.profile_approved",
  "community.profile_changes_requested",
  "community.profile_rejected",
  "community.claim_approved",
  "community.claim_changes_requested",
  "community.claim_rejected",
  "community.update_published",
  "community.update_changes_requested",
  "community.update_rejected",
  "community.archived",
  "demo.seeded",
] as const;

export type AuditAction = (typeof AUDIT_ACTIONS)[number];

export type AuditRecord = {
  id: string;
  actorUserId: string;
  targetType: "application" | "school" | "contribution" | "member" | "community" | "community_submission" | "community_claim" | "community_update" | "demo";
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
  adminEmails?(): string;
  ensureAdminAccount?(admin: RuntimeAdmin): Promise<void>;
};

export type AdminRouteAuthorization =
  | { ok: true; adminId: string; email: string | null }
  | { ok: false; response: Response };

export function trustedChatGPTUserFromHeaders(requestHeaders: Headers): TrustedChatGPTUser | null {
  const userId = requestHeaders.get("oai-authenticated-user-id");
  const email = requestHeaders.get("oai-authenticated-user-email");
  return userId && email ? { userId, email } : null;
}

/** Shared API boundary: demo sessions locally, trusted ChatGPT headers and an allowlist in production. */
export async function authorizeAdminRoute(
  request: Request,
  dependencies: AdminRouteDependencies,
): Promise<AdminRouteAuthorization> {
  try {
    if (dependencies.isDemoMode()) {
      const session = await dependencies.requireSession(request);
      return { ok: true, adminId: requireAdmin(session), email: null };
    }
    const admin = authorizeChatGPTAdmin(trustedChatGPTUserFromHeaders(request.headers), dependencies.adminEmails?.());
    await (dependencies.ensureAdminAccount ?? ensureRuntimeAdminAccount)(admin);
    return { ok: true, adminId: admin.id, email: admin.email };
  } catch {
    return { ok: false, response: Response.json({ error: "Forbidden" }, { status: 403 }) };
  }
}
