/* eslint-disable @next/next/no-html-link-for-pages -- the map fallback must remain a usable plain directory link. */
"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import type { PublicCommunity } from "../../features/communities/types";
import { communityCity, displayedCommunityCityCount, groupCommunitiesByCity, type CommunityCitySummary } from "../../features/map/community-map";
import { AmapLoader, type AmapLoadState, type AmapNamespace } from "./AmapLoader";
import { CommunityMapCanvas } from "./CommunityMapCanvas";

type CommunityApiPayload = { items?: PublicCommunity[]; citySummaries?: { city: string; communityCount: number }[] };

function locationLabel(community: PublicCommunity): string {
  if (community.locationMode === "online") return "纯线上";
  return communityCity(community) ?? "未标注城市";
}

export function CommunityMapDirectory({ cities, communities, activeCity, onSelectCity, directoryCityCount }: { cities: CommunityCitySummary[]; communities: PublicCommunity[]; activeCity?: string; onSelectCity: (city: string) => void; directoryCityCount?: number; }) {
  const active = cities.find((city) => city.city === activeCity) ?? cities[0];
  const mappedCities = new Set(cities.map((city) => city.city));
  const outsideMap = communities.filter((community) => { const city = communityCity(community); return !city || !mappedCities.has(city); });
  return <aside className="community-map-directory" aria-label="AI 社群城市与目录">
    <div className="community-map-directory-heading"><p className="map-section-kicker">城市聚合目录</p><h3>发现正在行动的 AI 社群</h3><p>{directoryCityCount ?? displayedCommunityCityCount(communities)} 座城市已有公开社群；纯线上与未定位城市仍可从目录浏览。</p></div>
    {cities.length ? <div className="community-city-buttons" aria-label="选择城市">{cities.map((city) => <button key={city.city} type="button" aria-pressed={city.city === active?.city} onClick={() => onSelectCity(city.city)}>{city.city} · {city.communityCount} 个社群</button>)}</div> : <p className="community-map-empty">暂时没有可绘制的城市聚合点。</p>}
    {active ? <section className="community-map-community-list" aria-labelledby="active-community-city"><h4 id="active-community-city">{active.city} · {active.communityCount} 个社群</h4><ul>{active.communities.map((community) => <li key={community.id}><a href={`/communities/${community.slug}`}><strong>{community.name}</strong><span>{community.summary}</span></a></li>)}</ul></section> : null}
    {outsideMap.length ? <section className="community-map-community-list community-map-unmapped" aria-labelledby="unmapped-community-title"><h4 id="unmapped-community-title">纯线上与未定位城市</h4><ul>{outsideMap.map((community) => <li key={community.id}><a href={`/communities/${community.slug}`}><strong>{community.name}</strong><span>{locationLabel(community)} · {community.summary}</span></a></li>)}</ul></section> : null}
    <a className="community-map-directory-link" href="/communities">进入 AI 社群完整目录 →</a>
  </aside>;
}

export function CommunityMapCanvasState({ state, amap, cities = [], activeCity, onSelectCity = () => undefined, onRetry = () => undefined }: { state: AmapLoadState; amap?: AmapNamespace; cities?: CommunityCitySummary[]; activeCity?: string; onSelectCity?: (city: string) => void; onRetry?: () => void; }) {
  if (state === "ready" && amap) return <CommunityMapCanvas amap={amap} cities={cities} activeCity={activeCity} onSelectCity={onSelectCity} onFailure={onRetry} />;
  if (state === "failed") return <div className="map-unavailable" role="status"><strong>社群地图暂时不可用</strong><p>城市与社群目录仍可正常浏览。</p><button type="button" onClick={onRetry}>重新加载社群地图</button></div>;
  return <div className="map-loading" role="status"><span aria-hidden="true" /><small>正在绘制社群城市地图…</small></div>;
}

export function CommunityMapSurface({ communities, loading, notice, activeCity, onSelectCity, mapContent }: { communities: PublicCommunity[]; loading: boolean; notice?: string; activeCity?: string; onSelectCity: (city: string) => void; mapContent: ReactNode; }) {
  const cities = groupCommunitiesByCity(communities);
  const selectedCity = activeCity && cities.some((city) => city.city === activeCity) ? activeCity : cities[0]?.city;
  return <section className="builder-map-section community-map-section" id="map" aria-labelledby="community-map-title">
    <div className="map-heading-row"><div><p className="map-section-kicker">AI 社群城市地图</p><h2 id="community-map-title">在城市里发现 AI 共创现场</h2></div><p>社群仅按主要活跃城市聚合；纯线上社群与未知城市不会被伪造成地图坐标。</p></div>
    {notice ? <p className="directory-notice" role="status">{notice}</p> : null}
    <div className="community-map-stage" aria-busy={loading}><div className="community-map-live">{mapContent}</div><CommunityMapDirectory cities={cities} communities={communities} activeCity={selectedCity} onSelectCity={onSelectCity} /></div>
  </section>;
}

export function CommunityMap({ AmapLoaderComponent = AmapLoader }: { AmapLoaderComponent?: typeof AmapLoader }) {
  const [communities, setCommunities] = useState<PublicCommunity[]>([]);
  const [activeCity, setActiveCity] = useState<string>();
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<string>();
  const cities = useMemo(() => groupCommunitiesByCity(communities), [communities]);
  useEffect(() => { const controller = new AbortController(); void fetch("/api/communities", { signal: controller.signal }).then(async (response) => { if (!response.ok) throw new Error("Community directory unavailable"); return response.json() as Promise<CommunityApiPayload>; }).then((payload) => { if (controller.signal.aborted) return; setCommunities(Array.isArray(payload.items) ? payload.items : []); setNotice(undefined); }).catch(() => { if (!controller.signal.aborted) setNotice("社群地图暂时无法读取"); }).finally(() => { if (!controller.signal.aborted) setLoading(false); }); return () => controller.abort(); }, []);
  const selectedCity = activeCity && cities.some((city) => city.city === activeCity) ? activeCity : cities[0]?.city;
  const selectCity = useCallback((city: string) => setActiveCity(city), []);
  return <AmapLoaderComponent>{(state, amap, retry) => <CommunityMapSurface communities={communities} loading={loading} notice={notice} activeCity={selectedCity} onSelectCity={selectCity} mapContent={<CommunityMapCanvasState state={state} amap={amap} cities={cities} activeCity={selectedCity} onSelectCity={selectCity} onRetry={retry} />} />}</AmapLoaderComponent>;
}
