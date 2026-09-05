import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { MyCoCreateProjects } from "../../../components/co-create/MyCoCreateProjects";
import { BrandHomeLink } from "../../../components/navigation/BrandHomeLink";
import { PrimaryNavigation } from "../../../components/navigation/PrimaryNavigation";
import { getDb } from "../../../db";
import { accountSignInPath } from "../../../features/identity/account-paths";
import { resolveRequestUserId } from "../../../features/identity/request-user";
import { createCoCreateProjectRepository } from "../../../lib/db/repositories/co-create-projects";

export const dynamic = "force-dynamic";

export default async function MyCoCreatesPage() {
  const userId = await resolveRequestUserId(new Request("https://site.local/me/co-creates", { headers: await headers() }));
  if (!userId) redirect(accountSignInPath("/me/co-creates"));
  const projects = await createCoCreateProjectRepository(getDb()).listByOwner(userId);
  return <main className="member-center-shell"><header className="brand-header member-page-header"><BrandHomeLink /><PrimaryNavigation active="co-create" /><a className="brand-header-action" href="/co-create">共创广场</a></header><div className="member-center-content"><MyCoCreateProjects projects={projects.map((project) => ({ ...project, deadline: project.deadline ?? undefined }))} /></div></main>;
}
