"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { schoolMembersUrl } from "../../features/directory/client-query";
import type { DirectoryMemberPreview, DirectoryQuery, DirectorySchool } from "../../features/directory/service";
import { MemberPreviewCard } from "./MemberPreviewCard";
import { SchoolEmblem } from "../map/SchoolEmblem";

type MemberPage = { items?: DirectoryMemberPreview[]; nextCursor?: string };

export function SchoolDrawer({ school, query, selectedMemberSlug, onMemberSelect, onClose }: { school?: DirectorySchool; query: DirectoryQuery; selectedMemberSlug?: string; onMemberSelect(member: DirectoryMemberPreview): void; onClose: () => void }) {
  const abortRef = useRef<AbortController>();
  const [members, setMembers] = useState<DirectoryMemberPreview[]>([]);
  const [nextCursor, setNextCursor] = useState<string>();
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string>();

  useEffect(() => () => abortRef.current?.abort(), []);
  if (!school) return null;
  const verified = school.previewMembers.filter((member) => member.verifiedBuilder).length;
  const load = useCallback(async (cursor?: string) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setLoading(true); setError(undefined);
    try {
      const response = await fetch(schoolMembersUrl(school.id, query, cursor), { signal: controller.signal });
      if (!response.ok) throw new Error("directory unavailable");
      const page = await response.json() as MemberPage;
      const items = Array.isArray(page.items) ? page.items : [];
      setMembers((current) => cursor ? [...current, ...items] : items);
      setNextCursor(typeof page.nextCursor === "string" ? page.nextCursor : undefined);
      setLoaded(true);
    } catch {
      if (!controller.signal.aborted) setError("成员目录暂时无法读取，请稍后重试。");
    } finally { if (!controller.signal.aborted) setLoading(false); }
  }, [query, school.id]);
  useEffect(() => { void load(); }, [load]);
  const displayed = loaded ? members : school.previewMembers;
  return (
    <aside className="school-drawer" aria-labelledby="school-drawer-title">
      <button className="drawer-close" type="button" aria-label="关闭学校成员面板" onClick={onClose}>×</button>
      <header className="drawer-header"><SchoolEmblem name={school.name} className="drawer-school-mark" /><div><h2 id="school-drawer-title">{school.name}</h2><p>{school.city} · {school.campus} · {school.memberCount} 位成员</p><span>{verified} 位认证共建者</span></div></header>
      <div className="drawer-members" aria-live="polite">
        {displayed.map((member) => <MemberPreviewCard key={member.slug} member={member} schoolId={school.id} selected={selectedMemberSlug === member.slug} onOpen={() => onMemberSelect(member)} />)}
      </div>
      {loaded && !loading && members.length === 0 ? <p className="drawer-more">当前筛选下还没有公开成员。</p> : null}
      {error ? <p className="drawer-more" role="alert">{error}</p> : null}
      {!loaded && school.memberCount > school.previewMembers.length ? <button className="drawer-load-more" type="button" onClick={() => void load()} disabled={loading}>{loading ? "正在加载成员…" : "查看全部成员"}</button> : null}
      {loaded && nextCursor ? <button className="drawer-load-more" type="button" onClick={() => void load(nextCursor)} disabled={loading}>{loading ? "正在加载成员…" : "加载更多成员"}</button> : null}
      {error ? <button className="drawer-load-more" type="button" onClick={() => void load(loaded ? nextCursor : undefined)} disabled={loading}>重试</button> : null}
    </aside>
  );
}
