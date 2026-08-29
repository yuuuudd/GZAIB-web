"use client";

import type { DirectoryMemberPreview } from "../../features/directory/service";
import Image from "next/image";

function metric(eventType: "profile_view" | "map_to_profile", schoolId: string) {
  const body = JSON.stringify({ eventType, dimensionKey: `school:${schoolId}` });
  if (navigator.sendBeacon) navigator.sendBeacon("/api/metrics", new Blob([body], { type: "application/json" }));
  else void fetch("/api/metrics", { method: "POST", headers: { "content-type": "application/json" }, body, keepalive: true });
}

export function MemberPreviewCard({ member, schoolId }: { member: DirectoryMemberPreview; schoolId: string }) {
  return (
    <article className="member-preview-card">
      <div className="member-avatar" aria-hidden="true">
        {member.avatarUrl ? <Image src={member.avatarUrl} alt="" width={48} height={48} unoptimized /> : <span>{member.nickname.slice(0, 1)}</span>}
      </div>
      <div className="member-preview-copy">
        <strong>{member.nickname}</strong>
        <span>{[...member.skills, ...member.roles].slice(0, 2).join(" · ") || "共建者"}</span>
      </div>
      {member.verifiedBuilder ? <span className="verified-badge">✓ 认证共建者</span> : <span className="member-badge">社区成员</span>}
      <a href={`/members/${encodeURIComponent(member.slug)}`} onClick={() => { metric("profile_view", schoolId); metric("map_to_profile", schoolId); }}>查看资料</a>
    </article>
  );
}
