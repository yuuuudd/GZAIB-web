export function PrimaryNavigation() {
  return <nav className="brand-nav" aria-label="主导航">
    {/* Vinext's client Link interception is not reliable in every preview host; keep full-page browser fallback. */}
    {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
    <a href="/">共建地图</a>
    <a href="/apply">申请点亮</a>
  </nav>;
}
