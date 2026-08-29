"use client";

import { useState } from "react";

type School = { id: string; name: string; campus: string; city: string; longitude: number; latitude: number; coordinateStatus: string };

export function SchoolCoordinatePanel({ schools }: { schools: School[] }) {
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  async function post(body: unknown) {
    setPending(true); setMessage("");
    try {
      const response = await fetch("/api/admin/schools", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      const data = await response.json() as School & { error?: string };
      if (!response.ok) throw new Error(data.error ?? "坐标操作失败");
      setMessage("坐标操作已保存。刷新页面可查看最新状态。");
    } catch (error) { setMessage(error instanceof Error ? error.message : "坐标操作失败"); }
    finally { setPending(false); }
  }
  return <div className="school-admin-grid">
    <form className="admin-form-card" onSubmit={(event) => { event.preventDefault(); const data = new FormData(event.currentTarget); void post({ action: "propose", name: data.get("name"), campus: data.get("campus"), city: data.get("city") }); }}>
      <h2>新增学校坐标候选</h2><p>服务器调用高德地理编码；候选坐标必须由运营员再次确认才会公开。</p>
      <label>学校名称<input name="name" required minLength={2} /></label><label>校区<input name="campus" required minLength={2} /></label><label>城市<input name="city" required minLength={2} /></label>
      <button type="submit" className="action-primary" disabled={pending}>生成候选坐标</button>
    </form>
    <div className="admin-list-card"><h2>学校 / 校区</h2>{schools.map((school) => <article key={school.id}><div><strong>{school.name}</strong><span>{school.campus} · {school.city}</span><small>{(school.longitude / 1_000_000).toFixed(5)}, {(school.latitude / 1_000_000).toFixed(5)}</small></div><span className={`status-pill ${school.coordinateStatus === "confirmed" ? "status-ok" : "status-pending"}`}>{school.coordinateStatus === "confirmed" ? "已确认" : "待确认"}</span>{school.coordinateStatus !== "confirmed" ? <button type="button" className="action-primary" disabled={pending} onClick={() => post({ action: "confirm", schoolId: school.id })}>确认坐标</button> : null}</article>)}</div>
    {message ? <p role="status" className="admin-action-message">{message}</p> : null}
  </div>;
}
