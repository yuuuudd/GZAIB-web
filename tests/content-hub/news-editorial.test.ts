import assert from "node:assert/strict";
import test from "node:test";
import { JSDOM } from "jsdom";
import { createElement } from "react";
import { createRoot } from "react-dom/client";
import { act } from "react";
import { NewsEditorial } from "../../components/content-hub/NewsEditorial";
import { newsItems } from "../../features/content-hub/catalog";

test("news category buttons filter the sourced editorial list", async () => {
  const dom = new JSDOM('<div id="root"></div>', { url: "https://example.test/news" });
  Object.assign(globalThis, { window: dom.window, document: dom.window.document, HTMLElement: dom.window.HTMLElement, Node: dom.window.Node, Event: dom.window.Event, MouseEvent: dom.window.MouseEvent, IS_REACT_ACT_ENVIRONMENT: true });
  const root = createRoot(document.querySelector("#root")!);
  await act(async () => root.render(createElement(NewsEditorial, { items: newsItems })));
  assert.doesNotMatch(document.body.textContent ?? "", /示例内容/);
  const button = [...document.querySelectorAll("button")].find((node) => node.textContent === "开源工具") as HTMLButtonElement;
  await act(async () => button.click());
  const cards = [...document.querySelectorAll("[data-news-category]")];
  assert.ok(cards.length > 0);
  assert.ok(cards.every((card) => card.getAttribute("data-news-category") === "开源工具"));
  const sourceLink = document.querySelector('[data-news-category="开源工具"] a') as HTMLAnchorElement;
  assert.equal(sourceLink.target, "_blank");
  assert.match(sourceLink.rel, /noopener/);
  await act(async () => root.unmount());
  dom.window.close();
});
