type PrimaryChannel = "home" | "map" | "co-create" | "communities" | "news" | "events" | "about" | "me";

const channels: Array<{ id: PrimaryChannel; href: string; label: string }> = [
  { id: "home", href: "/", label: "首页" },
  { id: "map", href: "/map", label: "共建地图" },
  { id: "co-create", href: "/co-create", label: "共创广场" },
  { id: "events", href: "/events", label: "活动赛事" },
  { id: "about", href: "/about", label: "关于我们" },
];

export function PrimaryNavigation({ active }: { active?: PrimaryChannel }) {
  return <nav className="brand-nav" aria-label="主导航">
    {channels.map((channel) => <a
      key={channel.id}
      className={active === channel.id ? "brand-nav-active" : undefined}
      href={channel.href}
      aria-current={active === channel.id ? "page" : undefined}
    >{channel.label}</a>)}
  </nav>;
}
