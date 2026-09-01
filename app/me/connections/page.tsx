import Image from "next/image";
import Link from "next/link";
import { ConnectionInbox } from "../../../components/connections/ConnectionInbox";
import { PrimaryNavigation } from "../../../components/navigation/PrimaryNavigation";

export const dynamic = "force-dynamic";

export default async function ConnectionsPage({ searchParams }: { searchParams: Promise<{ box?: string }> }) {
  const box = (await searchParams).box;
  const initialBox = box === "sent" || box === "accepted" ? box : "received";
  return <main className="member-center-shell">
    <header className="brand-header member-page-header"><Link className="brand-mark" href="/" aria-label="广州 AI 共创社首页"><Image src="/logo.png" alt="广州 AI 共创社" width={44} height={44} /><span>广州 AI 共创社</span></Link><PrimaryNavigation /><form action="/api/auth/logout" method="post"><button className="brand-header-action member-logout" type="submit">退出</button></form></header>
    <div className="member-center-content"><ConnectionInbox initialBox={initialBox} /></div>
  </main>;
}
