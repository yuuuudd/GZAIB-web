"use client";

import { useState } from "react";
import { CO_CREATE_SCOPES, CO_CREATE_TYPES, coCreateItems, filterCoCreates } from "../../features/co-create/catalog";

const coreTypes = ["活动协作", "项目共创", "校园连接", "资源协作"] as const;
const participation = [
  ["✦", "发起共创", "/events/submit"],
  ["◎", "寻找伙伴", "#co-create-list"],
  ["▤", "我的共创", "/me/activities"],
] as const;
const metrics = [["◎", "正在招募", "8", "个共创"], ["●", "开放角色", "16", "个"], ["✓", "本月完成", "6", "个共创"], ["▥", "参与高校", "12", "所"]] as const;

export function CoCreateSquare() {
  const [type, setType] = useState<(typeof CO_CREATE_TYPES)[number]>("全部");
  const [scope, setScope] = useState<(typeof CO_CREATE_SCOPES)[number] | "全部">("全部");
  const items = filterCoCreates(coCreateItems, type, scope, "全部");
  const selectType = (value: (typeof CO_CREATE_TYPES)[number]) => {
    setType(value);
    document.getElementById("co-create-list")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };
  const chips = (label: string, values: readonly string[], active: string, setActive: (value: never) => void) => <div className="co-create-chip-group" aria-label={label}>{values.map((value) => <button key={value} type="button" aria-pressed={active === value} onClick={() => setActive(value as never)}>{value}</button>)}</div>;

  return <>
    <section className="co-create-top">
      <section className="co-create-hero" aria-labelledby="co-create-title">
        <div className="co-create-hero-copy"><p className="community-kicker">广州 AI 共创社 · 共创广场</p><h1 id="co-create-title">让想做的事，<br />找到愿意一起做的人</h1><p>发现正在发生的项目、活动和真实需求，找到你可以加入的位置。</p></div>
      </section>
      <div className="co-create-top-actions"><div className="co-create-hero-shortcuts" aria-label="共创分类快捷入口">{coreTypes.map((item, index) => <button key={item} type="button" onClick={() => selectType(item)}><i aria-hidden="true">{["◒", "✦", "⌂", "▤"][index]}</i><span><b>{item}</b></span><em aria-hidden="true">→</em></button>)}</div><section className="co-create-metrics" aria-label="共创演示数据">{metrics.map(([icon, label, count, unit], index) => <article key={label} className={`metric-${index}`}><i aria-hidden="true">{icon}</i><p><strong>{count} <small>{unit}</small></strong>{label}</p></article>)}</section></div>
    </section>
    <section className="co-create-main" id="co-create-list" aria-label="共创机会">
      <div className="co-create-layout"><div className="co-create-opportunities"><div className="co-create-filters">{chips("共创类型", ["全部", ...coreTypes], type, setType)}{chips("范围", ["全部", ...CO_CREATE_SCOPES], scope, setScope)}</div><div className="co-create-list">{items.map((item) => <a className="co-create-card" href="/events/submit" key={item.id} data-co-create-type={item.type}><header><span>{item.type}</span><b className={`status-${item.status}`}>{item.status}</b></header><h3>{item.title}</h3><p>{item.summary}</p><ul><li><i aria-hidden="true">⌘</i>{item.roles}</li><li><i aria-hidden="true">◷</i>{item.effort}</li><li><i aria-hidden="true">◫</i>截止 {item.deadline ?? "持续征集"}</li></ul><footer><span><i aria-hidden="true">○</i>{item.organizer}</span><b>{item.action} →</b></footer></a>)}{items.length === 0 ? <p className="co-create-empty">暂时没有匹配的共创，试试放宽筛选条件。</p> : null}</div></div>
        <aside className="co-create-aside" aria-labelledby="participation-title"><h2 id="participation-title">按你的方式参与</h2>{participation.map(([icon, title, href]) => <a href={href} key={title}><i aria-hidden="true">{icon}</i><span><b>{title}</b></span><em aria-hidden="true">→</em></a>)}</aside></div></section>
  </>;
}
