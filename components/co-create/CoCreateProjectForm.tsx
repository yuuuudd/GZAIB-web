"use client";

import { useState, type FormEvent } from "react";
import { CO_CREATE_PARTICIPATION_MODES, CO_CREATE_STATUSES, CO_CREATE_TYPES, type CoCreateProjectInput } from "../../features/co-create/projects";

export function CoCreateProjectForm({ projectId, initial }: { projectId?: string; initial?: Partial<CoCreateProjectInput> }) {
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const [participationMode, setParticipationMode] = useState(initial?.participationMode ?? "线下");
  const [locationTbd, setLocationTbd] = useState(initial?.locationTbd ?? false);
  const [timeTbd, setTimeTbd] = useState(initial?.timeTbd ?? true);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const data = new FormData(event.currentTarget);
    const text = (name: string) => String(data.get(name) ?? "").trim();
    setPending(true); setMessage("");
    try {
      const response = await fetch(projectId ? `/api/co-create-projects/${encodeURIComponent(projectId)}` : "/api/co-create-projects", {
        method: projectId ? "PATCH" : "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title: text("title"), type: text("type"), status: text("status"), summary: text("summary"), details: text("details"), problem: text("problem"),
          participationMode: text("participationMode"), location: text("location"), locationTbd: data.has("locationTbd"),
          startsAt: text("startsAt"), endsAt: text("endsAt"), timeTbd: data.has("timeTbd"), effort: text("effort"), roles: text("roles"), deadline: text("deadline"),
        }),
      });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error ?? "暂时无法保存项目");
      window.location.assign("/me/co-creates");
    } catch (error) { setMessage(error instanceof Error ? error.message : "暂时无法保存项目"); }
    finally { setPending(false); }
  }

  return <form className="co-create-project-form" onSubmit={submit}>
    <header><p className="section-kicker">{projectId ? "管理共创" : "发起共创"}</p><h1>{projectId ? "编辑项目" : "发布共创项目"}</h1><p>发布后将立即出现在共创广场，之后可以随时编辑或下架。</p></header>

    <section className="co-create-form-section"><h2>基本信息</h2><div className="co-create-form-grid">
      <label className="wide">项目名称<input name="title" required minLength={2} maxLength={100} defaultValue={initial?.title} /></label>
      <label>项目类型<select name="type" defaultValue={initial?.type ?? "项目共创"}>{CO_CREATE_TYPES.map((value) => <option key={value}>{value}</option>)}</select></label>
      <label>当前状态<select name="status" defaultValue={initial?.status ?? "招募中"}>{CO_CREATE_STATUSES.map((value) => <option key={value}>{value}</option>)}</select></label>
    </div></section>

    <section className="co-create-form-section"><h2>项目介绍</h2><div className="co-create-form-grid">
      <label className="wide">简要介绍<textarea rows={1} name="summary" required minLength={10} maxLength={300} defaultValue={initial?.summary} /></label>
      <label className="wide">详细介绍<textarea rows={1} name="details" required minLength={10} maxLength={2000} defaultValue={initial?.details} /></label>
      <label className="wide">希望解决的问题<textarea rows={1} name="problem" required minLength={5} maxLength={500} defaultValue={initial?.problem} /></label>
    </div></section>

    <section className="co-create-form-section"><h2>参与安排</h2><div className="co-create-form-grid">
      <label>参与方式<select name="participationMode" value={participationMode} onChange={(event) => setParticipationMode(event.currentTarget.value as typeof participationMode)}>{CO_CREATE_PARTICIPATION_MODES.map((value) => <option key={value}>{value}</option>)}</select></label>
      <label>参与投入<input name="effort" required minLength={2} maxLength={200} defaultValue={initial?.effort} placeholder="例如：每周约 3 小时" /></label>
      {participationMode !== "线上" ? <><label className="wide">活动地点<input name="location" required={!locationTbd} disabled={locationTbd} maxLength={200} defaultValue={initial?.location} placeholder="例如：广州市天河区·具体场地" /></label><label className="co-create-check wide"><input type="checkbox" name="locationTbd" checked={locationTbd} onChange={(event) => setLocationTbd(event.currentTarget.checked)} />地点待定</label></> : <input type="hidden" name="locationTbd" value="on" />}
      <label className="co-create-check wide"><input type="checkbox" name="timeTbd" checked={timeTbd} onChange={(event) => setTimeTbd(event.currentTarget.checked)} />活动时间待定</label>
      <label>开始时间<input type="datetime-local" name="startsAt" required={!timeTbd} disabled={timeTbd} defaultValue={initial?.startsAt} /></label>
      <label>结束时间<input type="datetime-local" name="endsAt" required={!timeTbd} disabled={timeTbd} defaultValue={initial?.endsAt} /></label>
    </div></section>

    <section className="co-create-form-section"><h2>招募需求</h2><div className="co-create-form-grid">
      <label className="wide">招募角色<textarea rows={1} name="roles" required minLength={2} maxLength={500} defaultValue={initial?.roles} placeholder="例如：产品 1 名、前端 1 名" /></label>
      <label>招募截止时间（选填）<input type="date" name="deadline" defaultValue={initial?.deadline} /></label>
    </div></section>

    <div className="co-create-form-actions"><a href="/me/co-creates">取消</a><button type="submit" disabled={pending}>{pending ? "正在保存…" : projectId ? "保存修改" : "立即发布"}</button></div>
    {message ? <p className="profile-editor-message" role="status">{message}</p> : null}
  </form>;
}
