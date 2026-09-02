import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { JSDOM } from "jsdom";
import { PrimaryNavigation } from "../../components/navigation/PrimaryNavigation";

function renderNavigation(active?: "home" | "map" | "co-create" | "communities" | "news" | "events" | "me") {
  const html = renderToStaticMarkup(createElement(PrimaryNavigation, { active }));
  return new JSDOM(html).window.document;
}

test("primary navigation leaves the account entry to the header action", () => {
  const document = renderNavigation();
  const links = [...document.querySelectorAll("a")].map((link) => ({
    href: link.getAttribute("href"),
    text: link.textContent,
  }));

  assert.deepEqual(links, [
    { href: "/", text: "首页" },
    { href: "/#map", text: "共建地图" },
    { href: "/co-create", text: "共创广场" },
    { href: "/communities", text: "AI 社群" },
    { href: "/news", text: "AI 资讯" },
    { href: "/events", text: "活动赛事" },
  ]);
});

test("primary navigation marks only the active channel with the correct current semantic", () => {
  const communityDocument = renderNavigation("communities");
  const communityLinks = [...communityDocument.querySelectorAll("a")];

  assert.deepEqual(communityLinks.map((link) => link.getAttribute("aria-current")), [null, null, null, "page", null, null]);
  assert.deepEqual(communityLinks.map((link) => link.classList.contains("brand-nav-active")), [false, false, false, true, false, false]);

  const homeDocument = renderNavigation("home");
  assert.equal(homeDocument.querySelector('a[href="/"]')?.getAttribute("aria-current"), "page");

  const mapDocument = renderNavigation("map");
  assert.equal(mapDocument.querySelector('a[href="/#map"]')?.getAttribute("aria-current"), "location");

  const coCreateDocument = renderNavigation("co-create");
  assert.equal(coCreateDocument.querySelector('a[href="/co-create"]')?.getAttribute("aria-current"), "page");

  const meDocument = renderNavigation("me");
  assert.equal(meDocument.querySelector('a[href="/me"]'), null);
});
