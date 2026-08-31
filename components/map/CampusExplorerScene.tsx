/* eslint-disable @next/next/no-img-element -- vinext provides image handling at build time; native images keep this component directly renderable in unit tests. */
import type { MapCitySummary, MapLevel } from "../../features/map/semantic-map";

const PEARL_DELTA_LANDMARKS = [
  { city: "广州", slug: "guangzhou", label: "广州塔" },
  { city: "深圳", slug: "shenzhen", label: "深圳城市天际线" },
  { city: "珠海", slug: "bridge", label: "港珠澳大桥" },
  { city: "佛山", slug: "foshan", label: "佛山岭南建筑" },
  { city: "东莞", slug: "dongguan", label: "东莞科创城区" },
  { city: "中山", slug: "zhongshan", label: "中山纪念建筑" },
] as const;

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
      <div className={`paper-art-map is-${level}`}>
        <img
          className="paper-art-map-image"
          src="/map-art/guangdong-paper-clay.webp"
          alt=""
          width={1536}
          height={1024}
          fetchPriority="high"
        />
        <div className="pearl-delta-landmarks" role="img" aria-label="珠三角城市建筑贴纸">
          {PEARL_DELTA_LANDMARKS.map((landmark) => level === "province" || landmark.city === activeCity ? (
            <img
              className={`landmark-sticker landmark-${landmark.slug}`}
              src={`/map-art/landmark-${landmark.slug}.webp`}
              alt=""
              width={420}
              height={438}
              key={landmark.slug}
              title={landmark.label}
            />
          ) : null)}
        </div>
      </div>
    </div>
    <aside className="campus-energy-card" aria-label="共建能量">
      <span><i aria-hidden="true">+</i> 共建能量</span>
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
    <div className="fallback-map-points">
      {points.map((point, index) => <div
        className={`fallback-school-pin${index === 0 ? " is-hot" : ""}`}
        key={point.id}
        style={{ left: `${point.left}%`, top: `${point.top}%` }}
        title={`${point.name}，${point.count} 位共建者`}
      >
        <span>{point.count}位</span><strong>{point.name}</strong>
      </div>)}
      {!points.length ? <p className="fallback-first-light"><i>◎</i><strong>等待第一束共建之光</strong><span>学校数据加入后会在这里自动亮起</span></p> : null}
    </div>
    <div className="campus-map-offline-note">
      <span>探索板块仍可浏览</span>
      <small>精确边界服务暂时未连接</small>
      <button type="button" onClick={onRetry}>重新连接精确地图</button>
    </div>
  </div>;
}
