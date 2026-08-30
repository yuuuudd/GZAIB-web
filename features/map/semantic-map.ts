import type { DirectorySchool } from "../directory/service";

export type MapLevel = "province" | "city";

export type MapPoint = {
  lng: number;
  lat: number;
};

export type MapCitySummary = {
  city: string;
  memberCount: number;
  schoolCount: number;
  center: MapPoint;
  schools: DirectorySchool[];
};

export const DEFAULT_CITY = "广州";
export const GUANGDONG_CENTER: MapPoint = { lng: 113.2665, lat: 23.1322 };
export const CITY_ZOOM_THRESHOLD = 9.25;

const CITY_CENTERS: Record<string, MapPoint> = {
  广州: { lng: 113.2644, lat: 23.1291 },
  深圳: { lng: 114.0579, lat: 22.5431 },
  珠海: { lng: 113.5767, lat: 22.2707 },
  汕头: { lng: 116.6819, lat: 23.3541 },
  佛山: { lng: 113.1214, lat: 23.0215 },
  韶关: { lng: 113.5972, lat: 24.8104 },
  湛江: { lng: 110.3594, lat: 21.2707 },
  肇庆: { lng: 112.4651, lat: 23.0472 },
  江门: { lng: 113.0815, lat: 22.5787 },
  茂名: { lng: 110.9255, lat: 21.6633 },
  惠州: { lng: 114.4162, lat: 23.1115 },
  梅州: { lng: 116.1226, lat: 24.2886 },
  汕尾: { lng: 115.3751, lat: 22.7862 },
  河源: { lng: 114.7002, lat: 23.7437 },
  阳江: { lng: 111.9822, lat: 21.8579 },
  清远: { lng: 113.056, lat: 23.6818 },
  东莞: { lng: 113.7518, lat: 23.0207 },
  中山: { lng: 113.3928, lat: 22.5176 },
  潮州: { lng: 116.6226, lat: 23.6567 },
  揭阳: { lng: 116.3727, lat: 23.5497 },
  云浮: { lng: 112.0445, lat: 22.9151 },
};

export function normalizeCity(value: string): string {
  return value.normalize("NFKC").trim().replace(/(?:市|地区)$/u, "") || DEFAULT_CITY;
}

function usableCoordinate(school: DirectorySchool): boolean {
  return Number.isFinite(school.lng)
    && Number.isFinite(school.lat)
    && school.lng >= 109
    && school.lng <= 118
    && school.lat >= 20
    && school.lat <= 26;
}

function cityCenter(city: string, schools: DirectorySchool[]): MapPoint {
  const located = schools.filter(usableCoordinate);
  const weight = located.reduce((sum, school) => sum + Math.max(1, school.memberCount), 0);
  if (weight > 0) {
    return {
      lng: located.reduce((sum, school) => sum + school.lng * Math.max(1, school.memberCount), 0) / weight,
      lat: located.reduce((sum, school) => sum + school.lat * Math.max(1, school.memberCount), 0) / weight,
    };
  }
  return CITY_CENTERS[city] ?? GUANGDONG_CENTER;
}

export function groupSchoolsByCity(schools: DirectorySchool[]): MapCitySummary[] {
  const grouped = new Map<string, DirectorySchool[]>();
  for (const school of schools) {
    const city = normalizeCity(school.city);
    grouped.set(city, [...(grouped.get(city) ?? []), school]);
  }
  return [...grouped.entries()]
    .map(([city, citySchools]) => ({
      city,
      memberCount: citySchools.reduce((sum, school) => sum + school.memberCount, 0),
      schoolCount: citySchools.length,
      center: cityCenter(city, citySchools),
      schools: [...citySchools].sort((left, right) => right.memberCount - left.memberCount || left.name.localeCompare(right.name, "zh-CN")),
    }))
    .sort((left, right) => right.memberCount - left.memberCount || left.city.localeCompare(right.city, "zh-CN"));
}

export function semanticLevelForZoom(zoom: number): MapLevel {
  return zoom >= CITY_ZOOM_THRESHOLD ? "city" : "province";
}

export function resolveActiveCity(activeCity: string | undefined, _summaries: MapCitySummary[]): string {
  return activeCity ? normalizeCity(activeCity) : DEFAULT_CITY;
}

export function schoolsForCity(summaries: MapCitySummary[], city: string): DirectorySchool[] {
  return summaries.find((summary) => summary.city === normalizeCity(city))?.schools ?? [];
}

export function centerForCity(summaries: MapCitySummary[], city: string): MapPoint {
  const normalized = normalizeCity(city);
  return summaries.find((summary) => summary.city === normalized)?.center
    ?? CITY_CENTERS[normalized]
    ?? GUANGDONG_CENTER;
}
