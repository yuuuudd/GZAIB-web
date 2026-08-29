"use client";

import type { DirectoryQuery } from "../../features/directory/service";

const SKILLS = ["AI应用", "产品设计", "前端开发", "内容创作", "活动策划"];

export function DirectoryFilters({ query, onChange }: { query: DirectoryQuery; onChange: (query: DirectoryQuery) => void }) {
  const selectedSkill = query.skills?.[0];
  return (
    <div className="directory-filters" aria-label="筛选共建者">
      <div className="filter-chips" role="group" aria-label="按方向筛选">
        <button type="button" aria-pressed={!selectedSkill} onClick={() => onChange({ ...query, skills: undefined })}>全部</button>
        {SKILLS.map((skill) => (
          <button key={skill} type="button" aria-pressed={selectedSkill === skill} onClick={() => onChange({ ...query, skills: [skill] })}>{skill}</button>
        ))}
      </div>
      <label className="directory-search">
        <span className="sr-only">搜索昵称、学校、城市、技能或角色</span>
        <span aria-hidden="true">⌕</span>
        <input value={query.q ?? ""} onChange={(event) => onChange({ ...query, q: event.target.value || undefined })} placeholder="搜索学校、昵称或方向" />
      </label>
      <button className="verified-filter" type="button" aria-pressed={query.verified === true} onClick={() => onChange({ ...query, verified: query.verified ? undefined : true })}>
        <span aria-hidden="true">✓</span> 仅看认证共建者
      </button>
    </div>
  );
}
