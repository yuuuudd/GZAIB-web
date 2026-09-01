import assert from "node:assert/strict";
import { createElement, isValidElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import test from "node:test";
import { EcosystemMapContent, EcosystemMapTabs, type EcosystemMapView } from "../../components/map/EcosystemMapSwitcher";

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

test("switcher click changes the default builder surface to the AI community surface", () => {
  let view: EcosystemMapView = "builders";
  const tabs = EcosystemMapTabs({ view, onSelect: (next) => { view = next; } });
  const initial = renderToStaticMarkup(createElement(EcosystemMapContent, {
    view, builders: createElement("p", null, "高校共建者地图"), communities: createElement("p", null, "AI 社群城市地图"),
  }));

  assert.match(initial, /高校共建者地图/);
  findButton(tabs, "AI 社群")?.props.onClick?.();
  assert.equal(view, "communities");
  const afterClick = renderToStaticMarkup(createElement(EcosystemMapContent, {
    view, builders: createElement("p", null, "高校共建者地图"), communities: createElement("p", null, "AI 社群城市地图"),
  }));

  assert.match(afterClick, /AI 社群城市地图/);
  assert.doesNotMatch(afterClick, /高校共建者地图/);
});
