/* eslint-disable @next/next/no-html-link-for-pages -- Cross-route fragment navigation must bypass Vinext's unreliable client Link interception. */
import Image from "next/image";
import Link from "next/link";
import { CommunitySubmissionForm } from "../../../components/communities/CommunitySubmissionForm";

export default function SubmitCommunityPage() {
  return <main className="community-shell">
    <header className="brand-header community-header"><Link className="brand-mark" href="/" aria-label="广州AI共创社首页"><Image src="/logo.png" alt="广州AI共创社" width={44} height={44} priority /><span>广州AI共创社</span></Link><nav className="brand-nav" aria-label="主导航"><a href="/#map">共建地图</a><Link className="brand-nav-active" href="/communities">AI 社群</Link></nav><Link className="brand-header-action" href="/me/communities">我的社群</Link></header>
    <div className="community-page-content"><p className="community-kicker">共同完善社群地图</p><h1>提交 AI 社群</h1><p>请提供可核验的官方入口与公开来源。提交内容不会立即公开。</p><CommunitySubmissionForm mode="create" /></div>
  </main>;
}
