"use client";

import { useState, type FormEvent } from "react";

type SubmissionMode = "create" | "profile-update" | "claim" | "update";

type CommunitySubmissionFormProps = {
  mode: SubmissionMode;
  community?: { id: string; name: string };
};

function requiredText(data: FormData, name: string): string {
  return String(data.get(name) ?? "");
}

function optionalText(data: FormData, name: string): string | undefined {
  const value = requiredText(data, name).trim();
  return value || undefined;
}

export function CommunitySubmissionForm({ mode, community }: CommunitySubmissionFormProps) {
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const isProfile = mode === "create" || mode === "profile-update";

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    setPending(true);
    setMessage("");
    const form = event.currentTarget;
    const data = new FormData(form);
    let endpoint = "/api/community-submissions";
    let input: Record<string, unknown>;
    if (isProfile) {
      const locationMode = requiredText(data, "locationMode");
      input = {
        kind: mode === "create" ? "create" : "update",
        ...(mode === "profile-update" ? { communityId: community?.id ?? "" } : {}),
        name: requiredText(data, "name"),
        summary: requiredText(data, "summary"),
        primaryCity: locationMode === "online" ? null : requiredText(data, "primaryCity"),
        locationMode,
        focusTags: requiredText(data, "focusTags").split(/[,，]/).map((tag) => tag.trim()).filter(Boolean),
        officialUrl: requiredText(data, "officialUrl"),
        sourceUrl: requiredText(data, "sourceUrl"),
        sourceLabel: requiredText(data, "sourceLabel"),
      };
    } else if (mode === "claim") {
      endpoint = "/api/community-claims";
      input = {
        communityId: community?.id ?? requiredText(data, "communityId"),
        evidence: requiredText(data, "evidence"),
        ...(optionalText(data, "evidenceUrl") ? { evidenceUrl: optionalText(data, "evidenceUrl") } : {}),
      };
    } else {
      endpoint = "/api/community-updates";
      const occurredAt = Date.parse(requiredText(data, "occurredAt"));
      input = {
        communityId: community?.id ?? "",
        title: requiredText(data, "title"),
        summary: requiredText(data, "summary"),
        occurredAt,
        ...(optionalText(data, "sourceUrl") ? { sourceUrl: optionalText(data, "sourceUrl") } : {}),
      };
    }
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(input),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({})) as { error?: string };
        setMessage(body.error ?? "暂时无法提交，请稍后再试");
        return;
      }
      setMessage("已提交，运营审核通过后公开");
      form.reset();
    } catch {
      setMessage("暂时无法提交，请稍后再试");
    } finally {
      setPending(false);
    }
  }

  const title = mode === "create" ? "提交新社群" : mode === "profile-update" ? `更新 ${community?.name ?? "社群"} 资料` : mode === "claim" ? "认领社群" : `提交 ${community?.name ?? "社群"} 动态`;
  return <section className="community-submission-card">
    <h2>{title}</h2>
    <p>所有内容先进入运营审核，审核通过前不会出现在公开目录、地图或社群页面。</p>
    <form onSubmit={submit}>
      {isProfile ? <>
        <label>社群名称<input name="name" required minLength={2} maxLength={80} /></label>
        <label>社群简介<textarea name="summary" required minLength={10} maxLength={300} /></label>
        <label>地点模式<select name="locationMode" defaultValue="city"><option value="city">城市</option><option value="hybrid">城市 + 线上</option><option value="online">纯线上</option></select></label>
        <label>主要城市<input name="primaryCity" maxLength={40} /></label>
        <label>方向标签<input name="focusTags" required placeholder="Agent, 产品" /></label>
        <label>官方链接<input name="officialUrl" type="url" inputMode="url" required placeholder="https://" /></label>
        <label>来源链接<input name="sourceUrl" type="url" inputMode="url" required placeholder="https://" /></label>
        <label>来源名称<input name="sourceLabel" required minLength={2} maxLength={80} /></label>
      </> : mode === "claim" ? <>
        {community ? null : <label>社群 ID<input name="communityId" required maxLength={120} /></label>}
        <label>认领依据<textarea name="evidence" required minLength={20} maxLength={500} /></label>
        <label>证明链接（可选）<input name="evidenceUrl" type="url" inputMode="url" placeholder="https://" /></label>
      </> : <>
        <label>动态标题<input name="title" required minLength={2} maxLength={100} /></label>
        <label>动态摘要<textarea name="summary" required minLength={10} maxLength={500} /></label>
        <label>发生时间<input name="occurredAt" type="datetime-local" required /></label>
        <label>来源链接（可选）<input name="sourceUrl" type="url" inputMode="url" placeholder="https://" /></label>
      </>}
      <button type="submit" disabled={pending}>{pending ? "提交中…" : "提交审核"}</button>
      {message ? <p role="status">{message}</p> : null}
    </form>
  </section>;
}
