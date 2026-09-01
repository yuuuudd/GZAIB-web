import { EcosystemMapSwitcher } from "../components/map/EcosystemMapSwitcher";
import Image from "next/image";
import Link from "next/link";

export default function Home() {
  return (
    <main className="brand-shell">
      <header className="brand-header">
        <a className="brand-mark" href="#top" aria-label="广州AI共创社首页">
          <Image src="/logo.png" alt="广州AI共创社" width={44} height={44} priority />
          <span>广州AI共创社</span>
        </a>
        <nav className="brand-nav" aria-label="主导航">
          <a className="brand-nav-active" href="#map">共建地图</a><Link href="/communities">AI 社群</Link><a href="#how-it-works">如何点亮</a><a href="#about">关于我们</a>
        </nav>
        <a className="brand-header-action" href="/admin">管理员入口</a>
      </header>
      <section className="brand-hero" id="top" aria-labelledby="hero-title">
        <div className="hero-glow hero-glow-blue" aria-hidden="true" /><div className="hero-glow hero-glow-orange" aria-hidden="true" />
        <p className="brand-eyebrow">广东高校 · 青年共建网络</p>
        <h1 id="hero-title"><span className="hero-title-line">让广东每一所高校，</span><span className="hero-title-line">都亮起一束<span className="hero-title-accent">共建的光</span>。</span></h1>
        <p className="brand-intro">看见彼此，连接不同学校、不同城市里愿意分享、愿意行动的年轻人。</p>
        <div className="brand-hero-actions"><a className="brand-primary-action" href="/apply">申请点亮我的头像 <span>→</span></a><a className="brand-secondary-action" href="#map">看看谁已加入 <span>↓</span></a></div>
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
