"use client";

import { useState } from "react";
import { EVENT_LOCATIONS, EVENT_TYPES, filterEvents, type EventGroup, type EventItem, type EventLocation } from "../../features/content-hub/catalog";

const EVENT_GROUPS: EventGroup[] = ["本周进行", "即将开始", "长期征集"];

function OfficialLink({ item }: { item: EventItem }) {
  return <a href={item.url} target="_blank" rel="noreferrer noopener">前往官网查看 ↗</a>;
}

export function EventDirectory({ items }: { items: EventItem[] }) {
  const [type, setType] = useState<(typeof EVENT_TYPES)[number]>("全部");
  const [location, setLocation] = useState<EventLocation>("广东");
  const filtered = filterEvents(items, type, location);
  const featured = filtered.find((item) => item.featured) ?? filtered[0];

  return <section className="event-directory" aria-labelledby="events-title">
    <header className="content-hub-heading"><p className="community-kicker">AI 活动与赛事</p><h1 id="events-title">找到下一场值得参加的 AI 活动</h1><p>比赛、黑客松、分享会与工作坊，从近期时间开始发现。信息最后核验于 2026-09-01。</p></header>
    <div className="event-filter-bar"><div aria-label="活动类型">{EVENT_TYPES.map((value) => <button key={value} type="button" aria-pressed={type === value} onClick={() => setType(value)}>{value}</button>)}</div><div aria-label="活动地区">{EVENT_LOCATIONS.map((value) => <button key={value} type="button" aria-pressed={location === value} onClick={() => setLocation(value)}>{value}</button>)}</div></div>
    <div className="event-content-grid">
      <div>
        {featured ? <article className="event-feature-card" data-event-type={featured.type}><span>{featured.dateLabel}</span><div><small>{featured.type}</small><h2>{featured.title}</h2><p>{featured.venue} · {featured.organizer}</p><p>{featured.summary}</p><small>报名截止：{featured.deadlineLabel}</small><OfficialLink item={featured} /></div></article> : null}
        {EVENT_GROUPS.map((group) => {
          const groupItems = filtered.filter((item) => item.group === group && item.id !== featured?.id);
          return groupItems.length ? <section className="event-timeline-group" key={group}><h2>{group}</h2>{groupItems.map((item) => <article key={item.id} data-event-type={item.type}><time>{item.dateLabel}</time><span>{item.type}</span><div><h3>{item.title}</h3><p>{item.venue} · {item.organizer}</p><small>报名截止：{item.deadlineLabel}</small></div><OfficialLink item={item} /></article>)}</section> : null;
        })}
        {filtered.length === 0 ? <p className="content-hub-empty">暂时没有匹配的活动，试试其他类型或地区。</p> : null}
      </div>
      <aside className="event-sidebar"><section aria-labelledby="schedule-title"><h2 id="schedule-title">近期日程</h2><ul>{filtered.slice(0, 5).map((item) => <li key={item.id}><time>{item.dateLabel}</time><span>{item.title}</span></li>)}</ul>{filtered.length === 0 ? <p>当前筛选暂无日程。</p> : null}</section><p className="event-responsibility-note"><strong>报名提示</strong>本站只提供信息索引；报名及结果通知由主办方负责，资格审核与赛程变化也请以主办方最新通知为准。</p></aside>
    </div>
  </section>;
}
