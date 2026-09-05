import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { CoCreateProjectForm } from "../../../../../../components/co-create/CoCreateProjectForm";
import { BrandHomeLink } from "../../../../../../components/navigation/BrandHomeLink";
import { PrimaryNavigation } from "../../../../../../components/navigation/PrimaryNavigation";
import { getDb } from "../../../../../../db";
import { accountSignInPath } from "../../../../../../features/identity/account-paths";
import { resolveRequestUserId } from "../../../../../../features/identity/request-user";
import { createCoCreateProjectRepository } from "../../../../../../lib/db/repositories/co-create-projects";

export const dynamic = "force-dynamic";

export default async function EditCoCreatePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const userId = await resolveRequestUserId(new Request(`https://site.local/me/co-creates/${id}/edit`, { headers: await headers() }));
  if (!userId) redirect(accountSignInPath(`/me/co-creates/${id}/edit`));
  const project = await createCoCreateProjectRepository(getDb()).findOwnedById(id, userId);
  if (!project) notFound();
  return <main className="member-center-shell"><header className="brand-header member-page-header"><BrandHomeLink /><PrimaryNavigation active="co-create" /><a className="brand-header-action" href="/me/co-creates">我的共创</a></header><div className="member-center-content"><CoCreateProjectForm projectId={id} initial={{ ...project, deadline: project.deadline ?? undefined }} /></div></main>;
}
