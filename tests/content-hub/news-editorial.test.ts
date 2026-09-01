import assert from "node:assert/strict";
// @ts-expect-error The project intentionally runs jsdom without the optional @types/jsdom package.
import { JSDOM } from "jsdom";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import test from "node:test";
import { NewsEditorial } from "../../components/content-hub/NewsEditorial";
import { newsItems, type NewsItem } from "../../features/content-hub/catalog";

const GLOBAL_KEYS = [
  "window",
  "document",
  "HTMLElement",
  "Node",
  "Event",
  "MouseEvent",
  "IS_REACT_ACT_ENVIRONMENT",
] as const;

test("selecting a news category keeps only matching latest rows and marks the real filter button", async () => {
  const dom = new JSDOM("<!doctype html><html><body><div id=\"root\"></div></body></html>", {
    url: "https://example.test/news",
  });
  const previous = new Map<string, PropertyDescriptor | undefined>(
    GLOBAL_KEYS.map((key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)]),
  );
  Object.assign(globalThis, {
    window: dom.window,
    document: dom.window.document,
    HTMLElement: dom.window.HTMLElement,
    Node: dom.window.Node,
    Event: dom.window.Event,
    MouseEvent: dom.window.MouseEvent,
    IS_REACT_ACT_ENVIRONMENT: true,
  });

  const container = dom.window.document.querySelector<HTMLDivElement>("#root")!;
  const root = createRoot(container);
  try {
    await act(async () => {
      root.render(createElement(NewsEditorial, { items: newsItems }));
    });

    const openSourceButton = [...container.querySelectorAll("button")]
      .find((button) => button.textContent === "开源工具");
    assert.ok(openSourceButton);

    await act(async () => {
      openSourceButton.click();
    });

    const rows = [...container.querySelectorAll<HTMLElement>("[data-news-category]")];
    assert.ok(rows.length > 0);
    assert.ok(rows.every((row) => row.dataset.newsCategory === "开源工具"));
    assert.equal(openSourceButton.getAttribute("aria-pressed"), "true");
    assert.match(container.textContent ?? "", /页面设计预览 · 以下为示例内容/);
    assert.match(container.textContent ?? "", /值得关注的 AI 新进展/);
  } finally {
    await act(async () => {
      root.unmount();
    });
    dom.window.close();
    for (const key of GLOBAL_KEYS) {
      const descriptor = previous.get(key);
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else Reflect.deleteProperty(globalThis, key);
    }
  }
});

test("the editorial hierarchy renders one lead, at most two secondary cards, and secure original links", () => {
  const extraSecondary: NewsItem = {
    ...newsItems[1]!,
    id: "news-extra-secondary",
    title: "不应出现的第三条次要推荐",
  };
  const html = renderToStaticMarkup(createElement(NewsEditorial, {
    items: [...newsItems, extraSecondary],
  }));
  const dom = new JSDOM(html);
  try {
    const leadCards = [...dom.window.document.querySelectorAll<HTMLElement>(".news-lead-card")];
    const secondaryCards = [...dom.window.document.querySelectorAll<HTMLElement>(".news-secondary-card")];
    assert.equal(leadCards.length, 1);
    assert.match(leadCards[0]?.textContent ?? "", /云风筝助手完成首轮虚构体验测试/);
    assert.equal(secondaryCards.length, 2);
    assert.doesNotMatch(secondaryCards.map((card) => card.textContent).join(" "), /不应出现的第三条次要推荐/);

    const latestText = [...dom.window.document.querySelectorAll<HTMLElement>("[data-news-category]")]
      .map((row) => row.textContent)
      .join(" ");
    assert.doesNotMatch(latestText, /云风筝助手|口袋模型实验室|珠江边/);

    const originalLinks = [...dom.window.document.querySelectorAll<HTMLAnchorElement>("a")]
      .filter((link) => link.textContent === "阅读原文 →");
    assert.ok(originalLinks.length > 0);
    assert.ok(originalLinks.every((link) => link.target === "_blank"));
    assert.ok(originalLinks.every((link) => link.getAttribute("rel") === "noreferrer noopener"));
  } finally {
    dom.window.close();
  }
});

test("an editorial selection with no non-featured rows shows the explicit empty message", () => {
  const html = renderToStaticMarkup(createElement(NewsEditorial, {
    items: newsItems.filter((item) => Boolean(item.featured)),
  }));
  assert.match(html, /暂时没有这个分类的资讯，试试其他分类。/);
  assert.doesNotMatch(html, /data-news-category=/);
});
