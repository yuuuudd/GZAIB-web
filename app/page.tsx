import { PrimaryNavigation } from "../components/navigation/PrimaryNavigation";
import Image from "next/image";

const homeChannels = [
  { href: "/map", title: "共建地图", subtitle: "看见彼此，连接行动", artwork: "/brand/home-map.webp", tone: "map" },
  { href: "/co-create", title: "共创广场", subtitle: "提一个想法，找一群同行者", artwork: "/brand/home-co-create.webp", tone: "co-create" },
  { href: "/events", title: "活动赛事", subtitle: "在线下相遇，让共创发生", artwork: "/brand/home-events-scene.webp", tone: "events" },
  { href: null, title: "共创档案", subtitle: "让每一次共创留下痕迹", artwork: "/brand/home-archive.webp", tone: "archive" },
] as const;

const communityLoop = [
  { label: "发现", description: "发现议题、活动与真实需求" },
  { label: "连接", description: "在共建地图找到同行者" },
  { label: "共创", description: "加入网络，发起双向连接" },
  { label: "落地", description: "组队协作，把想法变成行动" },
  { label: "沉淀", description: "让作品、经验与贡献持续可见" },
] as const;

const communityLoopPath = "M90 110C200 40 285 45 360 70C450 100 510 125 600 110C690 95 760 50 840 70C930 90 1010 75 1110 110C1170 135 1185 215 1110 245C850 292 350 292 90 245C15 215 25 140 90 110Z";

export default function Home() {
  return (
    <main className="brand-shell">
      <div className="brand-home-stage">
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
          <h1 id="hero-title"><span className="hero-title-line">让愿意行动的人</span><span className="hero-title-line"><span className="hero-title-accent">彼此看见</span>。</span><span className="hero-title-line">让想做的事</span><span className="hero-title-line"><span className="hero-title-warm">找到同行者</span>。</span></h1>
          <p className="brand-intro">以 AI 为共同议题，以高校青年为主要参与者。<br />连接人、想法与行动，<br />让一次相遇，成为下一次共创的开始。</p>
          <div className="brand-hero-actions">
            <a className="brand-primary-action" href="/map">加入共建地图 <span>→</span></a>
            <a className="brand-secondary-action" href="/co-create">看看大家在做什么 <span>→</span></a>
          </div>
        </div>
        <div className="hero-channel-grid" aria-label="探索广州 AI 共创社">
          {homeChannels.map((channel, index) => {
            const content = <>
              <Image src={channel.artwork} alt="" fill sizes="(max-width: 720px) 45vw, (max-width: 1100px) 28vw, 22vw" unoptimized />
              <span className="hero-channel-sheen" aria-hidden="true" />
              <span className="hero-channel-copy">
                <span className="hero-channel-number">0{index + 1}</span>
                <h2>{channel.title}</h2>
                <span>{channel.subtitle}</span>
              </span>
              <span className="hero-channel-arrow" aria-hidden="true">↗</span>
            </>;

            return channel.href
              ? <a className={`hero-channel-card hero-channel-${channel.tone}`} href={channel.href} key={channel.title} style={{ "--card-index": index } as React.CSSProperties}>{content}</a>
              : <details className="hero-channel-card hero-channel-archive" key={channel.title} style={{ "--card-index": index } as React.CSSProperties}>
                  <summary>{content}</summary>
                  <span className="hero-channel-unavailable">暂未开放</span>
                </details>;
          })}
        </div>
      </section>
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
            <div><strong>{step.label}</strong><p>{step.description}</p></div>
          </li>)}
        </ol>
      </section>
      </div>
      <footer className="site-footer" aria-label="网站页脚">
        <div className="site-footer-grid">
          <section className="site-footer-brand"><strong>✦ 广州 AI 共创社 <small>GZAIB</small></strong><p>连接高校 AI 共建者，让项目、活动与资源持续发生。</p><div aria-label="社交渠道"><span>公众号</span><span>小红书</span><span>邮箱</span></div></section>
          <nav aria-label="平台"><h2>平台</h2><a href="/map">共建地图</a><a href="/co-create">共创广场</a><a href="/events">活动赛事</a><a href="/about#co-create-archive">共创档案</a></nav>
          <nav aria-label="共建与连接"><h2>共建与连接</h2><a href="/apply">申请加入</a><a href="/me/connections">我的连接</a><a href="/apply">共建者认证</a><a href="/events/submit">活动申请</a></nav>
          <section className="site-footer-qr"><h2>关注公众号</h2><Image src="/brand/official-account-qr.jpg" alt="广州 AI 共创社公众号二维码" width={112} height={112} unoptimized /><p>扫码关注广州 AI 共创社</p></section>
        </div>
        <div className="site-footer-legal">公开资料由本人授权，经学校聚合与运营审核后展示。联系方式仅在双方同意连接后交换。</div>
        <div className="site-footer-bottom"><span>广州 AI 共创社 · 由高校青年共同建设</span><span>© 2026 GZAIB</span></div>
      </footer>
    </main>
  );
}
