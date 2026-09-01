import assert from "node:assert/strict";
import { createElement, isValidElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import test from "node:test";
import { CommunityMapCanvasState, CommunityMapDirectory, CommunityMapSurface } from "../../components/map/CommunityMap";
import { displayedCommunityCityCount, groupCommunitiesByCity } from "../../features/map/community-map";
import type { PublicCommunity } from "../../features/communities/types";

function community(overrides: Partial<PublicCommunity> & Pick<PublicCommunity, "id" | "slug" | "name">): PublicCommunity {
  return { summary: "面向实践者的公开 AI 社群", primaryCity: "广州", locationMode: "city", focusTags: ["智能体"], officialUrl: "https://example.com/community", sourceUrl: "https://example.com/source", sourceLabel: "公开来源", claimed: false, updatedAt: 1, updates: [], ...overrides };
}

test("groups communities by normalized city and excludes online-only entries", () => {
  assert.deepEqual(groupCommunitiesByCity([
    community({ id: "a", slug: "guangzhou-a", name: "广州 A", primaryCity: "广州市", locationMode: "city" }),
    community({ id: "b", slug: "guangzhou-b", name: "广州 B", primaryCity: "广州", locationMode: "hybrid" }),
    community({ id: "c", slug: "online-c", name: "线上 C", primaryCity: null, locationMode: "online" }),
  ]).map(({ city, communityCount }) => ({ city, communityCount })), [{ city: "广州", communityCount: 2 }]);
});

test("uses explicit national centers but never invents one for an unknown city", () => {
  const summaries = groupCommunitiesByCity([community({ id: "beijing", slug: "beijing", name: "北京社群", primaryCity: "北京市" }), community({ id: "unknown", slug: "unknown", name: "未知城市社群", primaryCity: "未来城" })]);
  assert.deepEqual(summaries.map(({ city, center }) => ({ city, center })), [{ city: "北京", center: { lng: 116.4074, lat: 39.9042 } }]);
});

test("keeps a suffix-only city unmappable instead of assigning Guangzhou", () => {
  assert.deepEqual(groupCommunitiesByCity([community({ id: "suffix-only", slug: "suffix-only", name: "待确认社群", primaryCity: "地区" })]), []);
});

test("merges city forms before counting displayed cities and sorts cities and communities", () => {
  const items = [community({ id: "gz-b", slug: "gz-b", name: "贝塔社群", primaryCity: "广州地区" }), community({ id: "shenzhen", slug: "shenzhen", name: "深圳社群", primaryCity: "深圳市" }), community({ id: "gz-a", slug: "gz-a", name: "阿尔法社群", primaryCity: "广州市" }), community({ id: "beijing", slug: "beijing", name: "北京社群", primaryCity: "北京市" })];
  assert.equal(displayedCommunityCityCount(items), 3);
  assert.deepEqual(groupCommunitiesByCity(items).map((city) => ({ city: city.city, communityCount: city.communityCount, names: city.communities.map((community) => community.name) })), [{ city: "广州", communityCount: 2, names: ["阿尔法社群", "贝塔社群"] }, { city: "北京", communityCount: 1, names: ["北京社群"] }, { city: "深圳", communityCount: 1, names: ["深圳社群"] }]);
});

test("map heading reports the normalized city count rather than raw API forms", () => {
  const html = renderToStaticMarkup(createElement(CommunityMapSurface, {
    communities: [community({ id: "gz-a", slug: "gz-a", name: "甲社群", primaryCity: "广州市" }), community({ id: "gz-b", slug: "gz-b", name: "乙社群", primaryCity: "广州地区" })],
    loading: false, activeCity: "广州", onSelectCity: () => undefined, mapContent: createElement("div"),
  }));

  assert.match(html, /1 座城市已有公开社群/);
  assert.doesNotMatch(html, /2 座城市已有公开社群/);
});

function textOf(node: ReactNode): string {
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(textOf).join("");
  return isValidElement(node) ? textOf(node.props.children as ReactNode) : "";
}

function findButton(node: ReactNode, label: string): React.ReactElement<{ onClick?: () => void }> | undefined {
  if (Array.isArray(node)) return node.map((child) => findButton(child, label)).find(Boolean);
  if (!isValidElement(node)) return undefined;
  if (node.type === "button" && textOf(node.props.children as ReactNode) === label) return node as React.ReactElement<{ onClick?: () => void }>;
  return findButton(node.props.children as ReactNode, label);
}

test("city selection button changes the rendered community list", () => {
  const communities = [community({ id: "guangzhou", slug: "guangzhou", name: "广州社群", primaryCity: "广州" }), community({ id: "shenzhen", slug: "shenzhen", name: "深圳社群", primaryCity: "深圳" })];
  const cities = groupCommunitiesByCity(communities);
  let selected = "广州";
  const button = findButton(CommunityMapDirectory({ cities, communities, activeCity: selected, onSelectCity: (city) => { selected = city; } }), "深圳 · 1 个社群");
  button?.props.onClick?.();
  assert.equal(selected, "深圳");
  const html = renderToStaticMarkup(createElement(CommunityMapDirectory, { cities, communities, activeCity: selected, onSelectCity: () => undefined }));
  assert.match(html, /<h4[^>]*>深圳 · 1 个社群<\/h4>/);
  assert.match(html, /深圳社群/);
});

test("community API failure screen keeps its directory entry usable", () => {
  const html = renderToStaticMarkup(createElement(CommunityMapSurface, { communities: [], loading: false, notice: "社群地图暂时无法读取", activeCity: undefined, onSelectCity: () => undefined, mapContent: createElement("div", { role: "status" }, "地图加载中") }));
  assert.match(html, /社群地图暂时无法读取/);
  assert.match(html, /href="\/communities"/);
});

test("AMap failure keeps the already-read city and community list visible", () => {
  const communities = [community({ id: "guangzhou", slug: "guangzhou", name: "广州社群", primaryCity: "广州" })];
  const html = renderToStaticMarkup(createElement(CommunityMapSurface, { communities, loading: false, activeCity: "广州", onSelectCity: () => undefined, mapContent: createElement(CommunityMapCanvasState, { state: "failed", onRetry: () => undefined }) }));
  assert.match(html, /社群地图暂时不可用/);
  assert.match(html, /广州 · 1 个社群/);
  assert.match(html, /广州社群/);
  assert.match(html, /href="\/communities"/);
});
