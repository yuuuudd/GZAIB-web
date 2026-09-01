"use client";

import { lazy, Suspense, useState, type ComponentType, type ReactNode } from "react";

const BuilderMap = lazy(async () => ({ default: (await import("./BuilderMap")).BuilderMap }));
const CommunityMap = lazy(async () => ({ default: (await import("./CommunityMap")).CommunityMap }));

export type EcosystemMapView = "builders" | "communities";

export function EcosystemMapTabs({ view, onSelect }: { view: EcosystemMapView; onSelect: (view: EcosystemMapView) => void }) {
  return <nav className="ecosystem-map-tabs" aria-label="切换生态地图"><button type="button" aria-pressed={view === "builders"} onClick={() => onSelect("builders")}>高校共建者</button><button type="button" aria-pressed={view === "communities"} onClick={() => onSelect("communities")}>AI 社群</button></nav>;
}

export function EcosystemMapContent({ view, builders, communities }: { view: EcosystemMapView; builders: ReactNode; communities: ReactNode }) {
  return view === "builders" ? builders : communities;
}

export function EcosystemMapSwitcher({ initialView = "builders", BuilderMapComponent, CommunityMapComponent }: { initialView?: EcosystemMapView; BuilderMapComponent?: ComponentType; CommunityMapComponent?: ComponentType }) {
  const [view, setView] = useState(initialView);
  const builders = BuilderMapComponent ? <BuilderMapComponent /> : <BuilderMap />;
  const communities = CommunityMapComponent ? <CommunityMapComponent /> : <CommunityMap />;
  return <section className="ecosystem-map-switcher" aria-label="生态地图视图"><EcosystemMapTabs view={view} onSelect={setView} /><Suspense fallback={<div className="map-loading" role="status"><span aria-hidden="true" /><small>正在打开生态地图…</small></div>}><EcosystemMapContent view={view} builders={builders} communities={communities} /></Suspense></section>;
}
