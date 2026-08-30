"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { DirectoryQuery, DirectorySchool } from "../../features/directory/service";
import { DirectoryFilters } from "../directory/DirectoryFilters";
import { SchoolDrawer } from "../directory/SchoolDrawer";
import { AmapLoader, type AmapNamespace } from "./AmapLoader";
import { SchoolDirectoryFallback } from "./SchoolDirectoryFallback";

function recordMapView() {
  void fetch("/api/metrics", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ eventType: "map_view", dimensionKey: "all" }),
    keepalive: true,
  });
}

function MapCanvas({ amap, schools, onSelect }: { amap: AmapNamespace; schools: DirectorySchool[]; onSelect: (school: DirectorySchool) => void }) {
  const container = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!container.current) return;
    const map = new amap.Map(container.current, {
      zoom: 7.3,
      center: [113.35, 23.15],
      mapStyle: "amap://styles/whitesmoke",
      viewMode: "2D",
      showLabel: true,
    });
    const markers = schools.map((school) => {
      const content = document.createElement("div");
      content.className = "amap-school-marker";
      content.setAttribute("aria-hidden", "true");
      const count = document.createElement("strong");
      count.textContent = String(school.memberCount);
      const label = document.createElement("span");
      label.textContent = school.name;
      content.append(count, label);
      const marker = new amap.Marker({ position: [school.lng, school.lat], content, offset: [-24, -24] });
      marker.on("click", () => onSelect(school));
      return marker;
    });
    if (markers.length) {
      try {
        new amap.MarkerCluster(map, markers, { gridSize: 58, maxZoom: 17, averageCenter: true });
      } catch {
        map.add(markers);
      }
      map.setFitView(markers);
    }
    return () => map.destroy();
  }, [amap, schools, onSelect]);
  return <div ref={container} className="amap-canvas" aria-label="广东高校共建者学校坐标地图" />;
}

export function BuilderMap({ amapKey }: { amapKey?: string }) {
  const [query, setQuery] = useState<DirectoryQuery>({});
  const [schools, setSchools] = useState<DirectorySchool[]>([]);
  const [selectedId, setSelectedId] = useState<string>();
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<string>();

  useEffect(() => { recordMapView(); }, []);
  useEffect(() => {
    const controller = new AbortController();
    const timeout = window.setTimeout(async () => {
      const params = new URLSearchParams();
      if (query.q) params.set("q", query.q);
      if (query.skills?.length) params.set("skills", query.skills.join(","));
      if (query.roles?.length) params.set("roles", query.roles.join(","));
      if (query.city) params.set("city", query.city);
      if (query.schoolId) params.set("schoolId", query.schoolId);
      if (query.verified !== undefined) params.set("verified", String(query.verified));
      setLoading(true);
      try {
        const response = await fetch(`/api/directory?${params}`, { signal: controller.signal });
        if (!response.ok) throw new Error("Directory unavailable");
        const payload = await response.json() as { schools?: DirectorySchool[] };
        setSchools(Array.isArray(payload.schools) ? payload.schools : []);
        setNotice(undefined);
      } catch {
        if (!controller.signal.aborted) {
          setSchools([]);
          setNotice("目录正在整理中，你仍可提交资料申请点亮学校。");
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, query.q ? 220 : 0);
    return () => { window.clearTimeout(timeout); controller.abort(); };
  }, [query]);

  const selected = useMemo(() => schools.find((school) => school.id === selectedId), [schools, selectedId]);
  const selectSchool = useCallback((school: DirectorySchool) => setSelectedId(school.id), []);
  const memberCount = schools.reduce((total, school) => total + school.memberCount, 0);
  const cityCount = new Set(schools.map((school) => school.city)).size;

  return (
    <section className="builder-map-section" id="map" aria-labelledby="map-title">
      <div className="map-heading-row">
        <div><p className="map-section-kicker">广东高校共建者地图</p><h2 id="map-title">从一所学校开始，遇见行动中的人</h2></div>
        <p>地图只展示已确认的学校坐标，成员个人位置永不进入系统。</p>
      </div>
      <DirectoryFilters query={query} onChange={setQuery} />
      {notice ? <p className="directory-notice" role="status">{notice}</p> : null}
      <div className={`map-stage ${selected ? "map-stage-drawer-open" : ""}`} aria-busy={loading}>
        <AmapLoader apiKey={amapKey}>
          {(state, amap, retry) => state === "ready" && amap ? (
            <div className="map-live-layout">
              <div className="map-live"><MapCanvas amap={amap} schools={schools} onSelect={selectSchool} /><div className="map-live-label"><span>GD</span><strong>广东</strong><small>学校聚合视图</small></div></div>
              <SchoolDirectoryFallback schools={schools} selectedId={selectedId} onSelect={selectSchool} />
            </div>
          ) : state === "loading" ? (
            <div className="map-loading" role="status"><span /><strong>正在连接学校地图</strong><small>目录会在地图加载失败时自动接续</small></div>
          ) : (
            <div className="map-retry-state">
              <div className="map-retry-copy">
                <p className="map-section-kicker">高德地图</p>
                <strong>地图暂时没有连上</strong>
                <p>学校目录仍可浏览；点击后会重新连接高德底图。</p>
                <button type="button" onClick={retry}>重新加载地图</button>
              </div>
              <SchoolDirectoryFallback schools={schools} selectedId={selectedId} onSelect={selectSchool} />
            </div>
          )}
        </AmapLoader>
        <SchoolDrawer key={`${selected?.id ?? "none"}:${JSON.stringify(query)}`} school={selected} query={query} onClose={() => setSelectedId(undefined)} />
      </div>
      <div className="map-stats" aria-label="目录统计">
        <div><span aria-hidden="true">校</span><strong>{schools.length}</strong><p>所学校</p></div>
        <div><span aria-hidden="true">人</span><strong>{memberCount}</strong><p>位共建者</p></div>
        <div><span aria-hidden="true">城</span><strong>{cityCount}</strong><p>座城市</p></div>
        <p className="map-stats-note">数据来自本人公开选择与运营审核，不采集实时位置。</p>
      </div>
    </section>
  );
}
