import type { DirectorySchool } from "../directory/service";
import { normalizeProvince } from "../schools/location";

export type MapLevel = "country" | "province" | "city";

export type MapPoint = {
  lng: number;
  lat: number;
};

export type MapCitySummary = {
  province: string;
  city: string;
  memberCount: number;
  schoolCount: number;
  center: MapPoint;
  schools: DirectorySchool[];
};

export type MapProvinceSummary = {
  province: string;
  memberCount: number;
  schoolCount: number;
  cityCount: number;
  center: MapPoint;
  cities: MapCitySummary[];
};

export const DEFAULT_CITY = "广州";
export const DEFAULT_PROVINCE = "广东";
export const COUNTRY_CENTER: MapPoint = { lng: 104.1954, lat: 35.8617 };
export const GUANGDONG_CENTER: MapPoint = { lng: 113.2665, lat: 23.1322 };
export const CITY_ZOOM_THRESHOLD = 9.25;
export const PROVINCE_ZOOM_THRESHOLD = 5.5;

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
    && school.lng >= 73
    && school.lng <= 135
    && school.lat >= 3
    && school.lat <= 54;
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
  return CITY_CENTERS[city] ?? COUNTRY_CENTER;
}

export function groupSchoolsByCity(schools: DirectorySchool[]): MapCitySummary[] {
  const grouped = new Map<string, { province: string; city: string; schools: DirectorySchool[] }>();
  for (const school of schools) {
    const province = normalizeProvince(school.province);
    const city = normalizeCity(school.city);
    const key = `${province}\u0000${city}`;
    const entry = grouped.get(key) ?? { province, city, schools: [] };
    entry.schools.push(school);
    grouped.set(key, entry);
  }
  return [...grouped.values()]
    .map(({ province, city, schools: citySchools }) => ({
      province,
      city,
      memberCount: citySchools.reduce((sum, school) => sum + school.memberCount, 0),
      schoolCount: citySchools.length,
      center: cityCenter(city, citySchools),
      schools: [...citySchools].sort((left, right) => right.memberCount - left.memberCount || left.name.localeCompare(right.name, "zh-CN")),
    }))
    .sort((left, right) => right.memberCount - left.memberCount || left.city.localeCompare(right.city, "zh-CN"));
}

export function groupSchoolsByProvince(schools: DirectorySchool[]): MapProvinceSummary[] {
  const grouped = new Map<string, MapCitySummary[]>();
  for (const city of groupSchoolsByCity(schools)) {
    grouped.set(city.province, [...(grouped.get(city.province) ?? []), city]);
  }
  return [...grouped.entries()].map(([province, cities]) => {
    const weight = cities.reduce((sum, city) => sum + Math.max(1, city.memberCount), 0);
    return {
      province,
      memberCount: cities.reduce((sum, city) => sum + city.memberCount, 0),
      schoolCount: cities.reduce((sum, city) => sum + city.schoolCount, 0),
      cityCount: cities.length,
      center: {
        lng: cities.reduce((sum, city) => sum + city.center.lng * Math.max(1, city.memberCount), 0) / weight,
        lat: cities.reduce((sum, city) => sum + city.center.lat * Math.max(1, city.memberCount), 0) / weight,
      },
      cities,
    };
  }).sort((left, right) => right.memberCount - left.memberCount || left.province.localeCompare(right.province, "zh-CN"));
}

export function citiesForProvince(summaries: MapProvinceSummary[], province: string): MapCitySummary[] {
  return summaries.find((summary) => summary.province === normalizeProvince(province))?.cities ?? [];
}

export function centerForProvince(summaries: MapProvinceSummary[], province: string): MapPoint {
  return summaries.find((summary) => summary.province === normalizeProvince(province))?.center
    ?? (normalizeProvince(province) === DEFAULT_PROVINCE ? GUANGDONG_CENTER : COUNTRY_CENTER);
}

export function semanticLevelForZoom(zoom: number): MapLevel {
  return zoom >= CITY_ZOOM_THRESHOLD ? "city" : zoom >= PROVINCE_ZOOM_THRESHOLD ? "province" : "country";
}

export function resolveActiveCity(activeCity: string | undefined, _summaries: MapCitySummary[]): string {
  void _summaries;
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
