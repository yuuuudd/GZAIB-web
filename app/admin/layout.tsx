import Image from "next/image";
import Link from "next/link";
import { requireAdminPage } from "./admin-session";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdminPage();
  return (
    <main className="admin-shell">
      <header className="admin-header">
        <a className="admin-brand" href="/admin"><Image src="/logo.png" alt="广州AI共创社" width={42} height={42} priority /><strong>广州AI共创社</strong><span>运营后台</span></a>
        <Link className="admin-map-link" href="/">返回公开地图 ↗</Link>
      </header>
      <div className="admin-workspace">
        <aside className="admin-sidebar" aria-label="运营后台导航">
          <nav>
            <a href="/admin">⌂ <span>概览</span></a>
            <a href="/admin/applications">● <span>成员申请</span></a>
            <a href="/admin/schools">⌖ <span>学校坐标</span></a>
            <a href="/admin/contributions">◇ <span>贡献确认</span></a>
            <a href="/admin/members">○ <span>成员管理</span></a>
          </nav>
          <p>演示后台仅供固定运营员身份体验。所有操作均写入审计记录。</p>
        </aside>
        <section className="admin-content">{children}</section>
      </div>
    </main>
  );
}
