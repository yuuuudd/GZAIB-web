export default function Home() {
  return (
    <main className="brand-shell">
      <header className="brand-header">
        <a className="brand-mark" href="#top" aria-label="广州AI共创社首页">
          <img src="/logo.png" alt="广州AI共创社" width="44" height="44" />
          <span>广州AI共创社</span>
        </a>
        <nav className="brand-nav" aria-label="主导航">
          <a href="#map">共建地图</a><a href="#records">共建记录</a><a href="#about">关于我们</a>
        </nav>
        <a className="brand-header-action" href="/apply">申请点亮我的头像</a>
      </header>
      <section className="brand-hero" id="top" aria-labelledby="hero-title">
        <p className="brand-eyebrow">广东高校共建者地图</p>
        <h1 id="hero-title">让广东每一所高校，都亮起一束共建的光</h1>
        <p className="brand-intro">看见愿意分享、愿意行动的青年共建者；从一所学校开始，连接一座城市的创造力。</p>
        <div className="brand-hero-actions">
          <a className="brand-primary-action" href="/apply">申请点亮我的头像</a>
          <a className="brand-secondary-action" href="#map">浏览共建地图</a>
        </div>
        <p className="brand-privacy-note">仅展示审核通过且本人同意公开的信息，不采集个人实时位置。</p>
      </section>
      <section className="brand-map-placeholder" id="map" aria-label="共建地图预览">
        <div className="brand-map-grid" aria-hidden="true" />
        <div className="brand-map-glow brand-map-glow-one" aria-hidden="true" />
        <div className="brand-map-glow brand-map-glow-two" aria-hidden="true" />
        <div className="brand-map-glow brand-map-glow-three" aria-hidden="true" />
        <div className="brand-map-copy"><p>共建地图正在点亮</p><span>学校、城市与真实行动，会在这里相遇。</span></div>
      </section>
      <section className="brand-promise" id="records" aria-label="共建承诺"><p>提交资料</p><span>选择公开内容</span><span>运营审核</span><span>地图点亮</span></section>
    </main>
  );
}
