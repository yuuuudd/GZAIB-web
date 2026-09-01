import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { ContactCardEditor } from "../../../components/connections/ContactCardEditor";
import { BrandHomeLink } from "../../../components/navigation/BrandHomeLink";
import { PrimaryNavigation } from "../../../components/navigation/PrimaryNavigation";
import { getDb } from "../../../db";
import { createContactCardService } from "../../../features/connections/contact-card";
import { resolveRequestUserId } from "../../../features/identity/request-user";
import { createContactCardRepository } from "../../../lib/db/repositories/contact-cards";
import { chatGPTSignInPath } from "../../chatgpt-auth";

export const dynamic = "force-dynamic";

export default async function ContactCardPage() {
  const requestHeaders = await headers();
  let userId: string | null;
  try { userId = await resolveRequestUserId(new Request("https://demo.local/me/contact-card", { headers: requestHeaders })); }
  catch { redirect("/"); }
  if (!userId) redirect(chatGPTSignInPath("/me/contact-card"));
  let card;
  try {
    // This settings page is the only server-rendered surface that deliberately receives plaintext.
    card = await createContactCardService(createContactCardRepository(getDb())).getOwnCard(userId);
  } catch {
    return <main className="member-center-shell"><section className="status-card"><p className="section-kicker">联系名片</p><h1>联系方式暂时不可用</h1><p>请稍后再试。你的联系方式不会被公开展示。</p><Link className="brand-primary-action" href="/me">返回成员中心</Link></section></main>;
  }
  return <main className="member-center-shell">
    <header className="brand-header member-page-header"><BrandHomeLink /><PrimaryNavigation /><form action="/api/auth/logout" method="post"><button className="brand-header-action member-logout" type="submit">退出</button></form></header>
    <div className="member-center-content"><ContactCardEditor initialCard={card} /></div>
  </main>;
}
