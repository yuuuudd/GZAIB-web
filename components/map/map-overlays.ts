import type { DirectorySchool } from "../../features/directory/service";
import type { MapCitySummary } from "../../features/map/semantic-map";

export type MarkerPresentation = {
  position: [number, number];
  anchor: "bottom-center" | "center";
  title: string;
  content: string;
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
  return {
    position: [school.lng, school.lat],
    anchor: "bottom-center",
    title: `${school.name}，${school.memberCount} 位共建者`,
    content: `<div class="semantic-school-marker${selected ? " is-selected" : ""}"><span class="semantic-pin-count">${school.memberCount}位</span><span class="semantic-pin-tip" aria-hidden="true"></span><span class="semantic-pin-label">${name}</span></div>`,
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
