import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { ConnectionInbox } from "../../../components/connections/ConnectionInbox";
import { BrandHomeLink } from "../../../components/navigation/BrandHomeLink";
import { PrimaryNavigation } from "../../../components/navigation/PrimaryNavigation";
import { resolveRequestUserId } from "../../../features/identity/request-user";
import { chatGPTSignInPath } from "../../chatgpt-auth";

export const dynamic = "force-dynamic";

export default async function ConnectionsPage({ searchParams }: { searchParams: Promise<{ box?: string }> }) {
  let userId: string | null;
  try { userId = await resolveRequestUserId(new Request("https://demo.local/me/connections", { headers: await headers() })); } catch { redirect("/"); }
  if (!userId) redirect(chatGPTSignInPath("/me/connections"));
  const box = (await searchParams).box;
  const initialBox = box === "sent" || box === "accepted" ? box : "received";
  return <main className="member-center-shell">
    <header className="brand-header member-page-header"><BrandHomeLink /><PrimaryNavigation /><form action="/api/auth/logout" method="post"><button className="brand-header-action member-logout" type="submit">退出</button></form></header>
    <div className="member-center-content"><ConnectionInbox initialBox={initialBox} /></div>
  </main>;
}
