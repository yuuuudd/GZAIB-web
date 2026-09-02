"use client";

import { useEffect, useState } from "react";
import type { DirectoryMemberPreview } from "../../features/directory/service";
import type { ProjectedProfile } from "../../features/directory/types";
import Image from "next/image";

function metric(eventType: "profile_view" | "map_to_profile", schoolId: string) {
  const body = JSON.stringify({ eventType, dimensionKey: `school:${schoolId}` });
  if (navigator.sendBeacon) navigator.sendBeacon("/api/metrics", new Blob([body], { type: "application/json" }));
  else void fetch("/api/metrics", { method: "POST", headers: { "content-type": "application/json" }, body, keepalive: true });
}

export function MemberPreviewCard({ member, schoolId, selected, onOpen }: { member: DirectoryMemberPreview; schoolId: string; selected?: boolean; onOpen(): void }) {
  const [intro, setIntro] = useState<string>();
  useEffect(() => {
    const controller = new AbortController();
    void fetch(`/api/members/${encodeURIComponent(member.slug)}`, { signal: controller.signal })
      .then(async (response) => response.ok ? response.json() as Promise<{ profile?: ProjectedProfile }> : {})
      .then((data) => setIntro(data.profile?.intro))
      .catch(() => undefined);
    return () => controller.abort();
  }, [member.slug]);
  return (
    <article className={`member-preview-card ${selected ? "is-selected" : ""}`}>
      <div className="member-avatar" aria-hidden="true">
        {member.avatarUrl ? <Image src={member.avatarUrl} alt="" width={48} height={48} unoptimized /> : <span>{member.nickname.slice(0, 1)}</span>}
      </div>
      <div className="member-preview-copy">
        <strong>{member.nickname}</strong>
        <span>{intro ?? "正在加载公开介绍…"}</span>
        <div className="member-preview-tags">{member.skills.slice(0, 3).map((skill) => <i key={skill}>{skill}</i>)}</div>
      </div>
      {member.verifiedBuilder ? <span className="verified-badge">✓ 认证共建者</span> : <span className="member-badge">社区成员</span>}
      <button type="button" onClick={() => { metric("profile_view", schoolId); metric("map_to_profile", schoolId); onOpen(); }}>展开资料</button>
    </article>
  );
}
