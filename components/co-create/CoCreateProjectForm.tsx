"use client";

import { useState, type FormEvent } from "react";
import { CO_CREATE_LEVELS, CO_CREATE_SCOPES, CO_CREATE_STATUSES, CO_CREATE_TYPES, type CoCreateProjectInput } from "../../features/co-create/projects";

export function CoCreateProjectForm({ projectId, initial }: { projectId?: string; initial?: Partial<CoCreateProjectInput> }) {
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const form = event.currentTarget;
    const data = new FormData(form);
    const text = (name: string) => String(data.get(name) ?? "").trim();
    setPending(true); setMessage("");
    try {
      const response = await fetch(projectId ? `/api/co-create-projects/${encodeURIComponent(projectId)}` : "/api/co-create-projects", {
        method: projectId ? "PATCH" : "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ title: text("title"), type: text("type"), scope: text("scope"), status: text("status"), summary: text("summary"), details: text("details"), problem: text("problem"), roles: text("roles"), effort: text("effort"), deadline: text("deadline"), level: text("level") }),
      });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error ?? "暂时无法保存项目");
      window.location.assign("/me/co-creates");
    } catch (error) { setMessage(error instanceof Error ? error.message : "暂时无法保存项目"); }
    finally { setPending(false); }
  }
  return <form className="co-create-project-form" onSubmit={submit}>
    <header><p className="section-kicker">{projectId ? "管理共创" : "发起共创"}</p><h1>{projectId ? "编辑项目" : "发布共创项目"}</h1><p>发布后将立即出现在共创广场，之后可以随时编辑或下架。</p></header>
    <div className="co-create-form-grid">
      <label className="wide">项目名称<input name="title" required minLength={2} maxLength={100} defaultValue={initial?.title} /></label>
      <label>项目类型<select name="type" defaultValue={initial?.type ?? "项目共创"}>{CO_CREATE_TYPES.map((value) => <option key={value}>{value}</option>)}</select></label>
      <label>参与范围<select name="scope" defaultValue={initial?.scope ?? "广州"}>{CO_CREATE_SCOPES.map((value) => <option key={value}>{value}</option>)}</select></label>
      <label>当前状态<select name="status" defaultValue={initial?.status ?? "招募中"}>{CO_CREATE_STATUSES.map((value) => <option key={value}>{value}</option>)}</select></label>
      <label>经验要求<select name="level" defaultValue={initial?.level ?? "新手友好"}>{CO_CREATE_LEVELS.map((value) => <option key={value}>{value}</option>)}</select></label>
      <label className="wide">简要介绍<textarea name="summary" required minLength={10} maxLength={300} defaultValue={initial?.summary} /></label>
      <label className="wide">详细介绍<textarea name="details" required minLength={10} maxLength={2000} defaultValue={initial?.details} /></label>
      <label className="wide">希望解决的问题<textarea name="problem" required minLength={5} maxLength={500} defaultValue={initial?.problem} /></label>
      <label className="wide">招募角色<textarea name="roles" required minLength={2} maxLength={500} defaultValue={initial?.roles} placeholder="例如：产品 1 名、前端 1 名" /></label>
      <label>参与投入<input name="effort" required minLength={2} maxLength={200} defaultValue={initial?.effort} placeholder="例如：每周约 3 小时" /></label>
      <label>截止时间（选填）<input name="deadline" maxLength={50} defaultValue={initial?.deadline} placeholder="例如：2026-09-30" /></label>
    </div>
    <div className="co-create-form-actions"><a href="/me/co-creates">取消</a><button type="submit" disabled={pending}>{pending ? "正在保存…" : projectId ? "保存修改" : "立即发布"}</button></div>
    {message ? <p className="profile-editor-message" role="status">{message}</p> : null}
  </form>;
}
