"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

export type AmapLoadState = "idle" | "loading" | "ready" | "failed";

export type AmapNamespace = {
  Map: new (container: HTMLElement, options: Record<string, unknown>) => AmapMap;
  Marker: new (options: Record<string, unknown>) => AmapMarker;
  MarkerCluster: new (map: AmapMap, markers: AmapMarker[], options?: Record<string, unknown>) => { setMap(map: null): void };
  PlaceSearch: new (options: Record<string, unknown>) => { search(keyword: string, callback: (status: string, result: unknown) => void): void };
  DistrictSearch: new (options: Record<string, unknown>) => AmapDistrictSearch;
  Circle: new (options: Record<string, unknown>) => AmapCircle;
  Polygon: new (options: Record<string, unknown>) => AmapPolygon;
  Polyline: new (options: Record<string, unknown>) => AmapPolyline;
};
export type AmapOverlay = AmapMarker | AmapCircle | AmapPolygon | AmapPolyline;
export type AmapMap = {
  destroy(): void;
  add(overlays: AmapOverlay[]): void;
  remove(overlays: AmapOverlay[]): void;
  setFitView(overlays?: AmapOverlay[], immediately?: boolean, avoid?: number[], maxZoom?: number): void;
  getZoom(): number;
  setZoomAndCenter(zoom: number, center: [number, number], immediately?: boolean): void;
  on(event: "zoomend", handler: () => void): void;
  off(event: "zoomend", handler: () => void): void;
};
export type AmapMarker = {
  on(event: "click", handler: () => void): void;
  setMap(map: AmapMap | null): void;
};
export type AmapPolygon = { setMap(map: AmapMap | null): void };
export type AmapCircle = { setMap(map: AmapMap | null): void };
export type AmapPolyline = { setMap(map: AmapMap | null): void };
export type AmapDistrict = {
  name?: string;
  adcode?: string;
  center?: { lng: number; lat: number };
  boundaries?: unknown[][];
  districtList?: AmapDistrict[];
};
export type AmapDistrictSearch = {
  search(keyword: string, callback: (status: string, result: { districtList?: AmapDistrict[] } | string) => void): void;
};
export type AmapLocation = {
  name: string;
  city: string;
  district: string;
  address: string;
  longitude: number;
  latitude: number;
};

export const GUANGDONG_PLACE_SEARCH_OPTIONS = { city: "440000", citylimit: true } as const;

export function parseAmapLocation(value: unknown): AmapLocation | null {
  if (!value || typeof value !== "object") return null;
  const item = value as { name?: unknown; cityname?: unknown; adname?: unknown; address?: unknown; location?: unknown };
  if (typeof item.name !== "string" || typeof item.cityname !== "string" || !item.cityname.trim() || !item.location || typeof item.location !== "object") return null;
  const location = item.location as { lng?: unknown; lat?: unknown; getLng?: () => unknown; getLat?: () => unknown };
  const longitude = Number(typeof location.getLng === "function" ? location.getLng() : location.lng);
  const latitude = Number(typeof location.getLat === "function" ? location.getLat() : location.lat);
  if (!Number.isFinite(longitude) || !Number.isFinite(latitude)) return null;
  return { name: item.name, city: item.cityname.trim(), district: typeof item.adname === "string" ? item.adname : "", address: typeof item.address === "string" ? item.address : "", longitude: Math.round(longitude * 1_000_000), latitude: Math.round(latitude * 1_000_000) };
}

declare global {
  interface Window {
    AMap?: AmapNamespace;
    _AMapSecurityConfig?: { serviceHost: string };
    __builderMapAmapPromise?: Promise<AmapNamespace>;
  }
}

function loadAmap(key: string): Promise<AmapNamespace> {
  if (window.AMap) return Promise.resolve(window.AMap);
  if (window.__builderMapAmapPromise) return window.__builderMapAmapPromise;
  window._AMapSecurityConfig = { serviceHost: "/api/amap/_AMapService" };
  window.__builderMapAmapPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>('script[data-builder-map="amap"]');
    const script = existing ?? document.createElement("script");
    const timeout = window.setTimeout(() => reject(new Error("AMap load timed out")), 12_000);
    const ready = () => {
      window.clearTimeout(timeout);
      if (window.AMap) resolve(window.AMap);
      else reject(new Error("AMap namespace unavailable"));
    };
    const failed = () => {
      window.clearTimeout(timeout);
      reject(new Error("AMap failed to load"));
    };
    script.addEventListener("load", ready, { once: true });
    script.addEventListener("error", failed, { once: true });
    if (!existing) {
      script.src = buildAmapScriptUrl(key);
      script.async = true;
      script.dataset.builderMap = "amap";
      document.head.append(script);
    }
  });
  return window.__builderMapAmapPromise;
}

