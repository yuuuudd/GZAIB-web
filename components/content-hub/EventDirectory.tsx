"use client";

import { useState } from "react";
import {
  EVENT_LOCATIONS,
  EVENT_TYPES,
  filterEvents,
  type EventGroup,
  type EventItem,
  type EventLocation,
  type EventType,
} from "../../features/content-hub/catalog";

const TIMELINE_GROUPS: EventGroup[] = ["本周进行", "即将开始", "长期征集"];

function RegistrationLink({ item }: { item: EventItem }) {
  return (
    <a className="event-registration-link" href={item.url} target="_blank" rel="noreferrer noopener">
      前往官网报名 ↗
    </a>
  );
}

export function EventDirectory({ items }: { items: EventItem[] }) {
  const [type, setType] = useState<EventType | "全部">("全部");
  const [location, setLocation] = useState<EventLocation>("广州");
  const filteredItems = filterEvents(items, type, location);
  const featuredItem = filteredItems.find((item) => item.featured) ?? filteredItems[0];
  const scheduleItems = filteredItems.slice(0, 4);

  return (
    <section className="event-directory" aria-labelledby="event-directory-title">
      <p className="content-preview-notice">页面设计预览 · 以下为示例内容</p>
      <header className="event-directory-heading">
        <p className="content-hub-kicker">AI 活动与赛事</p>
        <h1 id="event-directory-title">找到下一场值得参加的 AI 活动</h1>
        <p>比赛、黑客松、分享会与工作坊，从近期时间开始发现。</p>
      </header>

      <div className="event-filter-bar">
        <div className="event-type-filters" role="group" aria-label="按活动类型筛选">
          {EVENT_TYPES.map((value) => (
            <button
              key={value}
              type="button"
              aria-pressed={type === value}
              onClick={() => setType(value)}
            >
              {value}
            </button>
          ))}
        </div>
        <div className="event-location-filters" role="group" aria-label="按活动地区筛选">
          {EVENT_LOCATIONS.map((value) => (
            <button
              key={value}
              type="button"
              aria-pressed={location === value}
              onClick={() => setLocation(value)}
            >
              {value}
            </button>
          ))}
        </div>
      </div>

      <div className="event-directory-layout">
        <div className="event-directory-main">
          {featuredItem ? (
            <article className="event-featured-card" data-event-type={featuredItem.type}>
              <div className="event-featured-copy">
                <p className="event-card-date">{featuredItem.dateLabel}</p>
                <p className="event-card-type">{featuredItem.type}</p>
                <h2>{featuredItem.title}</h2>
                <p className="event-card-venue">{featuredItem.venue}</p>
                <p className="event-card-organizer">主办方：{featuredItem.organizer}</p>
                <p>{featuredItem.summary}</p>
                <RegistrationLink item={featuredItem} />
              </div>
              <div className="event-featured-art" aria-hidden="true" />
            </article>
          ) : (
            <p className="event-directory-empty" role="status">
              暂时没有匹配的活动，试试其他类型或地区。
            </p>
          )}

          {filteredItems.length ? (
            <div className="event-timeline">
              {TIMELINE_GROUPS.map((group) => {
                const groupItems = filteredItems.filter((item) => item.group === group);
                return groupItems.length ? (
                  <section key={group} className="event-timeline-group" aria-labelledby={`event-group-${group}`}>
                    <h2 id={`event-group-${group}`}>{group}</h2>
                    <div className="event-timeline-list">
                      {groupItems.map((item) => (
                        <article key={item.id} className="event-timeline-card" data-event-type={item.type}>
                          <p className="event-card-date">{item.dateLabel}</p>
                          <p className="event-card-type">{item.type}</p>
                          <h3>{item.title}</h3>
                          <p className="event-card-venue">{item.venue}</p>
                          <p className="event-card-deadline">{item.deadlineLabel}</p>
                          <RegistrationLink item={item} />
                        </article>
                      ))}
                    </div>
                  </section>
                ) : null;
              })}
            </div>
          ) : null}
        </div>

        <aside className="event-sidebar" aria-labelledby="event-schedule-title">
          <h2 id="event-schedule-title">近期日程</h2>
          {scheduleItems.length ? (
            <ol className="event-sidebar-list">
              {scheduleItems.map((item) => (
                <li key={item.id}>
                  <span>{item.dateLabel}</span>
                  <strong>{item.title}</strong>
                </li>
              ))}
            </ol>
          ) : null}
          <p className="event-sidebar-notice">报名及结果通知由主办方负责</p>
        </aside>
      </div>
    </section>
  );
}
