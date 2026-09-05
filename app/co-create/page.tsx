import { CoCreateSquare } from "../../components/co-create/CoCreateSquare";
import { BrandHomeLink } from "../../components/navigation/BrandHomeLink";
import { PrimaryNavigation } from "../../components/navigation/PrimaryNavigation";
import { headers } from "next/headers";
import { getDb } from "../../db";
import { accountSignInPath } from "../../features/identity/account-paths";
import { resolveRequestUserId } from "../../features/identity/request-user";
import { createCoCreateProjectRepository } from "../../lib/db/repositories/co-create-projects";

export const dynamic = "force-dynamic";

export default async function CoCreatePage() {
  let userId: string | null = null;
  try { userId = await resolveRequestUserId(new Request("https://site.local/co-create", { headers: await headers() })); } catch { /* Public browsing remains available. */ }
  const projects = await createCoCreateProjectRepository(getDb()).listPublished();
  const items = projects.map((project) => ({ ...project, deadline: project.deadline ?? undefined, isOwner: project.ownerUserId === userId }));
  return <main className="co-create-shell"><header className="brand-header co-create-header"><BrandHomeLink /><PrimaryNavigation active="co-create" /><a className="brand-header-action" href="/me">我的</a></header><CoCreateSquare items={items} signedIn={Boolean(userId)} loginHref={accountSignInPath("/co-create")} /></main>;
}
