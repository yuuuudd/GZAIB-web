import assert from "node:assert/strict";
import test from "node:test";
import { act, createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
// @ts-expect-error The project intentionally runs jsdom without the optional @types/jsdom package.
import { JSDOM } from "jsdom";
import { createRoot } from "react-dom/client";
import { ConnectionInbox } from "../../components/connections/ConnectionInbox";

const incoming = { request: { id: "incoming", topic: "项目交流", message: "想和你交流校园 AI 项目。", status: "pending", createdAt: 2, updatedAt: 2 }, counterpart: { slug: "xia", nickname: "小夏", school: "中山大学", city: "广州", intro: "在做校园 AI 项目", skills: ["AI应用"] } };
const outgoing = { request: { id: "outgoing", topic: "项目交流", message: "我想认识你并交流项目经验。", status: "pending", createdAt: 1, updatedAt: 1 }, counterpart: { slug: "zhang", nickname: "张哥", school: "华南理工大学", city: "广州", intro: "关注产品共创", skills: ["产品设计"] } };
const accepted = { request: { id: "accepted", topic: "项目交流", message: "一起交流校园 AI 项目。", status: "accepted", createdAt: 3, updatedAt: 3 }, counterpart: { slug: "lin", nickname: "好友小林", school: "暨南大学", city: "广州", intro: "喜欢做有用的产品", skills: ["产品设计"] }, unlockedContactCard: { wechat: "lin_ai" } };

async function mountInbox() {
  const dom = new JSDOM('<div id="root"></div>', { url: "https://example.test/me/connections" });
  Object.assign(globalThis, { window: dom.window, document: dom.window.document, HTMLElement: dom.window.HTMLElement, IS_REACT_ACT_ENVIRONMENT: true });
  const originalFetch = globalThis.fetch;
  const calls: Array<{ url: string; method: string; body?: string }> = [];
  globalThis.fetch = async (input, init) => {
    const url = String(input);
    calls.push({ url, method: init?.method ?? "GET", body: typeof init?.body === "string" ? init.body : undefined });
    if (init?.method === "PATCH") return Response.json({ request: { ...incoming.request, status: "accepted" } });
    if (url.includes("box=received")) return Response.json({ items: [incoming] });
    if (url.includes("box=sent")) return Response.json({ items: [outgoing] });
    if (url.includes("box=accepted")) return Response.json({ items: [accepted] });
    return Response.json({ items: [] });
  };
  const root = createRoot(document.querySelector("#root")!);
  await act(async () => root.render(createElement(ConnectionInbox)));
  await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)); });
  return { dom, root, originalFetch, calls };
}

test("connection center exposes only the WeChat-style new-friends and friend-list sections", () => {
  const document = new JSDOM(renderToStaticMarkup(createElement(ConnectionInbox))).window.document;
  const tabs = [...document.querySelectorAll('[role="tab"]')].map((tab) => tab.textContent);
  assert.deepEqual(tabs, ["新的朋友", "好友列表"]);
});

test("friend list identifies accepted members and links to their profile and unlocked contact", async () => {
  const mounted = await mountInbox();
  const friendTab = [...document.querySelectorAll("button")].find((button) => button.textContent === "好友列表")!;
  await act(async () => friendTab.click());
  await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)); });
  assert.match(document.body.textContent ?? "", /好友小林/);
  assert.equal(document.querySelector<HTMLAnchorElement>('a[href="/members/lin"]')?.textContent, "查看资料");
  assert.match(document.body.textContent ?? "", /微信.*lin_ai/);
  await act(async () => mounted.root.unmount());
  globalThis.fetch = mounted.originalFetch;
  mounted.dom.window.close();
});

test("viewing an incoming request opens the member card and resolves it from that card", async () => {
  const mounted = await mountInbox();
  const view = [...document.querySelectorAll("button")].find((button) => button.textContent === "查看")!;
  await act(async () => view.click());
  const dialog = document.querySelector<HTMLElement>("dialog[open]")!;
  assert.match(dialog.textContent ?? "", /小夏/);
  assert.match(dialog.textContent ?? "", /中山大学.*广州/);
  assert.match(dialog.textContent ?? "", /在做校园 AI 项目/);
  assert.match(dialog.textContent ?? "", /接受/);
  assert.match(dialog.textContent ?? "", /婉拒/);

  const accept = [...dialog.querySelectorAll("button")].find((button) => button.textContent === "接受")!;
  await act(async () => accept.click());
  await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)); });
  assert.ok(mounted.calls.some((call) => call.method === "PATCH" && call.url.endsWith("/api/connections/incoming") && call.body === '{"action":"accept"}'));
  assert.equal(document.querySelector("dialog[open]"), null);
  await act(async () => mounted.root.unmount());
  globalThis.fetch = mounted.originalFetch;
  mounted.dom.window.close();
});

test("new friends combines incoming view actions with outgoing arrow status", async () => {
  const mounted = await mountInbox();
  assert.match(document.body.textContent ?? "", /小夏/);
  assert.match(document.body.textContent ?? "", /张哥/);
  assert.match(document.body.textContent ?? "", /↗\s*等待验证/);
  assert.equal([...document.querySelectorAll("button")].filter((button) => button.textContent === "查看").length, 1);
  assert.doesNotMatch(document.body.textContent ?? "", /接受连接|婉拒/);
  await act(async () => mounted.root.unmount());
  globalThis.fetch = mounted.originalFetch;
  mounted.dom.window.close();
});
