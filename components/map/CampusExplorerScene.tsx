/* eslint-disable @next/next/no-img-element -- vinext provides image handling at build time; native images keep this component directly renderable in unit tests. */
import type { MapCitySummary, MapLevel } from "../../features/map/semantic-map";
import type { DirectorySchool } from "../../features/directory/service";

export function CampusExplorerScene({ cities, level, activeCity, onSelectCity }: {
  cities: MapCitySummary[];
  level: MapLevel;
  activeCity: string;
  onSelectCity?: (city: string) => void;
}) {
  const active = cities.find((city) => city.city === activeCity);
  const guangzhou = cities.find((city) => city.city === "广州");
  const memberCount = level === "province"
    ? cities.reduce((sum, city) => sum + city.memberCount, 0)
    : active?.memberCount ?? 0;
  const schoolCount = level === "province"
    ? cities.reduce((sum, city) => sum + city.schoolCount, 0)
    : active?.schoolCount ?? 0;
  const place = level === "province" ? "广东" : activeCity;
  const isGuangzhouCity = level === "city" && activeCity === "广州";

  return <>
    <div className={`campus-explorer-art is-${level}`}>
      {isGuangzhouCity ? <div className="guangzhou-region-art" role="img" aria-label="广州高校片区纸雕地图">
        <img
          className="guangzhou-region-art-image"
          src="/map-art/guangzhou-university-regions-v1.png"
          alt=""
          width={1536}
          height={1024}
          fetchPriority="high"
        />
      </div> : <div className={`paper-art-map is-${level}`}>
        <img
          className="paper-art-map-image"
          src="/map-art/guangdong-paper-clay.webp"
          alt=""
          width={1536}
          height={1024}
          fetchPriority="high"
        />
        <div className="pearl-delta-landmarks" role="img" aria-label="珠三角城市建筑贴纸">
          {level === "province" ? <button
            className="landmark-hotspot landmark-guangzhou-hotspot"
            data-layout="red-frame"
            type="button"
            aria-label={`进入广州学校网络，${guangzhou?.memberCount ?? 0}位共建者`}
            onClick={() => onSelectCity?.("广州")}
          >
            <img
              className="landmark-sticker landmark-guangzhou"
              src="/map-art/landmark-guangzhou.webp"
              alt=""
              width={420}
              height={438}
              title="广州塔"
            />
            <span>广州 <b>{guangzhou?.memberCount ?? 0}位</b></span>
          </button> : activeCity === "广州" ? <img
            className="landmark-sticker landmark-guangzhou landmark-guangzhou-city"
            src="/map-art/landmark-guangzhou.webp"
            alt=""
            width={420}
            height={438}
            title="广州塔"
          /> : null}
        </div>
      </div>}
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

function campusArtPosition(school: DirectorySchool, center: { lng: number; lat: number }, index: number) {
  const identity = `${school.name}${school.campus ?? ""}`;
  const universityTown = [
    { left: 66, top: 61 }, { left: 74, top: 58 }, { left: 81, top: 63 },
    { left: 84, top: 73 }, { left: 78, top: 81 }, { left: 68, top: 79 }, { left: 62, top: 70 },
  ];

  if (/大学城|东校园|小谷围/.test(identity)) return universityTown[index % universityTown.length];
  if (/南校园|海珠|昌岗/.test(identity)) {
    if (/中山大学/.test(identity)) return { left: 46, top: 56 };
    if (/仲恺/.test(identity)) return { left: 53, top: 59 };
    return { left: 59, top: 55 };
  }
  if (/五山|石牌|华南农业大学|暨南大学/.test(identity)) {
    if (/华南理工大学/.test(identity)) return { left: 68, top: 31 };
    if (/华南农业大学/.test(identity)) return { left: 76, top: 29 };
    if (/暨南大学/.test(identity)) return { left: 61, top: 32 };
    return { left: 54, top: 31 };
  }
  if (/白云|白云山/.test(identity)) return { left: 37 + (index % 3) * 6, top: 24 + (index % 2) * 4 };
  if (/黄埔/.test(identity)) return { left: 84, top: 38 };

  return {
    left: clamp(50 + ((school.lng - center.lng) / 0.8) * 52),
    top: clamp(50 - ((school.lat - center.lat) / 0.65) * 52),
  };
}

export function CampusMapFallback({ cities, level, activeCity, onSelectCity, onSelectSchool }: {
  cities: MapCitySummary[];
  level: MapLevel;
  activeCity: string;
  onRetry?: () => void;
  onSelectCity?: (city: string) => void;
  onSelectSchool?: (school: DirectorySchool) => void;
}) {
  const active = cities.find((city) => city.city === activeCity);
  const center = active?.center ?? { lng: 113.2644, lat: 23.1291 };
  const points = level === "province" ? [] : (active?.schools ?? []).map((school, index) => ({
      id: school.id,
      name: school.name,
      count: school.memberCount,
      school,
      ...campusArtPosition(school, center, index),
    }));

  return <div className="campus-fallback-map" aria-label={`${level === "province" ? "广东" : activeCity}校园探索板块`}>
    <CampusExplorerScene cities={cities} level={level} activeCity={activeCity} onSelectCity={onSelectCity} />
    <div className="fallback-map-points">
      {points.map((point, index) => <button
        type="button"
        className={`fallback-school-pin${index === 0 ? " is-hot" : ""}`}
        key={point.id}
        style={{ left: `${point.left}%`, top: `${point.top}%` }}
        title={`${point.name}，${point.count} 位共建者`}
        aria-label={`查看${point.name}，${point.count}位共建者`}
        onClick={() => onSelectSchool?.(point.school)}
      >
        <span className="fallback-pin-visual">
          <img
            className="fallback-pin-art"
            src={index === 0 ? "/map-art/school-pin-orange-v1.png" : "/map-art/school-pin-blue-v1.png"}
            alt=""
            width={1254}
            height={1254}
          />
          <b>{point.count}位</b>
        </span>
        <strong>{point.name}</strong>
      </button>)}
      {level === "city" && !points.length ? <p className="fallback-first-light"><i>◎</i><strong>等待第一束共建之光</strong><span>学校数据加入后会在这里自动亮起</span></p> : null}
    </div>
  </div>;
}
