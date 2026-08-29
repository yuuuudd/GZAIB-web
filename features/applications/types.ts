import type { ProjectableProfileField, VisibilityRules } from "../directory/types";

export type ApplicationStatus =
  | "draft"
  | "pending"
  | "changes_requested"
  | "approved"
  | "rejected"
  | "withdrawn";

/** The allowlisted data an applicant may submit. Ownership and review state never belong here. */
export type ApplicationInput = {
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
  consentAccepted: true;
  consentVersion: string;
};

/** Server-owned persistence record, including its owner, lifecycle, and consent timestamp. */
export type ApplicationRecord = Omit<ApplicationInput, "consentAccepted"> & {
  id: string;
  userId: string;
  status: ApplicationStatus;
  consentAcceptedAt: number;
  submittedAt?: number;
  createdAt: number;
  updatedAt: number;
  /** Derived from submitted visibility and retained with the application for status/UI consumers. */
  mapEligibility: ApplicationMapEligibility;
};

export type ApplicationMapEligibility = {
  eligible: boolean;
  blockedBy: ProjectableProfileField[];
};

export type ApplicationReviewInput = {
  id: string;
  status: Extract<ApplicationStatus, "changes_requested" | "approved" | "rejected">;
  reviewedBy: string;
  reviewedAt: number;
  reviewReason?: string;
};
