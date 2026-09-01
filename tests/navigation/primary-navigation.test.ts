import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { JSDOM } from "jsdom";
import { PrimaryNavigation } from "../../components/navigation/PrimaryNavigation";

function renderNavigation(active?: "map" | "communities" | "news" | "events") {
  const html = renderToStaticMarkup(createElement(PrimaryNavigation, { active }));
  return new JSDOM(html).window.document;
}

test("primary navigation exposes the same four browser-native destinations on every page", () => {
  const document = renderNavigation();
  const links = [...document.querySelectorAll("a")].map((link) => ({
    href: link.getAttribute("href"),
    text: link.textContent,
  }));

  assert.deepEqual(links, [
    { href: "/#map", text: "共建地图" },
    { href: "/communities", text: "AI 社群" },
    { href: "/news", text: "AI 资讯" },
    { href: "/events", text: "活动赛事" },
  ]);
});

test("primary navigation marks only the active channel with the correct current semantic", () => {
  const communityDocument = renderNavigation("communities");
  const communityLinks = [...communityDocument.querySelectorAll("a")];

  assert.deepEqual(communityLinks.map((link) => link.getAttribute("aria-current")), [null, "page", null, null]);
  assert.deepEqual(communityLinks.map((link) => link.classList.contains("brand-nav-active")), [false, true, false, false]);

  const mapDocument = renderNavigation("map");
  assert.equal(mapDocument.querySelector('a[href="/#map"]')?.getAttribute("aria-current"), "location");
});
