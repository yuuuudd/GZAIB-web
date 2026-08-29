import { count, countDistinct, eq, sql } from "drizzle-orm";
import { getDb } from "../../db";
import { applications, dailyMetrics, memberProfiles, schools } from "../../db/schema";
import { DemoSeedButton } from "../../components/admin/DemoSeedButton";
import { requireAdminPage } from "./admin-session";

export default async function AdminPage() {
  await requireAdminPage();
  const db = getDb();
  const [[approved], [builders], [schoolTotal], [cityTotal], [pending], [profileViews], [mapVisits]] = await Promise.all([
    db.select({ value: count() }).from(applications).where(eq(applications.status, "approved")),
    db.select({ value: count() }).from(memberProfiles).where(eq(memberProfiles.verifiedBuilder, true)),
    db.select({ value: count() }).from(schools).where(eq(schools.coordinateStatus, "confirmed")),
    db.select({ value: countDistinct(schools.city) }).from(schools).where(eq(schools.coordinateStatus, "confirmed")),
    db.select({ value: count() }).from(applications).where(eq(applications.status, "pending")),
    db.select({ value: sql<number>`coalesce(sum(${dailyMetrics.count}), 0)` }).from(dailyMetrics).where(eq(dailyMetrics.eventType, "profile_view")),
    db.select({ value: sql<number>`coalesce(sum(${dailyMetrics.count}), 0)` }).from(dailyMetrics).where(eq(dailyMetrics.eventType, "map_to_profile")),
  ]);
  const stats = [
    ["审核通过成员", approved?.value ?? 0, "blue"], ["认证共建者", builders?.value ?? 0, "orange"],
    ["已确认学校", schoolTotal?.value ?? 0, "blue"], ["覆盖城市", cityTotal?.value ?? 0, "orange"],
    ["待审核申请", pending?.value ?? 0, "orange"], ["资料浏览", profileViews?.value ?? 0, "blue"],
    ["地图到资料访问", mapVisits?.value ?? 0, "blue"],
  ] as const;
  return <><header className="admin-page-heading"><div><p className="admin-kicker">运营概览</p><h1>让每一束光安全、真实地亮起</h1><p>这里仅显示社区级汇总，不公开个人连接数量或社交排名。</p></div><DemoSeedButton /></header><section className="admin-stat-grid">{stats.map(([label, value, color]) => <article className={`admin-stat ${color}`} key={label}><span>{label}</span><strong>{value}</strong></article>)}</section><section className="admin-guidance"><div><p className="admin-kicker">今日工作台</p><h2>先确认坐标，再审核公开边界</h2></div><ol><li><strong>01</strong><span>处理待审核申请，确认公开必填字段。</span></li><li><strong>02</strong><span>人工确认服务器提出的学校坐标。</span></li><li><strong>03</strong><span>确认公开贡献，形成真实的跨校协作线。</span></li></ol></section></>;
}
