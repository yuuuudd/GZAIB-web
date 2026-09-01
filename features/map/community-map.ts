import type { PublicCommunity } from "../communities/types";
import { centerForCity, type MapPoint } from "./semantic-map";

export type CommunityCitySummary = {
  city: string;
  communityCount: number;
  center: { lng: number; lat: number };
  communities: Pick<PublicCommunity, "id" | "slug" | "name" | "summary" | "focusTags">[];
};

const GUANGDONG_CITIES = new Set(["广州", "深圳", "珠海", "汕头", "佛山", "韶关", "湛江", "肇庆", "江门", "茂名", "惠州", "梅州", "汕尾", "河源", "阳江", "清远", "东莞", "中山", "潮州", "揭阳", "云浮"]);
const NATIONAL_CITY_CENTERS: Record<string, MapPoint> = {
  北京: { lng: 116.4074, lat: 39.9042 }, 上海: { lng: 121.4737, lat: 31.2304 }, 杭州: { lng: 120.1551, lat: 30.2741 },
  成都: { lng: 104.0665, lat: 30.5728 }, 武汉: { lng: 114.3054, lat: 30.5931 }, 西安: { lng: 108.9398, lat: 34.3416 },
};

function centerForCommunityCity(city: string): MapPoint | undefined {
  if (GUANGDONG_CITIES.has(city)) return centerForCity([], city);
  return NATIONAL_CITY_CENTERS[city];
}

export function communityCity(community: Pick<PublicCommunity, "primaryCity" | "locationMode">): string | undefined {
  if (community.locationMode === "online" || !community.primaryCity?.trim()) return undefined;
  const city = community.primaryCity.normalize("NFKC").trim().replace(/(?:市|地区)$/u, "").trim();
  return city || undefined;
}

export function displayedCommunityCityCount(items: PublicCommunity[]): number {
  return new Set(items.map(communityCity).filter((city): city is string => Boolean(city))).size;
}

export function groupCommunitiesByCity(items: PublicCommunity[]): CommunityCitySummary[] {
  const grouped = new Map<string, CommunityCitySummary["communities"]>();
  for (const community of items) {
    const city = communityCity(community);
    if (!city || !centerForCommunityCity(city)) continue;
    grouped.set(city, [...(grouped.get(city) ?? []), { id: community.id, slug: community.slug, name: community.name, summary: community.summary, focusTags: community.focusTags }]);
  }
  return [...grouped.entries()].map(([city, communities]) => ({ city, communityCount: communities.length, center: centerForCommunityCity(city)!, communities: [...communities].sort((left, right) => left.name.localeCompare(right.name, "zh-CN")) })).sort((left, right) => right.communityCount - left.communityCount || left.city.localeCompare(right.city, "zh-CN"));
}
