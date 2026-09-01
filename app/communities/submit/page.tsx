import Link from "next/link";
import { CommunitySubmissionForm } from "../../../components/communities/CommunitySubmissionForm";
import { BrandHomeLink } from "../../../components/navigation/BrandHomeLink";
import { PrimaryNavigation } from "../../../components/navigation/PrimaryNavigation";

export default function SubmitCommunityPage() {
  return <main className="community-shell">
    <header className="brand-header community-header"><BrandHomeLink /><PrimaryNavigation active="communities" /><Link className="brand-header-action" href="/me/communities">我的社群</Link></header>
    <div className="community-page-content"><p className="community-kicker">共同完善社群地图</p><h1>提交 AI 社群</h1><p>请提供可核验的官方入口与公开来源。提交内容不会立即公开。</p><CommunitySubmissionForm mode="create" /></div>
  </main>;
}
