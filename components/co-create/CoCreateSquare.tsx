"use client";

import { useEffect, useRef, useState } from "react";
import { CO_CREATE_SCOPES, CO_CREATE_TYPES, filterCoCreates } from "../../features/co-create/catalog";
import type { PublicCoCreateProject } from "../../features/co-create/projects";
import { ConnectButton, type ConnectionCtaState } from "../connections/ConnectButton";

const coreTypes = ["活动协作", "项目共创", "校园连接", "资源协作"] as const;
const participation = [["✦", "发起共创", "/me/co-creates/new"], ["◎", "寻找伙伴", "#co-create-list"], ["▤", "我的共创", "/me/co-creates"]] as const;
const metrics = [["◎", "正在招募", "8", "个共创"], ["●", "开放角色", "16", "个"], ["✓", "本月完成", "6", "个共创"], ["▥", "参与高校", "12", "所"]] as const;

function ProjectJoinAction({ project }: { project: PublicCoCreateProject }) {
  const [connection, setConnection] = useState<{ state: ConnectionCtaState; dailyRemaining: number }>();
  useEffect(() => {
    const controller = new AbortController();
    void fetch(`/api/members/${encodeURIComponent(project.organizerSlug)}`, { signal: controller.signal })
      .then(async (response): Promise<{ connection?: { state: ConnectionCtaState; dailyRemaining: number } }> => response.ok ? response.json() : {})
      .then((data) => setConnection(data.connection ?? { state: "unavailable", dailyRemaining: 0 }))
      .catch((error) => { if ((error as { name?: string }).name !== "AbortError") setConnection({ state: "unavailable", dailyRemaining: 0 }); });
    return () => controller.abort();
  }, [project.organizerSlug]);
  if (!connection) return <button className="connection-cta" type="button" disabled>正在检查申请状态…</button>;
  return <ConnectButton {...connection} recipientSlug={project.organizerSlug} recipientName={project.organizer} label="申请加入" topic={project.title} />;
}

export function CoCreateSquare({ items: allItems, signedIn, loginHref }: { items: PublicCoCreateProject[]; signedIn: boolean; loginHref: string }) {
  const [type, setType] = useState<(typeof CO_CREATE_TYPES)[number] | "全部">("全部");
  const [scope, setScope] = useState<(typeof CO_CREATE_SCOPES)[number] | "全部">("全部");
  const [selected, setSelected] = useState<PublicCoCreateProject>();
  const closeRef = useRef<HTMLButtonElement>(null);
  const items = filterCoCreates(allItems, type, scope, "全部");
  useEffect(() => {
    if (!selected) return;
    closeRef.current?.focus();
    const close = (event: KeyboardEvent) => { if (event.key === "Escape") setSelected(undefined); };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [selected]);
  const selectType = (value: (typeof CO_CREATE_TYPES)[number]) => { setType(value); document.getElementById("co-create-list")?.scrollIntoView({ behavior: "smooth", block: "start" }); };
  const chips = (label: string, values: readonly string[], active: string, setActive: (value: never) => void) => <div className="co-create-chip-group" aria-label={label}>{values.map((value) => <button key={value} type="button" aria-pressed={active === value} onClick={() => setActive(value as never)}>{value}</button>)}</div>;

  return <>
    <section className="co-create-top"><section className="co-create-hero" aria-labelledby="co-create-title"><div className="co-create-hero-copy"><p className="community-kicker">广州AI共创社 · 共创广场</p><h1 id="co-create-title"><span className="hero-title-line">让每一个想法</span><span className="hero-title-line"><span className="hero-title-accent">找到同行者</span>。</span></h1><p>发现真实需求、开放项目与协作机会，在这里找到可以一起开始的人。</p></div></section><div className="co-create-top-actions"><div className="co-create-hero-shortcuts" aria-label="共创分类快捷入口">{coreTypes.map((item, index) => <button key={item} type="button" onClick={() => selectType(item)}><i aria-hidden="true">{["◒", "✦", "⌂", "▤"][index]}</i><span><b>{item}</b></span><em aria-hidden="true">→</em></button>)}</div><section className="co-create-metrics" aria-label="共创演示数据">{metrics.map(([icon, label, count, unit], index) => <article key={label} className={`metric-${index}`}><i aria-hidden="true">{icon}</i><p><strong>{count} <small>{unit}</small></strong>{label}</p></article>)}</section></div></section>
    <section className="co-create-main" id="co-create-list" aria-label="共创机会"><div className="co-create-layout"><div className="co-create-opportunities"><div className="co-create-filters">{chips("共创类型", ["全部", ...coreTypes], type, setType)}{chips("范围", ["全部", ...CO_CREATE_SCOPES], scope, setScope)}</div><div className="co-create-list">{items.map((item) => <button className="co-create-card" type="button" onClick={() => setSelected(item)} key={item.id} data-co-create-type={item.type}><header><span>{item.type}</span><b className={`status-${item.status}`}>{item.status}</b></header><h3>{item.title}</h3><p>{item.summary}</p><ul><li><i aria-hidden="true">⌘</i>{item.roles}</li><li><i aria-hidden="true">◷</i>{item.effort}</li><li><i aria-hidden="true">◫</i>截止 {item.deadline ?? "持续征集"}</li></ul><footer><span><i aria-hidden="true">○</i>{item.organizer}</span><b>查看详情 →</b></footer></button>)}{items.length === 0 ? <p className="co-create-empty">暂时没有匹配的共创，试试放宽筛选条件。</p> : null}</div></div><aside className="co-create-aside" aria-labelledby="participation-title"><h2 id="participation-title">按你的方式参与</h2>{participation.map(([icon, title, href]) => <a href={href} key={title}><i aria-hidden="true">{icon}</i><span><b>{title}</b></span><em aria-hidden="true">→</em></a>)}</aside></div></section>
    {selected ? <div className="co-create-dialog-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelected(undefined); }}><section className="co-create-detail-dialog" role="dialog" aria-modal="true" aria-labelledby="co-create-dialog-title"><button ref={closeRef} className="connection-dialog-close" type="button" aria-label="关闭项目详情" onClick={() => setSelected(undefined)}>×</button><header><span>{selected.type} · {selected.scope}</span><b>{selected.status}</b></header><h2 id="co-create-dialog-title">{selected.title}</h2><p className="co-create-detail-summary">{selected.summary}</p><div className="co-create-detail-body"><section><h3>项目介绍</h3><p>{selected.details}</p></section><section><h3>希望解决的问题</h3><p>{selected.problem}</p></section><dl><div><dt>招募角色</dt><dd>{selected.roles}</dd></div><div><dt>参与投入</dt><dd>{selected.effort}</dd></div><div><dt>截止时间</dt><dd>{selected.deadline ?? "持续征集"}</dd></div><div><dt>经验要求</dt><dd>{selected.level}</dd></div></dl></div><footer><a className="co-create-organizer" href={`/members/${selected.organizerSlug}`}>发起人：{selected.organizer}</a><small>更新于 {new Date(selected.updatedAt).toISOString().slice(0, 10)}</small><div className="co-create-detail-action">{selected.isOwner ? <a className="connection-cta" href={`/me/co-creates/${selected.id}/edit`}>管理项目 →</a> : !signedIn ? <a className="connection-cta" href={loginHref}>登录后申请加入 →</a> : <ProjectJoinAction project={selected} />}</div></footer></section></div> : null}
  </>;
}
