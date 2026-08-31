import type { DirectorySchool } from "../../features/directory/service";
import { GUANGDONG_CENTER, type MapCitySummary, type MapLevel } from "../../features/map/semantic-map";

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

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
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
  return {
    position: [city.center.lng, city.center.lat],
    anchor: "center",
    title: `${city.city}，${city.memberCount} 位共建者，${city.schoolCount} 所学校`,
    content: `<div class="semantic-city-marker${active ? " is-active" : ""}"><strong>${name}</strong><span>${city.memberCount} 位共建者 · ${city.schoolCount} 所学校</span></div>`,
  };
}

export function collaborationRoutePresentations(level: MapLevel, cities: MapCitySummary[], activeCity: string): RoutePresentation[] {
  const start = level === "province"
    ? GUANGDONG_CENTER
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
