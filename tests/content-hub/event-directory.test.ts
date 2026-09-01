import assert from "node:assert/strict";
// @ts-expect-error The project intentionally runs jsdom without the optional @types/jsdom package.
import { JSDOM } from "jsdom";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import test from "node:test";
import { EventDirectory } from "../../components/content-hub/EventDirectory";
import { eventItems, type EventItem } from "../../features/content-hub/catalog";

const GLOBAL_KEYS = [
  "window",
  "document",
  "HTMLElement",
  "Node",
  "Event",
  "MouseEvent",
  "IS_REACT_ACT_ENVIRONMENT",
] as const;

test("selecting workshop and Guangzhou keeps matching event articles and accessible filter state", async () => {
  const dom = new JSDOM("<!doctype html><html><body><div id=\"root\"></div></body></html>", {
    url: "https://example.test/events",
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
      root.render(createElement(EventDirectory, { items: eventItems }));
    });

    const buttons = [...container.querySelectorAll<HTMLButtonElement>("button")];
    const workshopButton = buttons.find((button) => button.textContent === "工作坊");
    const guangzhouButton = buttons.find((button) => button.textContent === "广州");
    assert.ok(workshopButton);
    assert.ok(guangzhouButton);

    await act(async () => {
      workshopButton.click();
      guangzhouButton.click();
    });

    const articles = [...container.querySelectorAll<HTMLElement>("[data-event-type]")];
    assert.ok(articles.length > 0);
    assert.ok(articles.every((article) => article.dataset.eventType === "工作坊"));
    assert.equal(workshopButton.getAttribute("aria-pressed"), "true");
    assert.equal(guangzhouButton.getAttribute("aria-pressed"), "true");

    const text = container.textContent ?? "";
    assert.match(text, /本周进行|即将开始|长期征集/);
    assert.match(text, /报名及结果通知由主办方负责/);
    assert.match(text, /页面设计预览 · 以下为示例内容/);

    const registrationLinks = [...container.querySelectorAll<HTMLAnchorElement>("a")]
      .filter((link) => link.textContent === "前往官网报名 ↗");
    assert.ok(registrationLinks.length > 0);
    assert.ok(registrationLinks.every((link) => new URL(link.href).protocol === "https:"));
    assert.ok(registrationLinks.every((link) => link.target === "_blank"));
    assert.ok(registrationLinks.every((link) => {
      const rel = new Set(link.rel.split(/\s+/));
      return rel.has("noreferrer") && rel.has("noopener");
    }));
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

test("timeline sections retain the approved group order regardless of item order", () => {
  const reordered = [eventItems[2]!, eventItems[3]!, eventItems[0]!]
    .map((item) => ({ ...item, locations: ["广州"] as EventItem["locations"] }));
  const html = renderToStaticMarkup(createElement(EventDirectory, { items: reordered }));
  const headings = ["本周进行", "即将开始", "长期征集"];
  const positions = headings.map((heading) => html.indexOf(`>${heading}<`));

  assert.ok(positions.every((position) => position >= 0));
  assert.ok(positions[0]! < positions[1]! && positions[1]! < positions[2]!);
});

test("a selection with no Guangzhou events renders the explicit empty state", () => {
  const onlineOnly: EventItem = {
    ...eventItems[1]!,
    id: "event-online-only",
    locations: ["线上"],
  };
  const html = renderToStaticMarkup(createElement(EventDirectory, { items: [onlineOnly] }));

  assert.match(html, /暂时没有匹配的活动，试试其他类型或地区。/);
  assert.doesNotMatch(html, /data-event-type=/);
});
