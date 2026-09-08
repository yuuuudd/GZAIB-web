import assert from "node:assert/strict";
import test from "node:test";
import { JSDOM } from "jsdom";
import { createElement } from "react";
import { createRoot } from "react-dom/client";
import { act } from "react";
import { EventDirectory } from "../../components/content-hub/EventDirectory";
import { eventItems } from "../../features/content-hub/catalog";

test("event catalog contains current, traceable opportunities verified on 2026-09-08", () => {
  assert.equal(eventItems.some((item) => item.id === "aix-origin-2026"), false);
  assert.ok(eventItems.some((item) => item.id === "gosim-agentic-factory-2026"));
  assert.ok(eventItems.some((item) => item.id === "gosim-spotlight-shenzhen-2026"));
  assert.ok(eventItems.every((item) => item.url.startsWith("https://")));
});

test("event controls combine type and region across the approved sourced events", async () => {
  const dom = new JSDOM('<div id="root"></div>', { url: "https://example.test/events" });
  Object.assign(globalThis, { window: dom.window, document: dom.window.document, HTMLElement: dom.window.HTMLElement, Node: dom.window.Node, Event: dom.window.Event, MouseEvent: dom.window.MouseEvent, IS_REACT_ACT_ENVIRONMENT: true });
  const root = createRoot(document.querySelector("#root")!);
  await act(async () => root.render(createElement(EventDirectory, { items: eventItems })));
  const click = async (label: string) => {
    const button = [...document.querySelectorAll("button")].find((node) => node.textContent === label) as HTMLButtonElement;
    await act(async () => button.click());
  };
  await click("黑客松");
  await click("广东");
  const cards = [...document.querySelectorAll("[data-event-type]")];
  assert.ok(cards.length > 0);
  assert.ok(cards.every((card) => card.getAttribute("data-event-type") === "黑客松"));
  assert.equal(document.querySelector('[aria-label="活动视图"]'), null);
  assert.match(document.body.textContent ?? "", /本周进行|即将开始|长期征集/);
  assert.match(document.body.textContent ?? "", /报名及结果通知由主办方负责/);
  assert.match(document.body.textContent ?? "", /赛事信息核验于 2026-09-08/);
  assert.doesNotMatch(document.body.textContent ?? "", /示例内容/);
  assert.ok([...document.querySelectorAll("a")].filter((link) => link.textContent?.includes("官网")).every((link) => link.getAttribute("rel")?.includes("noopener")));
  await act(async () => root.unmount());
  dom.window.close();
});

test("event directory keeps one clear list view after filtering", async () => {
  const dom = new JSDOM('<div id="root"></div>', { url: "https://example.test/events" });
  Object.assign(globalThis, { window: dom.window, document: dom.window.document, HTMLElement: dom.window.HTMLElement, Node: dom.window.Node, Event: dom.window.Event, MouseEvent: dom.window.MouseEvent, IS_REACT_ACT_ENVIRONMENT: true });
  const root = createRoot(document.querySelector("#root")!);
  await act(async () => root.render(createElement(EventDirectory, { items: eventItems })));
  assert.equal(document.querySelector('[aria-label="活动视图"]'), null);
  assert.ok(document.querySelector(".event-content-grid"));
  await act(async () => root.unmount());
  dom.window.close();
});

test("guests are sent to sign in before starting an event", async () => {
  const dom = new JSDOM('<div id="root"></div>', { url: "https://example.test/events" });
  Object.assign(globalThis, { window: dom.window, document: dom.window.document, HTMLElement: dom.window.HTMLElement, Node: dom.window.Node, Event: dom.window.Event, MouseEvent: dom.window.MouseEvent, IS_REACT_ACT_ENVIRONMENT: true });
  const root = createRoot(document.querySelector("#root")!);
  await act(async () => root.render(createElement(EventDirectory, { items: eventItems, signedIn: false, loginHref: "/login?return_to=%2Fevents%2Fsubmit" } as never)));
  const link = [...document.querySelectorAll("a")].find((node) => node.textContent?.includes("登录后发起"));
  assert.equal(link?.getAttribute("href"), "/login?return_to=%2Fevents%2Fsubmit");
  await act(async () => root.unmount());
  dom.window.close();
});
