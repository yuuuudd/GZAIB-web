import { EcosystemMapSwitcher } from "../components/map/EcosystemMapSwitcher";
import { PrimaryNavigation } from "../components/navigation/PrimaryNavigation";
import Image from "next/image";

const homeChannels = [
  { href: "#map", title: "共建地图", subtitle: "点亮高校，连接广东", artwork: "/brand/home-map.webp", tone: "map" },
  { href: "/communities", title: "AI 社区", subtitle: "连接同频，共创未来", artwork: "/brand/home-community.webp", tone: "community" },
  { href: "/news", title: "AI 资讯", subtitle: "洞察前沿，启发更多", artwork: "/brand/home-news.webp", tone: "news" },
  { href: "/events", title: "活动赛事", subtitle: "发现活动，参与共建", artwork: "/brand/home-events.webp", tone: "events" },
] as const;

export default function Home() {
  return (
    <main className="brand-shell">
      <header className="brand-header">
        <a className="brand-mark" href="#top" aria-label="广州AI共创社首页">
          <Image src="/brand/gzaib-horizontal.png" alt="广州 AI 共创社 GZAIB" width={276} height={106} priority unoptimized />
        </a>
        <PrimaryNavigation active="map" />
        <a className="brand-header-action" href="/admin">管理员入口</a>
      </header>
      <section className="brand-home-hero" id="top" aria-labelledby="hero-title">
        <div className="brand-home-copy">
          <p className="brand-eyebrow">广东高校 · 青年共建网络</p>
          <h1 id="hero-title"><span className="hero-title-line">让广东每一所高校，</span><span className="hero-title-line">都亮起一束<span className="hero-title-accent">共建的光</span>。</span></h1>
          <p className="brand-intro">看见彼此，连接不同学校、不同城市里愿意分享、愿意行动的年轻人。</p>
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
      <section className="approval-flow" id="how-it-works" aria-labelledby="approval-title">
        <div className="approval-heading"><p className="map-section-kicker">一束光如何亮起</p><h2 id="approval-title">真实、本人选择、经过审核</h2><p>四个步骤，把公开边界和共建信任讲清楚。</p></div>
        <ol>
          <li><span>01</span><i aria-hidden="true">填</i><div><strong>提交资料</strong><p>填写学校与个人简介</p></div></li>
          <li><span>02</span><i aria-hidden="true">选</i><div><strong>本人选择公开内容</strong><p>逐项选择头像与可见信息</p></div></li>
          <li><span>03</span><i aria-hidden="true">审</i><div><strong>运营审核</strong><p>人工确认资料真实可靠</p></div></li>
          <li><span>04</span><i aria-hidden="true">亮</i><div><strong>学校点亮</strong><p>通过后在目录与地图出现</p></div></li>
        </ol>
      </section>
      <section className="brand-about" id="about"><div><p className="map-section-kicker">广州AI共创社</p><h2>连接创造力，也尊重每一条边界</h2></div><p>这不是成员实时位置地图，而是一份由本人授权、学校聚合、运营审核的公开共建目录。</p><a href="/apply">申请加入共建网络 →</a></section>
    </main>
  );
}
