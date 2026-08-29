"use client";

import type { DirectorySchool } from "../../features/directory/service";

export function SchoolDirectoryFallback({ schools, selectedId, onSelect, prominent = false }: {
  schools: DirectorySchool[];
  selectedId?: string;
  onSelect: (school: DirectorySchool) => void;
  prominent?: boolean;
}) {
  return (
    <section className={`school-fallback ${prominent ? "school-fallback-prominent" : ""}`} aria-labelledby={prominent ? "fallback-title" : "directory-title"}>
      <div className="school-fallback-heading">
        <div>
          <p className="map-section-kicker">学校目录</p>
          <h2 id={prominent ? "fallback-title" : "directory-title"}>{prominent ? "不依赖地图，也能找到共建者" : "按学校浏览"}</h2>
        </div>
        <span>{schools.length} 所已点亮</span>
      </div>
      {prominent ? <p className="fallback-note">当前以轻量目录呈现。每一所学校都使用运营确认的校区坐标，绝不读取成员实时位置。</p> : null}
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
                <span className="school-list-copy"><strong>{school.name}</strong><small>{school.campus} · {school.city}</small></span>
                <span className="school-list-count"><strong>{school.memberCount}</strong><small>位共建者</small></span>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <div className="directory-empty">
          <div className="directory-empty-orbit" aria-hidden="true"><i /><i /><i /></div>
          <strong>第一束光，等你点亮</strong>
          <p>学校目录会在首位共建者完成公开选择并通过审核后出现。</p>
          <a href="/apply">申请成为首位共建者</a>
        </div>
      )}
    </section>
  );
}
