import type { AuditRecord } from "./authorization";
import { DEFAULT_APPLICATION_VISIBILITY, ROLE_OPTIONS, SKILL_OPTIONS } from "../applications/validation";
import type { VisibilityRules } from "../directory/types";
import { isAuthorizedAdminId } from "./identity";

export type ManualMemberInput = {
  nickname: string;
  realName?: string;
  schoolId: string;
  intro: string;
  skills: string[];
  interests: string[];
  roles: string[];
  workLinks: string[];
  major?: string;
  grade?: string;
  currentFocus?: string;
  canOffer?: string;
  wantsToMeet?: string;
  publication: "draft" | "publish";
};

export type ManualMemberProfile = Omit<ManualMemberInput, "publication"> & {
  id: string; userId: string; slug: string; publishStatus: "unpublished" | "published"; adminManaged: true;
  verifiedBuilder: false; createdAt: number; updatedAt: number;
};

export type ManualMemberRecord = { user: { id: string; email: string; createdAt: number; updatedAt: number }; profile: ManualMemberProfile; visibility: Required<VisibilityRules>; audit: AuditRecord };

export type ManualMemberRepository = {
  isSchoolConfirmed(schoolId: string): Promise<boolean>;
  createAtomic(record: ManualMemberRecord): Promise<void>;
};

function object(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}
function text(value: unknown, min: number, max: number, optional = false): string | undefined {
  if (value === undefined && optional) return undefined;
  if (typeof value !== "string") return undefined;
  const normalized = value.trim();
  return normalized.length >= min && normalized.length <= max ? normalized : undefined;
}
function strings(value: unknown, max: number, allowlist?: readonly string[]): string[] | undefined {
  return Array.isArray(value) && value.length <= max && value.every((item) => typeof item === "string" && item.trim() && (!allowlist || allowlist.includes(item))) ? value.map((item) => item.trim()) : undefined;
}
function httpsLinks(value: unknown): string[] | undefined {
  const links = strings(value, 5);
  if (!links) return undefined;
  return links.every((link) => { try { return new URL(link).protocol === "https:"; } catch { return false; } }) ? links : undefined;
}

/** Accepts only the non-sensitive fields that an operator may manage for a non-login profile. */
export function parseManualMemberInput(value: unknown): ManualMemberInput {
  const input = object(value);
  if (!input) throw new Error("Invalid manual member input");
  const nickname = text(input.nickname, 2, 30);
  const schoolId = text(input.schoolId, 1, 120);
  const intro = text(input.intro, 10, 160);
  const skills = strings(input.skills, 8, SKILL_OPTIONS);
  const interests = strings(input.interests, 6);
  const roles = strings(input.roles, 4, ROLE_OPTIONS);
  const workLinks = httpsLinks(input.workLinks);
  const publication = input.publication === "draft" || input.publication === "publish" ? input.publication : undefined;
  if (!nickname || !schoolId || !intro || !skills || !interests || !roles || !workLinks || !publication) throw new Error("Invalid manual member input");
  const optional: Record<string, string | undefined> = {};
  for (const key of ["realName", "major", "grade", "currentFocus", "canOffer", "wantsToMeet"] as const) {
    const parsed = text(input[key], 1, key === "realName" ? 60 : key === "major" ? 100 : key === "grade" ? 40 : 500, true);
    if (input[key] !== undefined && !parsed) throw new Error("Invalid manual member input");
    optional[key] = parsed;
  }
  return { nickname, schoolId, intro, skills, interests, roles, workLinks, publication, ...optional };
}

function slugFor(nickname: string, userId: string): string {
  const base = nickname.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "member";
  return `${base.slice(0, 80)}-${userId.replace(/[^a-z0-9]/gi, "").slice(-8).toLowerCase()}`;
}

export function createManualMemberService(
  repository: ManualMemberRepository,
  createUserId: () => string = () => crypto.randomUUID(),
  createProfileId: () => string = () => crypto.randomUUID(),
  createAuditId: () => string = () => crypto.randomUUID(),
) {
  return {
    async create(rawInput: unknown, adminId: string, now: number): Promise<ManualMemberRecord> {
      if (!isAuthorizedAdminId(adminId)) throw new Error("Forbidden");
      const input = parseManualMemberInput(rawInput);
      if (input.publication === "publish" && !await repository.isSchoolConfirmed(input.schoolId)) throw new Error("School coordinate must be confirmed before publishing");
      const userId = createUserId();
      const profile: ManualMemberProfile = {
        ...input, id: createProfileId(), userId, slug: slugFor(input.nickname, userId),
        publishStatus: input.publication === "publish" ? "published" : "unpublished", adminManaged: true, verifiedBuilder: false,
        createdAt: now, updatedAt: now,
      };
      const record: ManualMemberRecord = {
        user: { id: userId, email: `manual+${userId}@managed.local`, createdAt: now, updatedAt: now },
        profile,
        visibility: { ...DEFAULT_APPLICATION_VISIBILITY },
        audit: { id: createAuditId(), actorUserId: adminId, targetType: "member", targetId: userId,
          action: input.publication === "publish" ? "member.manually_created_published" : "member.manually_created_draft",
          diffJson: JSON.stringify({ source: "admin_manual_entry", publication: input.publication }), createdAt: now },
      };
      await repository.createAtomic(record);
      return record;
    },
  };
}
