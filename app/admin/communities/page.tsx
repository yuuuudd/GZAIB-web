import { CommunityReviewPanel } from "../../../components/admin/CommunityReviewPanel";
import { createRuntimeCommunityAdminService } from "../../../features/admin/communities";
import { requireAdminPage } from "../admin-session";

export const dynamic = "force-dynamic";

export default async function AdminCommunitiesPage() {
  await requireAdminPage();
  const reviews = await (await createRuntimeCommunityAdminService()).listPending();
  const count = reviews.profiles.length + reviews.claims.length + reviews.updates.length;
  return (
    <>
      <header className="admin-page-heading">
        <div><p className="admin-kicker">AI 社群审核</p><h1>审核后才进入公开生态</h1><p>核对来源、字段差异与认领证明；公开资料只从已存储的待审核记录发布。</p></div>
        <span className="heading-count">{count} 条待审核</span>
      </header>
      <CommunityReviewPanel reviews={reviews} />
    </>
  );
}
