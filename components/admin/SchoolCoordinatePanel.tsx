"use client";

import { useState } from "react";
import { AmapLoader, AmapLocationPreview, type AmapLocation, type AmapNamespace } from "../map/AmapLoader";

type School = { id: string; name: string; campus: string; city: string; longitude: number; latitude: number; coordinateStatus: string };
type Candidate = AmapLocation;

function locationOf(value: unknown): { longitude: number; latitude: number } | null {
  if (!value || typeof value !== "object") return null;
  const location = value as { lng?: unknown; lat?: unknown; getLng?: () => unknown; getLat?: () => unknown };
  const longitude = Number(typeof location.getLng === "function" ? location.getLng() : location.lng);
  const latitude = Number(typeof location.getLat === "function" ? location.getLat() : location.lat);
  return Number.isFinite(longitude) && Number.isFinite(latitude) ? { longitude: Math.round(longitude * 1_000_000), latitude: Math.round(latitude * 1_000_000) } : null;
}

function SchoolSearch({ amap, onSelect, pending }: { amap: AmapNamespace; onSelect: (candidate: Candidate) => void; pending: boolean }) {
  const [query, setQuery] = useState(""); const [results, setResults] = useState<Candidate[]>([]); const [preview, setPreview] = useState<Candidate>(); const [message, setMessage] = useState("");
  function search() { const keyword = query.trim(); if (!keyword) return; setMessage("正在搜索高德地图…"); setPreview(undefined); new amap.PlaceSearch({ city: "广东" }).search(keyword, (status, value) => {
    const pois = status === "complete" && value && typeof value === "object" ? ((value as { poiList?: { pois?: unknown[] } }).poiList?.pois ?? []) : [];
    const next = pois.flatMap((poi) => { if (!poi || typeof poi !== "object") return []; const row = poi as { name?: unknown; cityname?: unknown; adname?: unknown; address?: unknown; location?: unknown }; const coordinate = locationOf(row.location); return coordinate && typeof row.name === "string" ? [{ name: row.name, city: typeof row.cityname === "string" && row.cityname ? row.cityname : "广州", district: typeof row.adname === "string" ? row.adname : "", address: typeof row.address === "string" ? row.address : "", ...coordinate }] : []; }).slice(0, 8);
    setResults(next); setMessage(next.length ? "请选择一个高德搜索结果" : "没有找到可用地点，可在下方手动填写坐标");
  }); }
  function confirm(candidate: Candidate) { onSelect(candidate); setPreview(undefined); }
  return <section className="school-search"><h2>搜索高德学校地点</h2><p>先查看地点和周边地图，确认后才会保存为待确认坐标。</p><div><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="例如：中山大学广州校区" aria-label="搜索学校" /><button type="button" className="action-primary" disabled={pending} onClick={search}>搜索</button></div>{message ? <p role="status">{message}</p> : null}{preview ? <AmapLocationPreview amap={amap} location={preview} pending={pending} onBack={() => setPreview(undefined)} onConfirm={() => confirm(preview)} /> : <ul>{results.map((candidate) => <li key={`${candidate.name}-${candidate.longitude}`}><button type="button" disabled={pending} onClick={() => setPreview(candidate)}><strong>{candidate.name}</strong><span>{[candidate.city, candidate.district, candidate.address].filter(Boolean).join(" · ")}</span></button></li>)}</ul>}</section>;
}

export function SchoolCoordinatePanel({ schools, amapKey }: { schools: School[]; amapKey?: string }) {
  const [message, setMessage] = useState(""); const [pending, setPending] = useState(false);
  async function post(body: unknown) { setPending(true); setMessage(""); try { const response = await fetch("/api/admin/schools", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }); const data = await response.json() as School & { error?: string }; if (!response.ok) throw new Error(data.error ?? "保存失败"); setMessage("学校坐标已保存为待确认，请在右侧确认后使用。"); } catch (error) { setMessage(error instanceof Error ? error.message : "保存失败"); } finally { setPending(false); } }
  function select(candidate: Candidate) { const campus = window.prompt("校区名称（可修改）", candidate.name) ?? ""; if (campus.trim().length < 2) return; void post({ action: "select_amap", name: candidate.name, campus: campus.trim(), city: candidate.city, longitude: candidate.longitude, latitude: candidate.latitude }); }
  return <div className="school-admin-grid"><div className="school-entry-stack"><AmapLoader apiKey={amapKey}>{(state, amap) => state === "ready" && amap ? <SchoolSearch amap={amap} onSelect={select} pending={pending} /> : <section className="school-search"><h2>搜索高德学校地点</h2><p>{state === "failed" ? "高德搜索暂不可用，请在下方手动填写坐标。" : "正在加载高德搜索…"}</p></section>}</AmapLoader><form className="admin-form-card" onSubmit={(event) => { event.preventDefault(); const data = new FormData(event.currentTarget); void post({ action: "select_amap", name: data.get("name"), campus: data.get("campus"), city: data.get("city"), longitude: Math.round(Number(data.get("longitude")) * 1_000_000), latitude: Math.round(Number(data.get("latitude")) * 1_000_000) }); }}><h2>手动补录学校坐标</h2><p>搜索不到时填写学校、校区、城市和经纬度；坐标同样需要确认。</p><label>学校名称<input name="name" required minLength={2} /></label><label>校区<input name="campus" required minLength={2} /></label><label>城市<input name="city" required minLength={2} defaultValue="广州" /></label><label>经度<input name="longitude" required type="number" step="0.000001" min="-180" max="180" /></label><label>纬度<input name="latitude" required type="number" step="0.000001" min="-90" max="90" /></label><button type="submit" className="action-primary" disabled={pending}>保存待确认坐标</button></form></div><div className="admin-list-card"><h2>学校 / 校区</h2>{schools.map((school) => <article key={school.id}><div><strong>{school.name}</strong><span>{school.campus} · {school.city}</span><small>{(school.longitude / 1_000_000).toFixed(5)}, {(school.latitude / 1_000_000).toFixed(5)}</small></div><span className={`status-pill ${school.coordinateStatus === "confirmed" ? "status-ok" : "status-pending"}`}>{school.coordinateStatus === "confirmed" ? "已确认" : "待确认"}</span>{school.coordinateStatus !== "confirmed" ? <button type="button" className="action-primary" disabled={pending} onClick={() => post({ action: "confirm", schoolId: school.id })}>确认坐标</button> : null}</article>)}</div>{message ? <p role="status" className="admin-action-message">{message}</p> : null}</div>;
}
