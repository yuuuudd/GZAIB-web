import Link from "next/link";
import { requireAdminPage } from "../admin-session";
import { createRuntimeSafetyService } from "../../../features/safety/service";
import { ReportReviewPanel } from "../../../components/admin/ReportReviewPanel";
export const dynamic = "force-dynamic";
export default async function ReportsPage() {
  const adminId = await requireAdminPage();
  const reports = await (await createRuntimeSafetyService()).listReportsForAdmin(adminId);
  return <main className="admin-shell"><header><Link href="/admin">运营后台</Link><h1>举报处理</h1><p>仅显示处理所需的最小上下文；不会在成员页面暴露举报者信息。</p></header><section>{reports.length ? reports.map((report) => <ReportReviewPanel key={report.id} reportId={report.id} category={report.category} description={report.description} status={report.status} resolution={report.resolution} />) : <p>暂无举报。</p>}</section></main>;
}
