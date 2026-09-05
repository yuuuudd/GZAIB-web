"use client";

import { useState } from "react";
import type { CoCreateProject } from "../../features/co-create/projects";

export function MyCoCreateProjects({ projects }: { projects: CoCreateProject[] }) {
  const [items, setItems] = useState(projects);
  const [notice, setNotice] = useState("");
  async function toggle(project: CoCreateProject) {
    const action = project.publishStatus === "published" ? "archive" : "publish";
    setNotice("");
    const response = await fetch(`/api/co-create-projects/${encodeURIComponent(project.id)}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ action }) });
    const result = await response.json() as { error?: string };
    if (!response.ok) { setNotice(result.error ?? "操作失败，请稍后再试"); return; }
    setItems((current) => current.map((item) => item.id === project.id ? { ...item, publishStatus: action === "archive" ? "archived" : "published" } : item));
  }
  return <>
    <div className="my-co-create-heading"><div><p className="section-kicker">我的共创</p><h1>管理我的项目</h1><p>新项目会立即公开；下架后内容仍会保留。</p></div><a href="/me/co-creates/new">＋ 发起共创</a></div>
    {notice ? <p className="profile-editor-message" role="status">{notice}</p> : null}
    <div className="my-co-create-list">{items.length ? items.map((project) => <article key={project.id}>
      <header><span>{project.type}</span><b>{project.publishStatus === "published" ? "公开中" : "已下架"}</b></header>
      <h2>{project.title}</h2><p>{project.summary}</p>
      <footer><a href={`/me/co-creates/${project.id}/edit`}>编辑</a><button type="button" onClick={() => void toggle(project)}>{project.publishStatus === "published" ? "下架" : "重新公开"}</button></footer>
    </article>) : <p className="co-create-empty">你还没有发布共创项目。</p>}</div>
  </>;
}
