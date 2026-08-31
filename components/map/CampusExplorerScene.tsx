import type { MapCitySummary, MapLevel } from "../../features/map/semantic-map";

export function CampusExplorerScene({ cities, level, activeCity }: {
  cities: MapCitySummary[];
  level: MapLevel;
  activeCity: string;
}) {
  const active = cities.find((city) => city.city === activeCity);
  const memberCount = level === "province"
    ? cities.reduce((sum, city) => sum + city.memberCount, 0)
    : active?.memberCount ?? 0;
  const schoolCount = level === "province"
    ? cities.reduce((sum, city) => sum + city.schoolCount, 0)
    : active?.schoolCount ?? 0;
  const place = level === "province" ? "广东" : activeCity;

  return <>
    <div className={`campus-explorer-art is-${level}`} aria-hidden="true">
      <span className="explorer-sun" />
      <span className="explorer-cloud explorer-cloud-one"><i /><i /><i /></span>
      <span className="explorer-cloud explorer-cloud-two"><i /><i /><i /></span>
      <span className="explorer-star explorer-star-one">✦</span>
      <span className="explorer-star explorer-star-two">★</span>
      <span className="explorer-star explorer-star-three">✧</span>
      <span className="explorer-plane">➤</span>
      <svg className="explorer-flight-path" viewBox="0 0 700 360" preserveAspectRatio="none">
        <path d="M35 88 C155 5 206 148 328 88 S532 42 666 114" />
        <path d="M86 310 C182 230 263 354 394 275 S564 201 656 245" />
      </svg>
    </div>
    <aside className="campus-energy-card" aria-label="共建能量">
      <span><i aria-hidden="true">✦</i> 共建能量</span>
      <strong>{place}已有{memberCount}位伙伴点亮{schoolCount}所学校</strong>
      <div className="energy-orbs" aria-hidden="true"><i>AI</i><i>创</i><i>学</i><i>+</i></div>
    </aside>
    <p className="campus-explorer-prompt">
      <span aria-hidden="true">⌖</span>
      {level === "province" ? "探索城市，看看高校能量在哪里汇聚" : "点击学校图钉，发现同校伙伴与项目"}
    </p>
  </>;
}

function clamp(value: number): number {
  return Math.max(12, Math.min(88, value));
}

export function CampusMapFallback({ cities, level, activeCity, onRetry }: {
  cities: MapCitySummary[];
  level: MapLevel;
  activeCity: string;
  onRetry: () => void;
}) {
  const active = cities.find((city) => city.city === activeCity);
  const center = active?.center ?? { lng: 113.2644, lat: 23.1291 };
  const points = level === "province"
    ? cities.map((city) => ({
      id: city.city,
      name: city.city,
      count: city.memberCount,
      lng: city.center.lng,
      lat: city.center.lat,
      left: clamp(((city.center.lng - 109.5) / 7.8) * 100),
      top: clamp((1 - (city.center.lat - 20.2) / 5.3) * 100),
    }))
    : (active?.schools ?? []).map((school) => ({
      id: school.id,
      name: school.name,
      count: school.memberCount,
      lng: school.lng,
      lat: school.lat,
      left: clamp(50 + ((school.lng - center.lng) / 0.8) * 52),
      top: clamp(50 - ((school.lat - center.lat) / 0.65) * 52),
    }));

  return <div className="campus-fallback-map" aria-label={`${level === "province" ? "广东" : activeCity}校园探索板块`}>
    <CampusExplorerScene cities={cities} level={level} activeCity={activeCity} />
    <div className={`paper-map-board is-${level}`} aria-hidden="true">
      <span className="paper-map-layer paper-map-layer-back" />
      <span className="paper-map-layer paper-map-layer-mid" />
      <span className="paper-map-layer paper-map-layer-top" />
      <b>{level === "province" ? "广东高校圈" : `${activeCity}高校圈`}</b>
    </div>
    <div className="fallback-map-points">
      {points.map((point, index) => <div
        className={`fallback-school-pin${index === 0 ? " is-hot" : ""}`}
        key={point.id}
        style={{ left: `${point.left}%`, top: `${point.top}%` }}
        title={`${point.name}，${point.count} 位共建者`}
      >
        <span>{point.count}位</span><strong>{point.name}</strong>
      </div>)}
      {!points.length ? <p className="fallback-first-light"><i>✦</i><strong>等待第一束共建之光</strong><span>学校数据加入后会在这里自动亮起</span></p> : null}
    </div>
    <div className="campus-map-offline-note">
      <span>探索板块仍可浏览</span>
      <small>精确边界服务暂时未连接</small>
      <button type="button" onClick={onRetry}>重新连接精确地图</button>
    </div>
  </div>;
}
