"use client";

import { useState } from "react";

type CommunityActionsProps = {
  communityId: string;
  officialUrl: string;
  officialDomain: string;
  contactSlug?: string;
  isLoggedIn: boolean;
  initiallyFollowed: boolean;
  followEnabled: boolean;
};

export function CommunityActions({
  communityId,
  officialUrl,
  officialDomain,
  contactSlug,
  isLoggedIn,
  initiallyFollowed,
  followEnabled,
}: CommunityActionsProps) {
  const [followed, setFollowed] = useState(initiallyFollowed);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");

  async function toggleFollow() {
    if (!followEnabled || pending) return;
    setPending(true);
    setMessage("");
    try {
      const response = await fetch("/api/community-follows", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ communityId, following: !followed }),
      });
      if (response.ok) setFollowed((current) => !current);
      else setMessage("暂时无法更新关注状态，请稍后再试");
    } catch {
      setMessage("暂时无法更新关注状态，请稍后再试");
    } finally {
      setPending(false);
    }
  }

  return <div className="community-actions" aria-label="社群操作">
    {isLoggedIn ? (
      <button type="button" disabled={!followEnabled || pending} onClick={toggleFollow}>
        {followEnabled ? (followed ? "已关注" : "关注社群") : "暂未开放关注"}
      </button>
    ) : (
      <a href="/apply">关注社群<span>（审核成员可关注）</span></a>
    )}
    <a href={officialUrl} target="_blank" rel="noopener noreferrer external">官方入口<span>（{officialDomain}）</span></a>
    {contactSlug ? <a href={`/members/${encodeURIComponent(contactSlug)}`}>联系负责人</a> : null}
    {message ? <p role="status">{message}</p> : null}
  </div>;
}
