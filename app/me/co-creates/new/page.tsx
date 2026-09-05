import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { CoCreateProjectForm } from "../../../../components/co-create/CoCreateProjectForm";
import { BrandHomeLink } from "../../../../components/navigation/BrandHomeLink";
import { PrimaryNavigation } from "../../../../components/navigation/PrimaryNavigation";
import { accountSignInPath } from "../../../../features/identity/account-paths";
import { resolveRequestUserId } from "../../../../features/identity/request-user";

export default async function NewCoCreatePage() {
  const userId = await resolveRequestUserId(new Request("https://site.local/me/co-creates/new", { headers: await headers() }));
  if (!userId) redirect(accountSignInPath("/me/co-creates/new"));
  return <main className="member-center-shell"><header className="brand-header member-page-header"><BrandHomeLink /><PrimaryNavigation active="co-create" /><a className="brand-header-action" href="/me/co-creates">我的共创</a></header><div className="member-center-content"><CoCreateProjectForm /></div></main>;
}
