"use client";

import { useEffect, useRef } from "react";
import type { DirectorySchool } from "../../features/directory/service";
import {
  centerForCity,
  COUNTRY_CENTER,
  GUANGDONG_CENTER,
  semanticLevelForZoom,
  schoolsForCity,
  type MapCitySummary,
  type MapLevel,
} from "../../features/map/semantic-map";
import type { AmapDistrict, AmapMap, AmapNamespace, AmapOverlay } from "./AmapLoader";
import {
  campusHighlightPresentation,
  cityBasemapPresentation,
  cityMarkerPresentation,
  collaborationRoutePresentations,
  districtPolygonPresentation,
  provinceMarkerPresentation,
  schoolMarkerPresentation,
} from "./map-overlays";

const districtCache = new Map<string, Promise<AmapDistrict | undefined>>();

function loadDistrict(amap: AmapNamespace, area: string, level: "city" | "province" = "city"): Promise<AmapDistrict | undefined> {
  const key = `${level}:${area}`;
  const cached = districtCache.get(key);
  if (cached) return cached;
  const request = new Promise<AmapDistrict | undefined>((resolve) => {
    const search = new amap.DistrictSearch({ level, subdistrict: 0, extensions: "all" });
    search.search(`${area}${level === "province" ? "省" : "市"}`, (status, result) => {
      resolve(status === "complete" && typeof result !== "string" ? result.districtList?.[0] : undefined);
    });
  }).catch((error) => {
    districtCache.delete(key);
    throw error;
  });
  districtCache.set(key, request);
  return request;
}

function polygonsForDistrict(amap: AmapNamespace, district: AmapDistrict | undefined, active: boolean, provinceLevel: boolean): AmapOverlay[] {
  if (!district?.boundaries?.length) return [];
  return district.boundaries.map((path) => new amap.Polygon({
    path,
    ...districtPolygonPresentation(active, provinceLevel),
  }));
}

export function SemanticMapCanvas({ amap, cities, level, activeCity, selectedId, onLevelChange, onSelectCity, onSelectSchool, onFailure }: {
  amap: AmapNamespace;
  cities: MapCitySummary[];
  level: MapLevel;
  activeCity: string;
  selectedId?: string;
  onLevelChange: (level: MapLevel) => void;
  onSelectCity: (city: string) => void;
  onSelectSchool: (school: DirectorySchool) => void;
  onFailure: () => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<AmapMap | undefined>(undefined);
  const overlaysRef = useRef<AmapOverlay[]>([]);
  const generationRef = useRef(0);
  const viewRef = useRef("");

  useEffect(() => {
    if (!containerRef.current) return;
    try {
      const map = new amap.Map(containerRef.current, {
        zoom: 10.5,
        center: [113.2644, 23.1291],
        ...cityBasemapPresentation(),
        viewMode: "2D",
        pitch: 0,
        animateEnable: true,
      });
      mapRef.current = map;
      const handleZoom = () => onLevelChange(semanticLevelForZoom(map.getZoom()));
      map.on("zoomend", handleZoom);
      return () => {
        generationRef.current += 1;
        map.off("zoomend", handleZoom);
        map.destroy();
        mapRef.current = undefined;
      };
    } catch {
      onFailure();
    }
  }, [amap, onFailure, onLevelChange]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const viewKey = `${level}:${activeCity}`;
    if (viewRef.current === viewKey) return;
    viewRef.current = viewKey;
    if (level === "country") {
      map.setZoomAndCenter(4.3, [COUNTRY_CENTER.lng, COUNTRY_CENTER.lat]);
    } else if (level === "province") {
      map.setZoomAndCenter(7.35, [GUANGDONG_CENTER.lng, GUANGDONG_CENTER.lat]);
    } else {
      const center = centerForCity(cities, activeCity);
      map.setZoomAndCenter(10.5, [center.lng, center.lat]);
    }
  }, [activeCity, cities, level]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const generation = ++generationRef.current;
    if (overlaysRef.current.length) map.remove(overlaysRef.current);
    overlaysRef.current = [];

    const render = async () => {
      const immediate: AmapOverlay[] = [];
      if (level === "country" && cities.length) {
        // ponytail: the public directory is Guangdong-only until school records gain a province field.
        const marker = new amap.Marker(provinceMarkerPresentation({
          memberCount: cities.reduce((sum, city) => sum + city.memberCount, 0),
          schoolCount: cities.reduce((sum, city) => sum + city.schoolCount, 0),
          cityCount: cities.length,
        }));
        marker.on("click", () => onLevelChange("province"));
        immediate.push(marker);
      } else if (level === "province") {
        for (const city of cities) {
          const presentation = cityMarkerPresentation(city, city.city === activeCity);
          const marker = new amap.Marker(presentation);
          marker.on("click", () => onSelectCity(city.city));
          immediate.push(marker);
        }
      } else {
        for (const school of schoolsForCity(cities, activeCity)) {
          immediate.push(new amap.Circle(campusHighlightPresentation(school, school.id === selectedId)));
          const presentation = schoolMarkerPresentation(school, school.id === selectedId);
          const marker = new amap.Marker(presentation);
          marker.on("click", () => onSelectSchool(school));
          immediate.push(marker);
        }
      }
      const routes = level === "country" ? [] : collaborationRoutePresentations(level, cities, activeCity)
        .map((presentation) => new amap.Polyline(presentation));
      immediate.unshift(...routes);
      if (generation !== generationRef.current) return;
      overlaysRef.current = immediate;
      if (immediate.length) map.add(immediate);

      if (level === "country" && cities.length) {
        const outlines = polygonsForDistrict(amap, await loadDistrict(amap, "广东", "province"), true, true);
        if (generation !== generationRef.current || !outlines.length) return;
        overlaysRef.current.push(...outlines);
        map.add(outlines);
      } else if (level === "province") {
        await Promise.all(cities.map(async ({ city }) => {
          const outlines = polygonsForDistrict(amap, await loadDistrict(amap, city), true, true);
          if (generation !== generationRef.current || !outlines.length) return;
          overlaysRef.current.push(...outlines);
          map.add(outlines);
        }));
      } else {
        const outlines = polygonsForDistrict(amap, await loadDistrict(amap, activeCity), true, false);
        if (generation !== generationRef.current || !outlines.length) return;
        overlaysRef.current.push(...outlines);
        map.add(outlines);
      }
    };

    void render().catch(() => {
      if (generation === generationRef.current) overlaysRef.current = [];
    });
    return () => { generationRef.current += 1; };
  }, [activeCity, amap, cities, level, onLevelChange, onSelectCity, onSelectSchool, selectedId]);

  return <div className="semantic-map-shell">
    <div ref={containerRef} className="amap-canvas" aria-label={level === "country" ? "全国省份共建概览" : level === "province" ? "广东城市共建概览" : `${activeCity}高校共建地图`} />
    <div className="map-live-label">
      <span>{level === "country" ? "CN" : level === "province" ? "GD" : activeCity.slice(0, 1)}</span>
      <strong>{level === "country" ? "全国" : level === "province" ? "广东" : activeCity}</strong>
      <small>{level === "country" ? "点击省份进入城市网络" : level === "province" ? "缩放或点击城市进入学校网络" : "图钉内为成员数，点击查看学校"}</small>
    </div>
  </div>;
}
