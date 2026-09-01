import Link from "next/link";
import { BrandHomeLink } from "../navigation/BrandHomeLink";
import { PrimaryNavigation } from "../navigation/PrimaryNavigation";

export function ContentHubHeader({ active }: { active: "news" | "events" }) {
  return (
    <header className="brand-header content-hub-header">
      <BrandHomeLink />
      <PrimaryNavigation active={active} />
      <Link className="brand-header-action" href="/apply">申请加入</Link>
    </header>
  );
}
