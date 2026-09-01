"use client";

import { useState } from "react";
import {
  filterNews,
  NEWS_CATEGORIES,
  type NewsCategory,
  type NewsItem,
} from "../../features/content-hub/catalog";

function NewsMeta({ item }: { item: NewsItem }) {
  return <p className="news-card-meta"><span>{item.source}</span><span>{item.publishedLabel}</span></p>;
}

function OriginalLink({ item }: { item: NewsItem }) {
  return <a href={item.url} target="_blank" rel="noreferrer noopener">阅读原文 →</a>;
}

export function NewsEditorial({ items }: { items: NewsItem[] }) {
  const [category, setCategory] = useState<NewsCategory | "全部">("全部");
  const leadItem = items.find((item) => item.featured === "lead");
  const secondaryItems = items.filter((item) => item.featured === "secondary").slice(0, 2);
  const latestItems = filterNews(items.filter((item) => !item.featured), category);

  return (
    <section className="news-editorial" aria-labelledby="news-editorial-title">
      <p className="content-preview-notice">页面设计预览 · 以下为示例内容</p>
      <header className="news-editorial-heading">
        <p className="content-hub-kicker">AI 资讯</p>
        <h1 id="news-editorial-title">值得关注的 AI 新进展</h1>
        <p>少一点噪音，多一点真正值得了解的变化。</p>
      </header>

      <section className="news-featured" aria-label="重点资讯">
        {leadItem ? (
          <article className="news-lead-card">
            <div className="news-card-art" aria-hidden="true" />
            <div className="news-card-copy">
              <p className="news-card-category">{leadItem.category}</p>
              <h2>{leadItem.title}</h2>
              <p>{leadItem.summary}</p>
              <NewsMeta item={leadItem} />
              <OriginalLink item={leadItem} />
            </div>
          </article>
        ) : null}
        {secondaryItems.length ? (
          <div className="news-secondary-grid">
            {secondaryItems.map((item) => (
              <article key={item.id} className="news-secondary-card">
                <p className="news-card-category">{item.category}</p>
                <h2>{item.title}</h2>
                <p>{item.summary}</p>
                <NewsMeta item={item} />
                <OriginalLink item={item} />
              </article>
            ))}
          </div>
        ) : null}
      </section>

      <div className="news-category-filters" aria-label="按分类筛选资讯">
        {NEWS_CATEGORIES.map((value) => (
          <button
            key={value}
            type="button"
            aria-pressed={category === value}
            onClick={() => setCategory(value)}
          >
            {value}
          </button>
        ))}
      </div>

      <section className="news-latest" aria-labelledby="news-latest-title">
        <h2 id="news-latest-title">最新资讯</h2>
        {latestItems.length ? latestItems.map((item) => (
          <article key={item.id} className="news-latest-row" data-news-category={item.category}>
            <p className="news-card-category">{item.category}</p>
            <div className="news-latest-copy">
              <h3>{item.title}</h3>
              <p>{item.summary}</p>
              <NewsMeta item={item} />
            </div>
            <OriginalLink item={item} />
          </article>
        )) : <p className="news-latest-empty" role="status">暂时没有这个分类的资讯，试试其他分类。</p>}
      </section>
    </section>
  );
}
