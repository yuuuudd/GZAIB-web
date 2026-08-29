export type Visibility = "public" | "members" | "private";

export type Viewer =
  | { kind: "visitor" }
  | { kind: "member"; userId: string }
  | { kind: "admin"; userId: string };

export type ProfileContribution = {
  id: string;
  title: string;
  activityDate: number;
  role: string;
  outcome: string;
  publicSummary: string;
};

export type ContactCard = {
  email?: string;
  wechat?: string;
};

/**
 * The internal profile shape. This intentionally includes private fields so
 * server-side code can keep them separate from the public projection.
 */
export type MemberProfileRecord = {
  id: string;
  userId: string;
  slug: string;
  nickname: string;
  avatarUrl?: string;
  school: string;
  city: string;
  intro: string;
  skills: string[];
  roles: string[];
  verifiedBuilder: boolean;
  contributions: ProfileContribution[];
  currentFocus?: string;
  canOffer?: string;
  wantsToMeet?: string;
  workLinks?: string[];
  major?: string;
  grade?: string;
  loginEmail?: string;
  reviewNotes?: string;
  wechat?: string;
  contactCard?: ContactCard;
};

export const PUBLIC_FIELDS = [
  "nickname",
  "avatarUrl",
  "school",
  "city",
  "intro",
  "skills",
  "roles",
  "verifiedBuilder",
  "contributions",
] as const;

export const MEMBER_FIELDS = [
  "currentFocus",
  "canOffer",
  "wantsToMeet",
  "workLinks",
  "major",
  "grade",
] as const;

export type ProjectableProfileField = (typeof PUBLIC_FIELDS)[number] | (typeof MEMBER_FIELDS)[number];

/** Visibility is absent by default rather than becoming public by accident. */
export type VisibilityRules = Partial<Record<ProjectableProfileField, Visibility>>;

export type ProjectedProfile = Pick<MemberProfileRecord, "slug"> & Partial<Pick<MemberProfileRecord, ProjectableProfileField>>;

/** Review-only data has a separate DTO and never passes through the projector. */
export type AdminProfileReview = Pick<MemberProfileRecord, "id" | "userId" | "loginEmail" | "reviewNotes">;

export type DirectoryFilters = {
  city?: string;
  schoolId?: string;
};
