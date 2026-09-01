import Image from "next/image";
import Link from "next/link";
import { PrimaryNavigation } from "../navigation/PrimaryNavigation";

export function ContentHubHeader({ active }: { active: "news" | "events" }) {
  return (
    <header className="brand-header content-hub-header">
      <Link className="brand-mark" href="/" aria-label="广州AI共创社首页">
        <Image src="/logo.png" alt="广州AI共创社" width={44} height={44} priority />
        <span>广州AI共创社</span>
      </Link>
      <PrimaryNavigation active={active} />
      <Link className="brand-header-action" href="/apply">申请加入</Link>
    </header>
  );
}
