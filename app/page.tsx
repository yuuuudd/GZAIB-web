import { EcosystemMapSwitcher } from "../components/map/EcosystemMapSwitcher";
import { PrimaryNavigation } from "../components/navigation/PrimaryNavigation";
import Image from "next/image";

const homeChannels = [
  { href: "#map", title: "共建地图", subtitle: "看见彼此，连接行动", artwork: "/brand/home-map.webp", tone: "map" },
  { href: "/communities", title: "AI 社区", subtitle: "连接同频，共创未来", artwork: "/brand/home-community.webp", tone: "community" },
  { href: "/news", title: "AI 资讯", subtitle: "洞察前沿，启发更多", artwork: "/brand/home-news.webp", tone: "news" },
  { href: "/events", title: "活动赛事", subtitle: "发现活动，参与共建", artwork: "/brand/home-events.webp", tone: "events" },
] as const;

const communityLoop = [
  { label: "发现", description: "发现议题、活动与真实需求", href: "/events" },
  { label: "连接", description: "在共建地图找到同行者", href: "/#map" },
  { label: "共创", description: "加入网络，发起双向连接", href: "/apply" },
  { label: "落地", description: "组队协作，把想法变成行动" },
  { label: "沉淀", description: "让作品、经验与贡献持续可见" },
] as const;

const communityLoopPath = "M90 110C200 40 285 45 360 70C450 100 510 125 600 110C690 95 760 50 840 70C930 90 1010 75 1110 110C1170 135 1185 215 1110 245C850 292 350 292 90 245C15 215 25 140 90 110Z";

export default function Home() {
  return (
    <main className="brand-shell">
      <header className="brand-header">
        <a className="brand-mark" href="#top" aria-label="广州AI共创社首页">
          <Image src="/brand/gzaib-horizontal.png" alt="广州 AI 共创社 GZAIB" width={276} height={106} priority unoptimized />
        </a>
        <PrimaryNavigation active="home" />
        <a className="brand-header-action" href="/me">我的</a>
      </header>
      <section className="brand-home-hero" id="top" aria-labelledby="hero-title">
        <div className="brand-home-copy">
          <p className="brand-eyebrow">青年共建 · 连接创造力</p>
          <h1 id="hero-title"><span className="hero-title-line">让广东每一所高校，</span><span className="hero-title-line">都亮起一束<span className="hero-title-accent">共建的光</span>。</span></h1>
          <p className="brand-intro">让愿意分享的人被看见，让想做的事找到同行者，让高校里的创造力彼此连接。</p>
          <div className="brand-hero-actions">
            <a className="brand-primary-action" href="/apply">申请点亮我的头像 <span>→</span></a>
            <a className="brand-secondary-action" href="#map">探索地图 <span>↓</span></a>
          </div>
        </div>
        <div className="hero-channel-grid" aria-label="探索广州 AI 共创社">
          {homeChannels.map((channel, index) => (
            <a className={`hero-channel-card hero-channel-${channel.tone}`} href={channel.href} key={channel.title} style={{ "--card-index": index } as React.CSSProperties}>
              <Image src={channel.artwork} alt="" fill sizes="(max-width: 720px) 45vw, (max-width: 1100px) 28vw, 22vw" unoptimized />
              <span className="hero-channel-sheen" aria-hidden="true" />
              <span className="hero-channel-copy">
                <span className="hero-channel-number">0{index + 1}</span>
                <h2>{channel.title}</h2>
                <span>{channel.subtitle}</span>
              </span>
              <span className="hero-channel-arrow" aria-hidden="true">↗</span>
            </a>
          ))}
        </div>
      </section>
      <EcosystemMapSwitcher initialView="builders" />
      <section className="community-loop" id="how-it-works" aria-labelledby="community-loop-title">
        <div className="approval-heading"><p className="map-section-kicker">共创如何发生</p><h2 id="community-loop-title">从连接，到创造</h2><p>让议题找到同行，让行动沉淀成果。</p></div>
        <ol>
          <svg className="community-loop-path" viewBox="0 0 1200 300" preserveAspectRatio="none" aria-hidden="true" focusable="false">
            <defs><linearGradient id="community-loop-gradient" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor="#1e4ed8"/><stop offset=".5" stopColor="#f56a2b"/><stop offset="1" stopColor="#1e4ed8"/></linearGradient></defs>
            <path className="community-loop-path-line" pathLength="1" d={communityLoopPath}/>
            <circle className="community-loop-pulse community-loop-pulse-blue" r="4"><animateMotion dur="9s" repeatCount="indefinite" path={communityLoopPath}/></circle>
            <circle className="community-loop-pulse community-loop-pulse-orange" r="3"><animateMotion begin="-4.5s" dur="9s" repeatCount="indefinite" path={communityLoopPath}/></circle>
          </svg>
          {communityLoop.map((step, index) => <li className="community-loop-step" key={step.label}>
            <span className="sr-only">第 {index + 1} 步</span><i aria-hidden="true" />
            <div>{"href" in step ? <a href={step.href}><strong>{step.label}</strong></a> : <strong>{step.label}</strong>}<p>{step.description}</p></div>
          </li>)}
        </ol>
      </section>
      <footer className="site-footer" aria-label="网站页脚">
        <div className="site-footer-grid">
          <section className="site-footer-brand"><strong>✦ 广州 AI 共创社 <small>GZAIB</small></strong><p>连接高校 AI 共建者，让项目、活动与资源持续发生。</p><div aria-label="社交渠道"><span>公众号</span><span>小红书</span><span>邮箱</span></div></section>
          <nav aria-label="平台"><h2>平台</h2><a href="/#map">共建地图</a><a href="/communities">AI 社区</a><a href="/news">AI 资讯</a><a href="/events">活动赛事</a></nav>
          <nav aria-label="共建与连接"><h2>共建与连接</h2><a href="/apply">申请加入</a><a href="/me/connections">我的连接</a><a href="/apply">共建者认证</a><a href="/events/submit">活动申请</a></nav>
          <section className="site-footer-qr"><h2>关注公众号</h2><Image src="/brand/official-account-qr.jpg" alt="广州 AI 共创社公众号二维码" width={112} height={112} unoptimized /><p>扫码关注广州 AI 共创社</p></section>
        </div>
        <div className="site-footer-legal">公开资料由本人授权，经学校聚合与运营审核后展示。联系方式仅在双方同意连接后交换。</div>
        <div className="site-footer-bottom"><span>广州 AI 共创社 · 由高校青年共同建设</span><span>© 2026 GZAIB</span></div>
      </footer>
    </main>
  );
}
