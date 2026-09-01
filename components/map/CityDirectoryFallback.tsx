"use client";

import type { DirectorySchool } from "../../features/directory/service";
import type { MapCitySummary, MapLevel } from "../../features/map/semantic-map";
import { normalizeCity } from "../../features/map/semantic-map";
import { SchoolDirectoryFallback } from "./SchoolDirectoryFallback";

export function CityDirectoryFallback({ cities, activeCity, level, selectedId, onSelectCity, onBackToProvince, onSelectSchool, prominent = false }: {
  cities: MapCitySummary[];
  activeCity: string;
  level: MapLevel;
  selectedId?: string;
  onSelectCity: (city: string) => void;
  onBackToProvince: () => void;
  onSelectSchool: (school: DirectorySchool) => void;
  prominent?: boolean;
}) {
  const normalizedCity = normalizeCity(activeCity);
  if (level === "city") {
    const schools = cities.find((summary) => summary.city === normalizedCity)?.schools ?? [];
    return <section className={`city-directory ${prominent ? "city-directory-prominent" : ""}`}>
      <nav className="map-level-nav" aria-label="地图层级">
        <button type="button" onClick={onBackToProvince}>广东</button>
        <span aria-hidden="true">/</span>
        <strong aria-current="page">{normalizedCity}</strong>
      </nav>
      <SchoolDirectoryFallback
        schools={schools}
        selectedId={selectedId}
        onSelect={onSelectSchool}
        prominent={prominent}
        heading={`${normalizedCity}学校网络`}
      />
    </section>;
  }

  if (level === "country") {
    const memberCount = cities.reduce((sum, city) => sum + city.memberCount, 0);
    const schoolCount = cities.reduce((sum, city) => sum + city.schoolCount, 0);
    return <section className={`city-directory city-directory-overview ${prominent ? "city-directory-prominent" : ""}`} aria-labelledby="city-directory-title">
      <div className="school-fallback-heading"><div><p className="map-section-kicker">全国省份网络</p><h2 id="city-directory-title">全国共建概览</h2></div><span>{cities.length ? 1 : 0} 个省份</span></div>
      {cities.length ? <ul className="city-directory-list"><li><button type="button" onClick={onBackToProvince}><span className="city-directory-mark" aria-hidden="true">粤</span><span><strong>广东</strong><small>{memberCount} 位共建者 · {schoolCount} 所学校 · {cities.length} 座城市</small></span><b aria-hidden="true">→</b></button></li></ul> : <div className="directory-empty"><strong>全国共建地图等待第一个省份</strong><p>提交申请后，点亮将从一所学校开始。</p></div>}
    </section>;
  }

  const place = "广东";
  return <section className={`city-directory city-directory-overview ${prominent ? "city-directory-prominent" : ""}`} aria-labelledby="city-directory-title">
    <div className="school-fallback-heading">
      <div>
        <p className="map-section-kicker">{place}城市网络</p>
        <h2 id="city-directory-title">{place}共建概览</h2>
      </div>
      <span>{cities.length} 座城市</span>
    </div>
    {prominent ? <p className="fallback-note">地图暂不可用，你仍可以从城市进入学校和公开成员目录。</p> : null}
    {cities.length ? <ul className="city-directory-list">
      {cities.map((city) => <li key={city.city}>
        <button type="button" onClick={() => onSelectCity(city.city)}>
          <span className="city-directory-mark" aria-hidden="true">{city.city.slice(0, 1)}</span>
          <span><strong>{city.city}</strong><small>{city.memberCount} 位共建者 · {city.schoolCount} 所学校</small></span>
          <b aria-hidden="true">→</b>
        </button>
      </li>)}
    </ul> : <div className="directory-empty">
      <strong>{place}共建地图等待第一所学校</strong>
      <p>你可以先进入广州，或提交申请点亮学校。</p>
      <button type="button" onClick={() => onSelectCity("广州")}>进入广州</button>
    </div>}
  </section>;
}
