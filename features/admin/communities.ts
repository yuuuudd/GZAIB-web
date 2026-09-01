import type { AuditRecord } from "./authorization";

export type CommunityReviewKind = "profile" | "claim" | "update";

export type CommunityReviewAction =
  | { decision: "approve" }
  | { decision: "changes_requested"; reason: string }
  | { decision: "reject"; reason: string };

export type CommunityReviewResult = {
  kind: CommunityReviewKind;
  id: string;
  status: "approved" | "published" | "changes_requested" | "rejected";
};

export type CommunityReviewField = {
  label: string;
  previous: string | null;
  proposed: string;
};

type PendingReviewBase = {
  id: string;
  submitter: string;
  submitterEmail: string;
  submittedAt: number;
};

export type PendingProfileReview = PendingReviewBase & {
  kind: "profile";
  submissionKind: "create" | "update";
  communityId: string | null;
  title: string;
  sourceUrl: string;
  sourceLabel: string;
  fields: CommunityReviewField[];
};

export type PendingClaimReview = PendingReviewBase & {
  kind: "claim";
  communityId: string;
  title: string;
  evidence: string;
  evidenceUrl: string | null;
};

export type PendingUpdateReview = PendingReviewBase & {
  kind: "update";
  communityId: string;
  communityName: string;
  title: string;
  summary: string;
  occurredAt: number;
  sourceUrl: string | null;
};

export type PendingCommunityReviews = {
  profiles: PendingProfileReview[];
  claims: PendingClaimReview[];
  updates: PendingUpdateReview[];
};

export type CommunityAtomicReview = {
  kind: CommunityReviewKind;
  id: string;
  status: CommunityReviewResult["status"];
  reviewedBy: string;
  reviewedAt: number;
  reviewReason: string | null;
  newCommunity?: { id: string; slug: string };
  audit: AuditRecord;
};

export type CommunityAdminRepository = {
  reviewAtomic(input: CommunityAtomicReview): Promise<{ transitioned: boolean }>;
  listPendingReviews(): Promise<PendingCommunityReviews>;
};

export type CommunityAdminService = {
  review(adminId: string, kind: CommunityReviewKind, id: string, action: CommunityReviewAction, now: number): Promise<CommunityReviewResult>;
  reviewProfileSubmission(adminId: string, id: string, action: CommunityReviewAction, now: number): Promise<CommunityReviewResult>;
  reviewClaim(adminId: string, id: string, action: CommunityReviewAction, now: number): Promise<CommunityReviewResult>;
  reviewUpdate(adminId: string, id: string, action: CommunityReviewAction, now: number): Promise<CommunityReviewResult>;
  listPending(): Promise<PendingCommunityReviews>;
};

export class CommunityAdminError extends Error {
  constructor(
    readonly code: "invalid_action" | "invalid_target" | "state_changed",
    message: string,
  ) {
    super(message);
    this.name = "CommunityAdminError";
  }
}

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new CommunityAdminError("invalid_action", "审核操作无效");
  }
  return value as Record<string, unknown>;
}

function reason(value: unknown): string {
  if (typeof value !== "string") throw new CommunityAdminError("invalid_action", "审核操作无效");
  const normalized = value.normalize("NFKC").trim();
  const characterCount = [...normalized].length;
  if (characterCount < 2 || characterCount > 300) {
    throw new CommunityAdminError("invalid_action", "审核操作无效");
  }
  return normalized;
}

/** Exact review-body parser. Identity, state, timestamps, audit and public content are never accepted here. */
export function parseCommunityReviewAction(value: unknown): CommunityReviewAction {
  const input = record(value);
  if (input.decision === "approve" && Object.keys(input).length === 1) return { decision: "approve" };
  if ((input.decision === "changes_requested" || input.decision === "reject")
    && Object.keys(input).length === 2 && Object.hasOwn(input, "reason")) {
    return { decision: input.decision, reason: reason(input.reason) };
  }
  throw new CommunityAdminError("invalid_action", "审核操作无效");
}

