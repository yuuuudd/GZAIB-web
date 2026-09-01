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
import { SchoolDrawer } from "../directory/SchoolDrawer";
import { AmapLoader } from "./AmapLoader";
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

const EMPTY_DIRECTORY_QUERY: DirectoryQuery = {};

export function BuilderMap() {
  const query = EMPTY_DIRECTORY_QUERY;
  const [schools, setSchools] = useState<DirectorySchool[]>([]);
  const [level, setLevel] = useState<MapLevel>("city");
  const [activeCity, setActiveCity] = useState(DEFAULT_CITY);
  const [selectedId, setSelectedId] = useState<string>();
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<string>();

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
    }, 0);
    return () => { window.clearTimeout(timeout); controller.abort(); };
  }, [query]);

  const cities = useMemo(() => groupSchoolsByCity(schools), [schools]);
  const selected = useMemo(() => schools.find((school) => school.id === selectedId), [schools, selectedId]);
  const activeSchools = useMemo(() => schoolsForCity(cities, activeCity), [activeCity, cities]);
  const memberCount = schools.reduce((total, school) => total + school.memberCount, 0);

  const changeLevel = useCallback((next: MapLevel) => {
    setLevel(next);
    if (next !== "city") setSelectedId(undefined);
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
      <div className="map-overview-row">
        <nav className="semantic-level-switcher" aria-label="共建地图层级">
          <button type="button" aria-pressed={level === "city" && activeCity === DEFAULT_CITY} onClick={() => selectCity(DEFAULT_CITY)}>广州</button>
          <button type="button" aria-pressed={level === "province"} onClick={() => changeLevel("province")}>广东</button>
          <button type="button" aria-pressed={level === "country"} onClick={() => changeLevel("country")}>全国</button>
        </nav>
        <div className="map-stats" aria-label="目录统计">
          <div><span aria-hidden="true">校</span><strong>{schools.length}</strong><p>所学校</p></div>
          <div><span aria-hidden="true">人</span><strong>{memberCount}</strong><p>位共建者</p></div>
          <div><span aria-hidden="true">城</span><strong>{cities.length}</strong><p>座城市</p></div>
        </div>
      </div>
      {notice ? <p className="directory-notice" role="status">{notice}</p> : null}
      <div className={`map-stage ${selected ? "map-stage-drawer-open" : ""}`} aria-busy={loading}>
        <div className="map-live-layout">
          <div className="map-live">
            <AmapLoader>{(state, amap, retry) => state === "ready" && amap
                ? <SemanticMapCanvas amap={amap} cities={cities} level={level} activeCity={activeCity} selectedId={selectedId} onLevelChange={changeLevel} onSelectCity={selectCity} onSelectSchool={selectSchool} onFailure={() => retry?.()} />
                : state === "failed"
                  ? <div className="map-unavailable" role="status"><strong>标准地图暂时不可用</strong><p>学校目录仍可正常浏览。</p><button type="button" onClick={retry}>重新加载标准地图</button></div>
                  : <div className="map-loading" role="status"><span aria-hidden="true" /><small>正在加载标准地图…</small></div>
              }</AmapLoader>
            {level === "city" && !activeSchools.length && !loading ? <p className="map-empty-note">当前筛选下暂无学校，校园地图仍可浏览</p> : null}
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
        <SchoolDrawer key={`${selected?.id ?? "none"}:${JSON.stringify(query)}`} school={selected} query={query} onClose={() => setSelectedId(undefined)} />
      </div>
    </section>
  );
}
