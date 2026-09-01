"use client";

import { useState } from "react";
import { NEWS_CATEGORIES, filterNews, type NewsItem } from "../../features/content-hub/catalog";

function SourceLink({ item, label = "阅读原文 →" }: { item: NewsItem; label?: string }) {
  return <a href={item.url} target="_blank" rel="noreferrer noopener">{label}</a>;
}

export function NewsEditorial({ items }: { items: NewsItem[] }) {
  const [category, setCategory] = useState<(typeof NEWS_CATEGORIES)[number]>("全部");
  const lead = items.find((item) => item.featured === "lead");
  const secondary = items.filter((item) => item.featured === "secondary").slice(0, 2);
  const latest = category === "全部" ? items.filter((item) => !item.featured) : filterNews(items, category);

  return <section className="news-directory" aria-labelledby="news-title">
    <header className="content-hub-heading"><p className="community-kicker">AI 资讯</p><h1 id="news-title">值得关注的 AI 新进展</h1><p>少一点噪音，多一点真正值得了解的变化。所有内容均经公开来源核验，最后核验于 2026-09-01。</p></header>
    <div className="news-feature-grid">
      {lead ? <article className="news-lead-card"><div className="news-card-art" aria-hidden="true"><span>AI</span><strong>本期重点</strong></div><div><span>{lead.category}</span><h2>{lead.title}</h2><p>{lead.summary}</p><small>{lead.source} · {lead.publishedLabel}</small><SourceLink item={lead} label="查看官方来源 →" /></div></article> : null}
      <div className="news-secondary-stack">{secondary.map((item) => <article key={item.id}><span>{item.category}</span><h2>{item.title}</h2><p>{item.summary}</p><small>{item.source} · {item.publishedLabel}</small><SourceLink item={item} label="查看来源 →" /></article>)}</div>
    </div>
    <nav className="content-filter-pills" aria-label="资讯分类">{NEWS_CATEGORIES.map((value) => <button key={value} type="button" aria-pressed={category === value} onClick={() => setCategory(value)}>{value}</button>)}</nav>
    <div className="news-latest-list">{latest.map((item) => <article key={item.id} data-news-category={item.category}><span>{item.category}</span><div><h2>{item.title}</h2><p>{item.summary}</p><small>{item.source} · {item.publishedLabel}</small></div><SourceLink item={item} /></article>)}</div>
    {latest.length === 0 ? <p className="content-hub-empty">暂时没有匹配的资讯，试试其他分类。</p> : null}
  </section>;
}

