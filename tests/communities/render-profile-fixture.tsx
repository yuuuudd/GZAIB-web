import { renderToStaticMarkup } from "react-dom/server";
import { CommunityProfile } from "../../components/communities/CommunityProfile";
import { createCommunityDirectoryService } from "../../features/communities/service";

const now = 1_700_000_000_000;
const service = createCommunityDirectoryService({
  async listPublished() { return []; },
  async findPublishedBySlug() {
    return {
      id: "fixture-community", slug: "fixture-ai-community", name: "公开 AI 社群", summary: "面向共建者的公开社群简介。", primaryCity: "广州", locationMode: "hybrid", focusTagsJson: '["AI 应用","智能体"]',
      officialUrl: "https://community.example.test", sourceUrl: "https://source.example.test", sourceLabel: "公开来源", publishStatus: "published", createdAt: now, updatedAt: now,
    } as never;
  },
  async listPublishedUpdates() {
    return [{
      id: "update-1", communityId: "fixture-community", submitterUserId: "submitter-private-id", title: "公开动态标题", summary: "这是一条已发布的公开动态。", occurredAt: now,
      sourceUrl: "https://updates.example.test/post", status: "published", submittedAt: now, reviewedAt: now, reviewedBy: "reviewer-private-id", reviewReason: "reviewReason-private", createdAt: now, updatedAt: now,
    }] as never;
  },
  async listManagerContacts() { return [{ communityId: "fixture-community", memberSlug: "community-owner" }]; },
  async listClaimedCommunityIds() { return ["fixture-community"]; },
  async listFollowedCommunityIds() { return []; },
});

const community = await service.getBySlug("fixture-ai-community");
if (!community) throw new Error("Fixture community was not published");
process.stdout.write(renderToStaticMarkup(<CommunityProfile community={community} isLoggedIn={false} />));
