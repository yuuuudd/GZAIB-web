import { BrandHomeLink } from "../../components/navigation/BrandHomeLink";
import { PrimaryNavigation } from "../../components/navigation/PrimaryNavigation";

const screens = [
  { src: "/about/01-about-gzaib.webp", alt: "广州 AI 共创社：让愿意行动的人彼此看见" },
  { src: "/about/02-position-background.webp", alt: "AI 是共同议题，不是我们的边界" },
  { src: "/about/04-co-creation-loop-background.webp", alt: "广州 AI 共创社的共创飞轮" },
] as const;

const orbitCards = [
  ["人", "让愿意行动的人\n彼此看见"],
  ["高校", "汇聚高校力量，\n激发青年创造力"],
  ["社群", "多元社群共建，\n持续成长"],
  ["想法", "好想法在这里\n被看见"],
  ["项目", "孵化优质项目，\n连接资源与机会"],
  ["成果", "沉淀共创成果，\n放大影响力"],
  ["行动", "从灵感到实践，\n一起行动"],
] as const;

const positionPillars = [
  "AI / 共同议题",
  "青年 / 主要参与者",
  "共创 / 核心方法",
] as const;

const loopSteps = [["01", "让人被看见"], ["02", "让组织被发现"], ["03", "让想法找到人"], ["04", "让行动真的发生"], ["05", "让每次行动留下东西"]] as const;
const loopCards = [["共建地图", "学校 / 城市 / 技能 /\n正在做什么"], ["AI 社群", "发现不同高校\n与社区组织"], ["共创广场", "找伙伴 / 找资源 /\n找机会"], ["活动赛事", "工作坊 / 线下活动 /\nHackathon"], ["共创档案", "作品 / 贡献 /\n合作 / 记录"]] as const;

export default function AboutPage() {
  return <main className="about-shell">
    <header className="brand-header about-header"><BrandHomeLink /><PrimaryNavigation active="about" /><a className="brand-header-action" href="/me">我的</a></header>
    {screens.map((screen, index) => <section className={`about-screen${index === 0 ? " about-hero" : index === 1 ? " about-position" : index === 2 ? " about-loop" : ""}`} key={screen.src}>
      <picture className="about-artwork"><source media="(min-width: 721px)" srcSet={screen.src} />{/* Desktop artwork is decorative; mobile uses the live text layout. */}<img src="data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=" alt="" width={1672} height={941} loading={index === 0 ? "eager" : "lazy"} decoding="async" /></picture>
      {index === 0 ? <>
        <div className="about-hero-overlay">
          <p className="about-kicker"><span />ABOUT GZAIB · 关于我们</p>
          <h1>让愿意行动的人<br /><em>彼此看见</em>。<br />让想做的事<br /><strong>找到同行者</strong>。</h1>
          <p className="about-lead">以 AI 为共同议题，以高校青年为主要参与者，以连接和共创为方法。</p>
          <p className="about-description">我们不是一个简单的 AI 兴趣社团，也不只是活动的组织者，<br />而是一个开放的共创网络，持续连接人、社群、想法与行动，<br />让更多有热情的你，一起把想法变成影响。</p>
        </div>
        <p className="about-core-copy"><span>连接</span> + <b>行动</b></p>
        <div className="about-orbit-cards">{orbitCards.map(([title, description], cardIndex) => <p className={`about-orbit-card about-orbit-card-${cardIndex + 1}`} key={title}><b>{title}</b><span>{description}</span></p>)}</div>
      </> : null}
      {index === 1 ? <div className="about-position-overlay">
        <div className="about-position-heading"><p className="about-position-kicker"><span />OUR POSITION · 我们的位置</p><h2>AI 是共同议题，<br /><em>不是我们的边界</em>。</h2></div>
        <div className="about-position-pillars">{positionPillars.map((title) => <p key={title}><b>{title}</b></p>)}</div>
        <p className="about-position-closing"><span>AI</span> 把我们聚在一起，但真正让社群持续生长的，<br />是人与人之间的<span>连接</span>，以及连接后发生的<span className="orange">行动</span>。</p>
      </div> : null}
      {index === 2 ? <div className="about-loop-overlay">
        <div className="about-loop-intro"><p>CO-CREATION ARCHIVE · 共创档案</p><h2>让每一次行动，<br />留下<em>共创的痕迹</em>。</h2><span>记录项目、活动与连接，<br />让已经发生的共创成为下一次合作的起点。</span></div>
        <p className="about-loop-core"><span>共</span><b>创</b></p>
        <div className="about-loop-steps">{loopSteps.map(([number, title], stepIndex) => <p className={`about-loop-step about-loop-step-${stepIndex + 1}`} key={number}><b>{number}</b><span>{title}</span></p>)}</div>
        <div className="about-loop-cards">{loopCards.map(([title, description], cardIndex) => <p id={title === "共创档案" ? "co-create-archive" : undefined} className={`about-loop-card about-loop-card-${cardIndex + 1}`} key={title}><b>{title}</b><span>{description}</span></p>)}</div>
      </div> : null}
    </section>)}
  </main>;
}
