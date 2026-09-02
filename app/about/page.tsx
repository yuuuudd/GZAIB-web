import Image from "next/image";
import { BrandHomeLink } from "../../components/navigation/BrandHomeLink";
import { PrimaryNavigation } from "../../components/navigation/PrimaryNavigation";

const screens = [
  { src: "/about/01-about-gzaib.png", alt: "广州 AI 共创社：让愿意行动的人彼此看见" },
  { src: "/about/02-position.png", alt: "AI 是共同议题，不是我们的边界" },
  { src: "/about/03-connection-action.png", alt: "连接与行动" },
  { src: "/about/04-co-creation-loop.png", alt: "广州 AI 共创社的共创飞轮" },
] as const;

export default function AboutPage() {
  return <main className="about-shell">
    <header className="brand-header about-header"><BrandHomeLink /><PrimaryNavigation active="about" /><a className="brand-header-action" href="/me">我的</a></header>
    {screens.map((screen) => <section className="about-screen" key={screen.src}>
      <Image src={screen.src} alt={screen.alt} fill sizes="100vw" priority={screen.src === screens[0].src} unoptimized />
    </section>)}
  </main>;
}