function reviewId(value: string, label: string): string {
  if (typeof value !== "string") throw new CommunityAdminError("invalid_target", `${label}无效`);
  const hasControlCharacter = [...value].some((character) => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127);
  if (!value || value.length > 160 || value.trim() !== value || value.normalize("NFKC") !== value || hasControlCharacter) {
    throw new CommunityAdminError("invalid_target", `${label}无效`);
  }
  return value;
}

function newCommunitySlug(id: string): string {
  const safe = id.normalize("NFKC").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 70);
  return `community-${safe || "new"}`.slice(0, 80);
}

const transitions = {
  profile: {
    approve: { status: "approved", targetType: "community_submission", action: "community.profile_approved" },
    changes_requested: { status: "changes_requested", targetType: "community_submission", action: "community.profile_changes_requested" },
    reject: { status: "rejected", targetType: "community_submission", action: "community.profile_rejected" },
  },
  claim: {
    approve: { status: "approved", targetType: "community_claim", action: "community.claim_approved" },
    changes_requested: { status: "changes_requested", targetType: "community_claim", action: "community.claim_changes_requested" },
    reject: { status: "rejected", targetType: "community_claim", action: "community.claim_rejected" },
  },
  update: {
    approve: { status: "published", targetType: "community_update", action: "community.update_published" },
    changes_requested: { status: "changes_requested", targetType: "community_update", action: "community.update_changes_requested" },
    reject: { status: "rejected", targetType: "community_update", action: "community.update_rejected" },
  },
} as const;

/** The caller must already have passed authorizeAdminRoute; this service owns every resulting review field. */
export function createCommunityAdminService(
  repository: CommunityAdminRepository,
  createCommunityId: () => string = () => crypto.randomUUID(),
  createAuditId: () => string = () => crypto.randomUUID(),
): CommunityAdminService {
  async function review(rawAdminId: string, kind: CommunityReviewKind, rawId: string, rawAction: CommunityReviewAction, now: number) {
    const adminId = reviewId(rawAdminId, "审核人");
    if (kind !== "profile" && kind !== "claim" && kind !== "update") {
      throw new CommunityAdminError("invalid_target", "审核类型无效");
    }
    const id = reviewId(rawId, "审核记录");
    if (!Number.isSafeInteger(now) || now <= 0) throw new CommunityAdminError("invalid_target", "审核时间无效");
    const action = parseCommunityReviewAction(rawAction);
    const transition = transitions[kind][action.decision];
    const atomicReview: CommunityAtomicReview = {
      kind,
      id,
      status: transition.status,
      reviewedBy: adminId,
      reviewedAt: now,
      reviewReason: action.decision === "approve" ? null : action.reason,
      audit: {
        id: reviewId(createAuditId(), "审计记录"),
        actorUserId: adminId,
        targetType: transition.targetType,
        targetId: id,
        action: transition.action,
        diffJson: JSON.stringify({ status: transition.status }),
        createdAt: now,
      },
    };
    if (kind === "profile" && action.decision === "approve") {
      const communityId = reviewId(createCommunityId(), "社群记录");
      atomicReview.newCommunity = { id: communityId, slug: newCommunitySlug(communityId) };
    }
    const result = await repository.reviewAtomic(atomicReview);
    if (!result.transitioned) throw new CommunityAdminError("state_changed", "审核状态已变化");
    return { kind, id, status: transition.status };
  }

  return {
    review,
    reviewProfileSubmission(adminId, id, action, now) {
      return review(adminId, "profile", id, action, now);
    },
    reviewClaim(adminId, id, action, now) {
      return review(adminId, "claim", id, action, now);
    },
    reviewUpdate(adminId, id, action, now) {
      return review(adminId, "update", id, action, now);
    },
    listPending() {
      return repository.listPendingReviews();
    },
  };
}

export async function createRuntimeCommunityAdminService(): Promise<CommunityAdminService> {
  const [{ getDb }, { createCommunityRepository }] = await Promise.all([
    import("../../db"),
    import("../../lib/db/repositories/communities"),
  ]);
  return createCommunityAdminService(createCommunityRepository(getDb()));
}
