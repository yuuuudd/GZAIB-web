import {
  MEMBER_FIELDS,
  PUBLIC_FIELDS,
  type MemberProfileRecord,
  type ProjectableProfileField,
  type ProjectedProfile,
  type Viewer,
  type Visibility,
  type VisibilityRules,
} from "./types";

function canView(visibility: Visibility | undefined, viewer: Viewer): boolean {
  if (viewer.kind === "admin") return visibility !== undefined;
  if (visibility === "public") return true;
  return visibility === "members" && viewer.kind === "member";
}

function copyIfVisible(
  output: ProjectedProfile,
  profile: MemberProfileRecord,
  rules: VisibilityRules,
  viewer: Viewer,
  field: ProjectableProfileField,
): void {
  const value = profile[field];
  if (value !== undefined && canView(rules[field], viewer)) {
    Object.assign(output, { [field]: value });
  }
}

/**
 * Constructs a safe profile DTO from an explicit field allowlist. It never
 * serializes the internal record and therefore cannot leak newly-added fields.
 */
export function projectProfile(
  profile: MemberProfileRecord,
  rules: VisibilityRules,
  viewer: Viewer,
): ProjectedProfile {
  const projected: ProjectedProfile = { slug: profile.slug };

  for (const field of PUBLIC_FIELDS) copyIfVisible(projected, profile, rules, viewer, field);
  for (const field of MEMBER_FIELDS) copyIfVisible(projected, profile, rules, viewer, field);

  return projected;
}
