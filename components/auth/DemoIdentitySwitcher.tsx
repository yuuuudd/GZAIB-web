export function DemoIdentitySwitcher() {
  return (
    <aside className="demo-switcher" aria-label="演示身份切换">
      <p className="demo-switcher-label">演示模式：此处不是真实账户</p>
      <div className="demo-switcher-actions">
        <form action="/api/auth/demo-login" method="post">
          <input type="hidden" name="identity" value="member" />
          <button className="demo-switcher-member" type="submit">以共建者体验</button>
        </form>
        <form action="/api/auth/demo-login" method="post">
          <input type="hidden" name="identity" value="admin" />
          <button className="demo-switcher-admin" type="submit">以运营员体验</button>
        </form>
        <form action="/api/auth/logout" method="post">
          <button className="demo-switcher-logout" type="submit">退出演示</button>
        </form>
      </div>
    </aside>
  );
}
