import type { DirectorySchool } from "../../features/directory/service";
import type { MapCitySummary, MapLevel, MapPoint, MapProvinceSummary } from "../../features/map/semantic-map";

export type MarkerPresentation = {
  position: [number, number];
  anchor: "bottom-center" | "center";
  title: string;
  content: string;
};

export type RoutePresentation = {
  path: [[number, number], [number, number]];
  strokeColor: string;
  strokeWeight: number;
  strokeOpacity: number;
  strokeStyle: "dashed";
  lineJoin: "round";
  lineCap: "round";
  zIndex: number;
};

export type CityBasemapPresentation = {
  mapStyle: "amap://styles/normal";
  showLabel: true;
  features: ["bg", "road", "building", "point"];
};

export type DistrictPolygonPresentation = {
  strokeColor: string;
  strokeWeight: number;
  strokeOpacity: number;
  fillColor: string;
  fillOpacity: number;
  bubble: true;
  zIndex: number;
};

export type CampusHighlightPresentation = {
  center: [number, number];
  radius: 420;
  strokeColor: string;
  strokeWeight: 3;
  strokeOpacity: 0.9;
  fillColor: string;
  fillOpacity: number;
  zIndex: 10;
};

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function cityBasemapPresentation(): CityBasemapPresentation {
  return {
    mapStyle: "amap://styles/normal",
    showLabel: true,
    features: ["bg", "road", "building", "point"],
  };
}

export function districtPolygonPresentation(active: boolean, provinceLevel: boolean): DistrictPolygonPresentation {
  return {
    strokeColor: provinceLevel ? active ? "#f3a34f" : "#96bd7e" : "#46a3a5",
    strokeWeight: provinceLevel ? active ? 3.2 : 1.7 : 2.2,
    strokeOpacity: provinceLevel ? active ? 0.95 : 0.78 : 0.82,
    fillColor: provinceLevel ? active ? "#f8d785" : "#dceebd" : "#8fd3c8",
    fillOpacity: provinceLevel ? active ? 0.72 : 0.48 : 0.08,
    bubble: true,
    zIndex: active ? 12 : 8,
  };
}

export function campusHighlightPresentation(school: DirectorySchool, selected: boolean): CampusHighlightPresentation {
  // ponytail: fixed campus halo; replace with stored campus polygons when exact boundaries are available.
  return {
    center: [school.lng, school.lat],
    radius: 420,
    strokeColor: selected ? "#f07832" : "#2465e8",
    strokeWeight: 3,
    strokeOpacity: 0.9,
    fillColor: selected ? "#ffb36f" : "#72a7ff",
    fillOpacity: selected ? 0.24 : 0.16,
    zIndex: 10,
  };
}

export function schoolMarkerPresentation(school: DirectorySchool, selected: boolean): MarkerPresentation {
  const name = escapeHtml(school.name);
  const pinAsset = selected ? "/map-art/school-pin-orange-v1.png" : "/map-art/school-pin-blue-v1.png";
  return {
    position: [school.lng, school.lat],
    anchor: "bottom-center",
    title: `${school.name}，${school.memberCount} 位共建者`,
    content: `<div class="semantic-school-marker${selected ? " is-selected" : ""}"><span class="semantic-pin-visual"><img class="semantic-pin-art" src="${pinAsset}" alt="" /><span class="semantic-pin-count">${school.memberCount}位</span></span><span class="semantic-pin-label">${name}</span></div>`,
  };
}

export function cityMarkerPresentation(city: MapCitySummary, active: boolean): MarkerPresentation {
  const name = escapeHtml(city.city);
  const pinAsset = active ? "/map-art/school-pin-orange-v1.png" : "/map-art/school-pin-blue-v1.png";
  return {
    position: [city.center.lng, city.center.lat],
    anchor: "bottom-center",
    title: `${city.city}，${city.memberCount} 位共建者，${city.schoolCount} 所学校`,
    content: `<div class="semantic-school-marker semantic-city-pin${active ? " is-selected" : ""}"><span class="semantic-pin-visual"><img class="semantic-pin-art" src="${pinAsset}" alt="" /><span class="semantic-pin-count">${city.memberCount}位</span></span><span class="semantic-pin-label">${name} · ${city.schoolCount}所</span></div>`,
  };
}

export function provinceMarkerPresentation(summary: MapProvinceSummary): MarkerPresentation {
  const name = escapeHtml(summary.province);
  return {
    position: [summary.center.lng, summary.center.lat],
    anchor: "bottom-center",
    title: `${summary.province}，${summary.memberCount} 位共建者，${summary.schoolCount} 所学校，${summary.cityCount} 座城市`,
    content: `<div class="semantic-school-marker semantic-city-pin is-selected"><span class="semantic-pin-visual"><img class="semantic-pin-art" src="/map-art/school-pin-orange-v1.png" alt="" /><span class="semantic-pin-count">${summary.memberCount}位</span></span><span class="semantic-pin-label">${name} · ${summary.cityCount}城</span></div>`,
  };
}

export function collaborationRoutePresentations(level: MapLevel, cities: MapCitySummary[], activeCity: string, provinceCenter?: MapPoint): RoutePresentation[] {
  const start = level === "province"
    ? provinceCenter
    : cities.find((city) => city.city === activeCity)?.center;
  if (!start) return [];
  const destinations = level === "province"
    ? cities.map((city) => city.center)
    : cities.find((city) => city.city === activeCity)?.schools.map((school) => ({ lng: school.lng, lat: school.lat })) ?? [];
  return destinations.map((destination) => ({
    path: [[start.lng, start.lat], [destination.lng, destination.lat]],
    strokeColor: "#fff3a6",
    strokeWeight: 3,
    strokeOpacity: 0.92,
    strokeStyle: "dashed",
    lineJoin: "round",
    lineCap: "round",
    zIndex: 14,
  }));
}
