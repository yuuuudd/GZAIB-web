import Image from "next/image";
import Link from "next/link";
import { ConnectionInbox } from "../../../components/connections/ConnectionInbox";

export const dynamic = "force-dynamic";

export default async function ConnectionsPage({ searchParams }: { searchParams: Promise<{ box?: string }> }) {
  const box = (await searchParams).box;
  const initialBox = box === "sent" || box === "accepted" ? box : "received";
  return <main className="member-center-shell">
    <header className="brand-header member-page-header"><Link className="brand-mark" href="/" aria-label="广州 AI 共创社首页"><Image src="/logo.png" alt="广州 AI 共创社" width={44} height={44} /><span>广州 AI 共创社</span></Link><nav className="brand-nav" aria-label="主导航"><Link href="/">共建地图</Link><Link className="brand-nav-active" href="/me">成员中心</Link></nav><form action="/api/auth/logout" method="post"><button className="brand-header-action member-logout" type="submit">退出</button></form></header>
    <div className="member-center-content"><ConnectionInbox initialBox={initialBox} /></div>
  </main>;
}
