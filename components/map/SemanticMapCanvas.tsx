"use client";

import { useEffect, useRef } from "react";
import type { DirectorySchool } from "../../features/directory/service";
import {
  centerForCity,
  GUANGDONG_CENTER,
  semanticLevelForZoom,
  schoolsForCity,
  type MapCitySummary,
  type MapLevel,
} from "../../features/map/semantic-map";
import type { AmapDistrict, AmapMap, AmapNamespace, AmapOverlay } from "./AmapLoader";
import { cityMarkerPresentation, schoolMarkerPresentation } from "./map-overlays";

const GUANGDONG_CITIES = [
  "广州", "深圳", "珠海", "汕头", "佛山", "韶关", "湛江", "肇庆", "江门", "茂名", "惠州",
  "梅州", "汕尾", "河源", "阳江", "清远", "东莞", "中山", "潮州", "揭阳", "云浮",
] as const;

const districtCache = new Map<string, Promise<AmapDistrict | undefined>>();

function loadDistrict(amap: AmapNamespace, city: string): Promise<AmapDistrict | undefined> {
  const key = `city:${city}`;
  const cached = districtCache.get(key);
  if (cached) return cached;
  const request = new Promise<AmapDistrict | undefined>((resolve) => {
    const search = new amap.DistrictSearch({ level: "city", subdistrict: 0, extensions: "all" });
    search.search(`${city}市`, (status, result) => {
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
    strokeColor: active ? "#1e4ed8" : "#7691b9",
    strokeWeight: active ? 2.2 : 1.15,
    strokeOpacity: active ? 0.82 : 0.58,
    fillColor: active && provinceLevel ? "#a9c0ff" : "#dce7f7",
    fillOpacity: active && provinceLevel ? 0.12 : 0.025,
    bubble: true,
    zIndex: active ? 12 : 8,
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
  const mapRef = useRef<AmapMap>();
  const overlaysRef = useRef<AmapOverlay[]>([]);
  const generationRef = useRef(0);
  const viewRef = useRef("");

  useEffect(() => {
    if (!containerRef.current) return;
    try {
      const map = new amap.Map(containerRef.current, {
        zoom: 10.5,
        center: [113.2644, 23.1291],
        mapStyle: "amap://styles/whitesmoke",
        viewMode: "2D",
        showLabel: false,
        features: ["bg"],
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
    if (level === "province") {
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
      const next: AmapOverlay[] = [];
      if (level === "province") {
        const districts = await Promise.all(GUANGDONG_CITIES.map(async (city) => ({ city, district: await loadDistrict(amap, city) })));
        if (generation !== generationRef.current) return;
        for (const { city, district } of districts) {
          next.push(...polygonsForDistrict(amap, district, city === activeCity, true));
        }
        for (const city of cities) {
          const presentation = cityMarkerPresentation(city, city.city === activeCity);
          const marker = new amap.Marker(presentation);
          marker.on("click", () => onSelectCity(city.city));
          next.push(marker);
        }
      } else {
        const district = await loadDistrict(amap, activeCity);
        if (generation !== generationRef.current) return;
        next.push(...polygonsForDistrict(amap, district, true, false));
        for (const school of schoolsForCity(cities, activeCity)) {
          const presentation = schoolMarkerPresentation(school, school.id === selectedId);
          const marker = new amap.Marker(presentation);
          marker.on("click", () => onSelectSchool(school));
          next.push(marker);
        }
      }
      if (generation !== generationRef.current) return;
      overlaysRef.current = next;
      if (next.length) map.add(next);
    };

    void render().catch(() => {
      if (generation === generationRef.current) overlaysRef.current = [];
    });
    return () => { generationRef.current += 1; };
  }, [activeCity, amap, cities, level, onSelectCity, onSelectSchool, selectedId]);

  return <div className="semantic-map-shell">
    <div ref={containerRef} className="amap-canvas" aria-label={`${level === "province" ? "广东城市共建概览" : `${activeCity}高校共建地图`}`} />
    <div className="map-live-label">
      <span>{level === "province" ? "GD" : activeCity.slice(0, 1)}</span>
      <strong>{level === "province" ? "广东" : activeCity}</strong>
      <small>{level === "province" ? "缩放或点击城市进入学校网络" : "图钉内为成员数，点击查看学校"}</small>
    </div>
  </div>;
}
