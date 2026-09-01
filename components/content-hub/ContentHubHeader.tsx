/* eslint-disable @next/next/no-html-link-for-pages -- cross-route fragment navigation must bypass Vinext client interception. */
import Image from "next/image";
import Link from "next/link";

export function ContentHubHeader({ active }: { active: "news" | "events" }) {
  return (
    <header className="brand-header content-hub-header">
      <Link className="brand-mark" href="/" aria-label="广州AI共创社首页">
        <Image src="/logo.png" alt="广州AI共创社" width={44} height={44} priority />
        <span>广州AI共创社</span>
      </Link>
      <nav className="brand-nav" aria-label="主导航">
        <a href="/#map">共建地图</a>
        <Link href="/communities">AI 社群</Link>
        <Link className={active === "news" ? "brand-nav-active" : undefined} href="/news">AI 资讯</Link>
        <Link className={active === "events" ? "brand-nav-active" : undefined} href="/events">活动赛事</Link>
      </nav>
      <Link className="brand-header-action" href="/apply">申请加入</Link>
    </header>
  );
}