export function buildAmapScriptUrl(key: string): string {
  const url = new URL("https://webapi.amap.com/maps");
  url.searchParams.set("v", "2.0");
  url.searchParams.set("key", key);
  url.searchParams.set("plugin", "AMap.MarkerCluster,AMap.PlaceSearch,AMap.DistrictSearch");
  return url.toString();
}

export async function resolveAmapKey(apiKey?: string, fetchImpl: typeof fetch = fetch): Promise<string> {
  if (apiKey?.trim()) return apiKey.trim();
  const response = await fetchImpl("/api/amap/config", { cache: "no-store" });
  if (!response.ok) throw new Error("AMap is not configured");
  const payload = await response.json() as { key?: unknown };
  if (typeof payload.key !== "string" || !payload.key.trim()) throw new Error("AMap key unavailable");
  return payload.key.trim();
}

function resetAmapLoad() {
  document.querySelector<HTMLScriptElement>('script[data-builder-map="amap"]')?.remove();
  delete window.__builderMapAmapPromise;
}

export function AmapLoader({ apiKey, children }: { apiKey?: string; children: (state: AmapLoadState, amap?: AmapNamespace, retry?: () => void) => ReactNode }) {
  const [state, setState] = useState<AmapLoadState>("idle");
  const [amap, setAmap] = useState<AmapNamespace>();
  const [attempt, setAttempt] = useState(0);

  const retry = () => {
    resetAmapLoad();
    setAmap(undefined);
    setAttempt((value) => value + 1);
  };

  useEffect(() => {
    let active = true;
    queueMicrotask(() => active && setState("loading"));
    resolveAmapKey(apiKey).then(loadAmap).then((loaded) => {
      if (!active) return;
      setAmap(loaded);
      setState("ready");
    }).catch(() => {
      if (!active) return;
      if (attempt === 0) {
        resetAmapLoad();
        setAttempt(1);
        return;
      }
      setState("failed");
    });
    return () => { active = false; };
  }, [apiKey, attempt]);

  return children(state, amap, retry);
}

export function AmapLocationPreview({ amap, location, onConfirm, onBack, pending = false, confirmLabel = "确认使用这个学校" }: {
  amap: AmapNamespace;
  location: AmapLocation;
  onConfirm: () => void;
  onBack: () => void;
  pending?: boolean;
  confirmLabel?: string;
}) {
  const mapContainer = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!mapContainer.current) return;
    const center = [location.longitude / 1_000_000, location.latitude / 1_000_000];
    const map = new amap.Map(mapContainer.current, { center, zoom: 16, viewMode: "2D", showLabel: true });
    const marker = new amap.Marker({ position: center, title: location.name });
    map.add([marker]);
    return () => map.destroy();
  }, [amap, location.latitude, location.longitude, location.name]);

  const area = [location.city, location.district].filter(Boolean).join(" · ");
  return <article className="school-place-preview">
    <div ref={mapContainer} className="school-place-preview-map" aria-label={`${location.name}周边地图`} />
    <div className="school-place-preview-copy">
      <p className="admin-kicker">地点预览</p>
      <h3>{location.name}</h3>
      {area ? <p>{area}</p> : null}
      {location.address ? <p>{location.address}</p> : null}
      <small>{(location.longitude / 1_000_000).toFixed(6)}, {(location.latitude / 1_000_000).toFixed(6)}</small>
    </div>
    <div className="school-place-preview-actions">
      <button type="button" className="action-secondary" disabled={pending} onClick={onBack}>返回搜索结果</button>
      <button type="button" className="action-primary" disabled={pending} onClick={onConfirm}>{pending ? "正在保存…" : confirmLabel}</button>
    </div>
  </article>;
}
