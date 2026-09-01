type PrimaryChannel = "map" | "communities" | "news" | "events";

const channels: Array<{ id: PrimaryChannel; href: string; label: string }> = [
  { id: "map", href: "/#map", label: "共建地图" },
  { id: "communities", href: "/communities", label: "AI 社群" },
  { id: "news", href: "/news", label: "AI 资讯" },
  { id: "events", href: "/events", label: "活动赛事" },
];

export function PrimaryNavigation({ active }: { active?: PrimaryChannel }) {
  return <nav className="brand-nav" aria-label="主导航">
    {channels.map((channel) => <a
      key={channel.id}
      className={active === channel.id ? "brand-nav-active" : undefined}
      href={channel.href}
      aria-current={active === channel.id ? (channel.id === "map" ? "location" : "page") : undefined}
    >{channel.label}</a>)}
  </nav>;
}
