"use client";

import type { DirectorySchool } from "../../features/directory/service";

export function SchoolDirectoryFallback({ schools, selectedId, onSelect, prominent = false, heading = "按学校浏览" }: {
  schools: DirectorySchool[];
  selectedId?: string;
  onSelect: (school: DirectorySchool) => void;
  prominent?: boolean;
  heading?: string;
}) {
  return (
    <section className={`school-fallback ${prominent ? "school-fallback-prominent" : ""}`} aria-labelledby="school-directory-title">
      <div className="school-fallback-heading">
        <div>
          <p className="map-section-kicker">学校目录</p>
          <h2 id="school-directory-title">{heading}</h2>
        </div>
        <span>{schools.length} 所学校</span>
      </div>
      {prominent ? <p className="fallback-note">地图不可用时仍可浏览公开目录。学校位置来自经确认的校区坐标，不采集成员实时位置。</p> : null}
      {schools.length ? (
        <ul className="school-list">
          {schools.map((school) => (
            <li key={school.id}>
              <button
                type="button"
                aria-pressed={school.id === selectedId}
                className="school-list-item"
                onClick={() => onSelect(school)}
              >
                <span className="school-list-badge" aria-hidden="true">{school.name.slice(0, 1)}</span>
                <span className="school-list-copy"><strong>{school.name}</strong><small>{[school.campus, school.city].filter(Boolean).join(" · ")}</small></span>
                <span className="school-list-count"><strong>{school.memberCount}</strong><small>位共建者</small></span>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <div className="directory-empty">
          <div className="directory-empty-orbit" aria-hidden="true"><i /><i /><i /></div>
          <strong>当前筛选下暂无学校</strong>
          <p>调整筛选条件，或成为首位点亮这座城市的共建者。</p>
          <a href="/apply">申请加入共建地图</a>
        </div>
      )}
    </section>
  );
}
