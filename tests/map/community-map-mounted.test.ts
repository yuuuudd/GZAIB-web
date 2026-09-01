import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import test from "node:test";
import { CommunityMap } from "../../components/map/CommunityMap";
import { EcosystemMapSwitcher } from "../../components/map/EcosystemMapSwitcher";
import type { PublicCommunity } from "../../features/communities/types";

function community(overrides: Partial<PublicCommunity> & Pick<PublicCommunity, "id" | "slug" | "name">): PublicCommunity {
  return { summary: "公开 AI 社群", primaryCity: "广州", locationMode: "city", focusTags: ["智能体"], officialUrl: "https://example.com/community", sourceUrl: "https://example.com/source", sourceLabel: "公开来源", claimed: false, updatedAt: 1, updates: [], ...overrides };
}

type Mounted = { container: HTMLDivElement; unmount: () => Promise<void> };

async function mount(element: React.ReactNode): Promise<Mounted> {
  const dom = new JSDOM("<!doctype html><html><body><div id=\"root\"></div></body></html>", { url: "https://example.test" });
  Object.assign(globalThis, { window: dom.window, document: dom.window.document, HTMLElement: dom.window.HTMLElement, Node: dom.window.Node, Event: dom.window.Event, MouseEvent: dom.window.MouseEvent, IS_REACT_ACT_ENVIRONMENT: true });
  const container = dom.window.document.querySelector<HTMLDivElement>("#root")!;
  const root: Root = createRoot(container);
  await act(async () => { root.render(element); });
  return { container, unmount: async () => { await act(async () => { root.unmount(); }); dom.window.close(); } };
}

async function waitFor(predicate: () => boolean): Promise<void> {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    if (predicate()) return;
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)); });
  }
  assert.fail("timed out waiting for mounted component output");
}

function FailedAmapLoader({ children }: { children: (state: "failed") => React.ReactNode }) {
  return createElement("div", { "data-testid": "failed-amap-loader" }, children("failed"));
}

test("mounted CommunityMap fetches communities, exposes AMap fallback, and changes the selected city after a click", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input) => {
    assert.equal(String(input), "/api/communities");
    return Response.json({ items: [community({ id: "guangzhou", slug: "guangzhou", name: "广州社群", primaryCity: "广州市" }), community({ id: "shenzhen", slug: "shenzhen", name: "深圳社群", primaryCity: "深圳市" })], citySummaries: [{ city: "广州市", communityCount: 1 }, { city: "深圳市", communityCount: 1 }] });
  };
  const mounted = await mount(createElement(CommunityMap, { AmapLoaderComponent: FailedAmapLoader }));
  try {
    await waitFor(() => mounted.container.textContent?.includes("广州社群") ?? false);
    assert.ok(mounted.container.querySelector('[data-testid="failed-amap-loader"]'));
    assert.match(mounted.container.textContent ?? "", /社群地图暂时不可用/);
    assert.equal(mounted.container.querySelector('a[href="/communities"]')?.textContent, "进入 AI 社群完整目录 →");
    const shenzhen = [...mounted.container.querySelectorAll("button")].find((button) => button.textContent === "深圳 · 1 个社群");
    assert.ok(shenzhen);
    await act(async () => { shenzhen.click(); });
    assert.match(mounted.container.innerHTML, /<h4[^>]*>深圳 · 1 个社群<\/h4>/);
    assert.match(mounted.container.textContent ?? "", /深圳社群/);
  } finally {
    globalThis.fetch = originalFetch;
    await mounted.unmount();
  }
});

test("mounted CommunityMap retains the directory entry after its real fetch effect rejects", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => { throw new Error("offline"); };
  const mounted = await mount(createElement(CommunityMap, { AmapLoaderComponent: FailedAmapLoader }));
  try {
    await waitFor(() => mounted.container.textContent?.includes("社群地图暂时无法读取") ?? false);
    assert.match(mounted.container.textContent ?? "", /社群地图暂时无法读取/);
    assert.equal(mounted.container.querySelector('a[href="/communities"]')?.textContent, "进入 AI 社群完整目录 →");
  } finally {
    globalThis.fetch = originalFetch;
    await mounted.unmount();
  }
});

test("mounted EcosystemMapSwitcher defaults to builders and changes to communities on its real button click", async () => {
  function BuilderSurface() { return createElement("p", null, "高校共建者已加载"); }
  function CommunitySurface() { return createElement("p", null, "AI 社群已加载"); }
  const mounted = await mount(createElement(EcosystemMapSwitcher, { BuilderMapComponent: BuilderSurface, CommunityMapComponent: CommunitySurface }));
  try {
    assert.match(mounted.container.textContent ?? "", /高校共建者已加载/);
    const communities = [...mounted.container.querySelectorAll("button")].find((button) => button.textContent === "AI 社群");
    assert.ok(communities);
    await act(async () => { communities.click(); });
    assert.match(mounted.container.textContent ?? "", /AI 社群已加载/);
    assert.doesNotMatch(mounted.container.textContent ?? "", /高校共建者已加载/);
  } finally {
    await mounted.unmount();
  }
});
