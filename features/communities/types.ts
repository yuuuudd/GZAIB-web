export type CommunityLocationMode = "city" | "hybrid" | "online";

export type CommunityProfileInput = {
  name: string;
  summary: string;
  primaryCity: string | null;
  locationMode: CommunityLocationMode;
  focusTags: string[];
  officialUrl: string;
  sourceUrl: string;
  sourceLabel: string;
};

export type CommunityDirectoryQuery = {
  category?: "推荐" | "广东" | "全国" | "高校" | "开发者" | "创业落地" | "线下活动";
  q?: string;
  city?: string;
  locationMode?: CommunityLocationMode;
  focus?: string;
};

export type PublicCommunityUpdate = {
  id: string;
  title: string;
  summary: string;
  occurredAt: number;
  sourceUrl?: string;
};

export type PublicCommunity = CommunityProfileInput & {
  id: string;
  slug: string;
  claimed: boolean;
  updatedAt: number;
  contactSlug?: string;
  updates: PublicCommunityUpdate[];
  followed?: boolean;
};
