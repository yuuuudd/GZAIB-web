"use client";

import type { DirectorySchool } from "../../features/directory/service";
import { MemberPreviewCard } from "./MemberPreviewCard";

export function SchoolDrawer({ school, onClose }: { school?: DirectorySchool; onClose: () => void }) {
  if (!school) return null;
  const verified = school.previewMembers.filter((member) => member.verifiedBuilder).length;
  return (
    <aside className="school-drawer" aria-labelledby="school-drawer-title">
      <button className="drawer-close" type="button" aria-label="关闭学校成员面板" onClick={onClose}>×</button>
      <header className="drawer-header">
        <span className="drawer-school-mark" aria-hidden="true">{school.name.slice(0, 1)}</span>
        <div><h2 id="school-drawer-title">{school.name}</h2><p>{school.city} · {school.campus} · {school.memberCount} 位成员</p><span>{verified} 位认证共建者</span></div>
      </header>
      <div className="drawer-members">
        {school.previewMembers.map((member) => <MemberPreviewCard key={member.slug} member={member} schoolId={school.id} />)}
      </div>
      {school.memberCount > school.previewMembers.length ? <p className="drawer-more">还有 {school.memberCount - school.previewMembers.length} 位成员</p> : null}
    </aside>
  );
}
