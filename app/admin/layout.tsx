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
            <a href="/admin/members/new">＋<span>手动录入成员</span></a>
            <a href="/admin">⌂ <span>概览</span></a>
            <a href="/admin/applications">● <span>成员申请</span></a>
            <a href="/admin/activities">✦ <span>活动申请</span></a>
            <a href="/admin/communities">◈ <span>AI 社群审核</span></a>
            <a href="/admin/schools">⌖ <span>学校坐标</span></a>
            <a href="/admin/contributions">◇ <span>贡献确认</span></a>
            <a href="/admin/members">○ <span>成员管理</span></a>
          </nav>
          <p>运营操作仅限管理员账号，关键变更会写入审计记录。</p>
        </aside>
        <section className="admin-content">{children}</section>
      </div>
    </main>
  );
}
