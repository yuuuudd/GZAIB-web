import type { VisibilityRules } from "../directory/types";

export type ApplicationStatus =
  | "draft"
  | "pending"
  | "changes_requested"
  | "approved"
  | "rejected"
  | "withdrawn";

export type ApplicationInput = {
  id: string;
  userId: string;
  status: ApplicationStatus;
  nickname: string;
  realName?: string;
  avatarKey?: string;
  schoolId: string;
  major?: string;
  grade?: string;
  intro: string;
  currentFocus?: string;
  canOffer?: string;
  wantsToMeet?: string;
  skills: string[];
  interests: string[];
  roles: string[];
  workLinks: string[];
  visibility: VisibilityRules;
  consentVersion: string;
  consentAcceptedAt: number;
  submittedAt?: number;
  createdAt: number;
  updatedAt: number;
};

export type ApplicationReviewInput = {
  id: string;
  status: Extract<ApplicationStatus, "changes_requested" | "approved" | "rejected">;
  reviewedBy: string;
  reviewedAt: number;
  reviewReason?: string;
};
