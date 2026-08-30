import { projectProfile } from "./public-profile";
import type { MemberProfileRecord, ProjectedProfile, Viewer, VisibilityRules } from "./types";
import type { Session } from "../identity/types";

export type ProfileAccessCandidate = {
  accountStatus: string;
  applicationStatus: string | null;
  publishStatus: string;
  profile: MemberProfileRecord;
  visibility: VisibilityRules;
};

export type ProfileAccessRepository = {
  findBySlug(slug: string, viewer: Viewer): Promise<ProfileAccessCandidate | undefined>;
  findByUserId(userId: string): Promise<ProfileAccessCandidate | undefined>;
};

/** Converts only durable server session/membership state into a viewer capability. */
export async function deriveProfileViewer(
  session: Session | undefined,
  isApprovedMember: (userId: string) => Promise<boolean>,
): Promise<Viewer> {
  if (!session) return { kind: "visitor" };
  if (session.identity.role === "admin") return { kind: "admin", userId: session.identity.id };
  return await isApprovedMember(session.identity.id)
    ? { kind: "member", userId: session.identity.id }
    : { kind: "visitor" };
}

function isPubliclyAvailable(candidate: ProfileAccessCandidate): boolean {
  return (candidate.accountStatus === "active" || candidate.accountStatus === "connection_suspended")
    && candidate.publishStatus === "published";
}

/** Projects at the server boundary so UI and route adapters never receive raw profile rows. */
export function createProfileAccessService(repository: ProfileAccessRepository) {
  return {
    async getProfile(slug: string, viewer: Viewer): Promise<ProjectedProfile | undefined> {
      if (!slug || slug.length > 160) return undefined;
      const candidate = await repository.findBySlug(slug, viewer);
      return candidate && isPubliclyAvailable(candidate)
        ? projectProfile(candidate.profile, candidate.visibility, viewer)
        : undefined;
    },

    async getOwnProfile(userId: string): Promise<ProjectedProfile | undefined> {
      const candidate = await repository.findByUserId(userId);
      return candidate
        ? projectProfile(candidate.profile, candidate.visibility, { kind: "owner", userId })
        : undefined;
    },
  };
}

export async function createRuntimeProfileAccessService() {
  const [{ getDb }, { createProfileAccessRepository }] = await Promise.all([
    import("../../db"), import("../../lib/db/repositories/directory"),
  ]);
  return createProfileAccessService(createProfileAccessRepository(getDb()));
}

export async function resolveRuntimeProfileViewer(request: Request): Promise<Viewer> {
  let session: Session | undefined;
  try {
    session = await (await import("../identity/active-account")).requireActiveSession(request);
  } catch {
    return { kind: "visitor" };
  }
  return deriveProfileViewer(session, async (userId) => {
    const [{ getDb }, schema, { eq }] = await Promise.all([
      import("../../db"), import("../../db/schema"), import("drizzle-orm"),
    ]);
    const [approved] = await getDb().select({ id: schema.memberProfiles.id }).from(schema.memberProfiles)
      .where(eq(schema.memberProfiles.userId, userId));
    return Boolean(approved);
  });
}
