import type { DirectoryQuery } from "./service";

/** Builds the public, allowlisted list-mode request used by the school drawer. */
export function schoolMembersUrl(schoolId: string, query: DirectoryQuery, cursor?: string): string {
  const params = new URLSearchParams({ mode: "list", limit: "24", schoolId });
  if (query.city) params.set("city", query.city);
  if (query.skills?.length) params.set("skills", query.skills.join(","));
  if (query.roles?.length) params.set("roles", query.roles.join(","));
  if (query.verified !== undefined) params.set("verified", String(query.verified));
  if (query.q) params.set("q", query.q);
  if (cursor) params.set("cursor", cursor);
  return `/api/directory?${params}`;
}
