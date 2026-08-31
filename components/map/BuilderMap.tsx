"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { DirectoryQuery, DirectorySchool } from "../../features/directory/service";
import {
  DEFAULT_CITY,
  groupSchoolsByCity,
  normalizeCity,
  schoolsForCity,
  type MapLevel,
} from "../../features/map/semantic-map";
import { DirectoryFilters } from "../directory/DirectoryFilters";
import { SchoolDrawer } from "../directory/SchoolDrawer";
import { AmapLoader } from "./AmapLoader";
import { CampusMapFallback } from "./CampusExplorerScene";
import { CityDirectoryFallback } from "./CityDirectoryFallback";
import { SemanticMapCanvas } from "./SemanticMapCanvas";

function recordMapView() {
  void fetch("/api/metrics", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ eventType: "map_view", dimensionKey: "all" }),
    keepalive: true,
  });
}

function directoryUrl(query: DirectoryQuery): string {
  const params = new URLSearchParams();
  if (query.q) params.set("q", query.q);
  if (query.skills?.length) params.set("skills", query.skills.join(","));
  if (query.roles?.length) params.set("roles", query.roles.join(","));
  if (query.city) params.set("city", query.city);
  if (query.schoolId) params.set("schoolId", query.schoolId);
  if (query.verified !== undefined) params.set("verified", String(query.verified));
  return `/api/directory?${params}`;
}

export function BuilderMap({ amapKey }: { amapKey?: string }) {
  const [query, setQuery] = useState<DirectoryQuery>({});
  const [schools, setSchools] = useState<DirectorySchool[]>([]);
  const [level, setLevel] = useState<MapLevel>("city");
  const [activeCity, setActiveCity] = useState(DEFAULT_CITY);
  const [selectedId, setSelectedId] = useState<string>();
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<string>();
  const [canvasFailed, setCanvasFailed] = useState(false);

  useEffect(() => { recordMapView(); }, []);
  useEffect(() => {
    const controller = new AbortController();
    const timeout = window.setTimeout(async () => {
      setLoading(true);
      try {
        const response = await fetch(directoryUrl(query), { signal: controller.signal });
        if (!response.ok) throw new Error("Directory unavailable");
        const payload = await response.json() as { schools?: DirectorySchool[] };
        setSchools(Array.isArray(payload.schools) ? payload.schools : []);
        setNotice(undefined);
      } catch {
        if (!controller.signal.aborted) {
          setSchools([]);
          setNotice("公开目录正在整理中，地图仍可浏览；也可以先提交资料点亮学校。");
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, query.q ? 220 : 0);
    return () => { window.clearTimeout(timeout); controller.abort(); };
  }, [query]);

  const cities = useMemo(() => groupSchoolsByCity(schools), [schools]);
  const selected = useMemo(() => schools.find((school) => school.id === selectedId), [schools, selectedId]);
  const activeSchools = useMemo(() => schoolsForCity(cities, activeCity), [activeCity, cities]);
  const memberCount = schools.reduce((total, school) => total + school.memberCount, 0);

  const changeLevel = useCallback((next: MapLevel) => {
    setLevel(next);
    if (next === "province") setSelectedId(undefined);
  }, []);
  const selectCity = useCallback((city: string) => {
    setActiveCity(normalizeCity(city));
    setSelectedId(undefined);
    setLevel("city");
  }, []);
  const selectSchool = useCallback((school: DirectorySchool) => {
    setActiveCity(normalizeCity(school.city));
    setLevel("city");
    setSelectedId(school.id);
  }, []);

  return (
    <section className="builder-map-section" id="map" aria-labelledby="map-title">
      <div className="map-heading-row">
        <div><p className="map-section-kicker">广东高校共建者地图</p><h2 id="map-title">探索高校能量，发现同频伙伴</h2></div>
        <p>像逛校园一样探索广东高校圈。每一枚图钉，都是正在发生的共建故事。</p>
      </div>
      <div className="map-explorer-controls">
        <DirectoryFilters query={query} onChange={setQuery} />
        <nav className="semantic-level-switcher" aria-label="共建地图层级">
          <button type="button" aria-pressed={level === "province"} onClick={() => changeLevel("province")}><span aria-hidden="true">⌘</span> 广东城市概览</button>
          <button type="button" aria-pressed={level === "city"} onClick={() => selectCity(activeCity)}><span aria-hidden="true">✦</span> {activeCity}学校网络</button>
          <small>{level === "province" ? "点击城市继续探索" : `${activeSchools.length} 所学校正在发光`}</small>
        </nav>
      </div>
      {notice ? <p className="directory-notice" role="status">{notice}</p> : null}
      <div className={`map-stage ${selected ? "map-stage-drawer-open" : ""}`} aria-busy={loading}>
        <AmapLoader apiKey={amapKey}>
          {(state, amap, retry) => state === "ready" && amap && !canvasFailed ? (
            <div className="map-live-layout">
              <div className="map-live">
                <SemanticMapCanvas
                  amap={amap}
                  cities={cities}
                  level={level}
                  activeCity={activeCity}
                  selectedId={selectedId}
                  onLevelChange={changeLevel}
                  onSelectCity={selectCity}
                  onSelectSchool={selectSchool}
                  onFailure={() => setCanvasFailed(true)}
                />
                {level === "city" && !activeSchools.length && !loading ? <p className="map-empty-note">当前筛选下暂无学校，城市地图仍然可以浏览</p> : null}
              </div>
              <CityDirectoryFallback
                cities={cities}
                activeCity={activeCity}
                level={level}
                selectedId={selectedId}
                onSelectCity={selectCity}
                onBackToProvince={() => changeLevel("province")}
                onSelectSchool={selectSchool}
              />
            </div>
          ) : state === "idle" || state === "loading" ? (
            <div className="map-loading" role="status"><span /><strong>正在连接学校地图</strong><small>默认打开广州学校网络</small></div>
          ) : (
            <div className="map-retry-state campus-map-retry">
              <CampusMapFallback
                cities={cities}
                level={level}
                activeCity={activeCity}
                onRetry={() => { setCanvasFailed(false); retry?.(); }}
              />
              <CityDirectoryFallback
                cities={cities}
                activeCity={activeCity}
                level={level}
                selectedId={selectedId}
                onSelectCity={selectCity}
                onBackToProvince={() => changeLevel("province")}
                onSelectSchool={selectSchool}
              />
            </div>
          )}
        </AmapLoader>
        <SchoolDrawer key={`${selected?.id ?? "none"}:${JSON.stringify(query)}`} school={selected} query={query} onClose={() => setSelectedId(undefined)} />
      </div>
      <div className="map-stats" aria-label="目录统计">
        <div><span aria-hidden="true">校</span><strong>{schools.length}</strong><p>所学校</p></div>
        <div><span aria-hidden="true">人</span><strong>{memberCount}</strong><p>位共建者</p></div>
        <div><span aria-hidden="true">城</span><strong>{cities.length}</strong><p>座城市</p></div>
        <p className="map-stats-note">统计随当前公开筛选实时变化；学校位置来自高德地点坐标与运营确认。</p>
      </div>
    </section>
  );
}
