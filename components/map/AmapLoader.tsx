"use client";

import { useEffect, useState, type ReactNode } from "react";

export type AmapLoadState = "idle" | "loading" | "ready" | "failed";

export type AmapNamespace = {
  Map: new (container: HTMLElement, options: Record<string, unknown>) => AmapMap;
  Marker: new (options: Record<string, unknown>) => AmapMarker;
  MarkerCluster: new (map: AmapMap, markers: AmapMarker[], options?: Record<string, unknown>) => { setMap(map: null): void };
  PlaceSearch: new (options: Record<string, unknown>) => { search(keyword: string, callback: (status: string, result: unknown) => void): void };
};
export type AmapMap = { destroy(): void; add(markers: AmapMarker[]): void; setFitView(markers?: AmapMarker[]): void };
export type AmapMarker = { on(event: "click", handler: () => void): void };

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
      script.src = `https://webapi.amap.com/maps?v=2.0&key=${encodeURIComponent(key)}&plugin=AMap.MarkerCluster,AMap.PlaceSearch`;
      script.async = true;
      script.dataset.builderMap = "amap";
      document.head.append(script);
    }
  });
  return window.__builderMapAmapPromise;
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
