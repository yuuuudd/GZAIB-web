import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { JSDOM } from "jsdom";
import { PrimaryNavigation } from "../../components/navigation/PrimaryNavigation";

function renderNavigation(active?: "home" | "map" | "co-create" | "communities" | "news" | "events" | "about" | "me") {
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
    { href: "/map", text: "共建地图" },
    { href: "/co-create", text: "共创广场" },
    { href: "/events", text: "活动赛事" },
    { href: "/about", text: "关于我们" },
  ]);
});

test("co-create page keeps the account entry in its header", () => {
  const page = readFileSync("app/co-create/page.tsx", "utf8");
  assert.match(page, /<a className="brand-header-action" href="\/me">我的<\/a>/);
});

test("primary navigation marks only the active channel with the correct current semantic", () => {
  const communityDocument = renderNavigation("communities");
  const communityLinks = [...communityDocument.querySelectorAll("a")];

  assert.deepEqual(communityLinks.map((link) => link.getAttribute("aria-current")), [null, null, null, null, null]);
  assert.deepEqual(communityLinks.map((link) => link.classList.contains("brand-nav-active")), [false, false, false, false, false]);

  const homeDocument = renderNavigation("home");
  assert.equal(homeDocument.querySelector('a[href="/"]')?.getAttribute("aria-current"), "page");

  const mapDocument = renderNavigation("map");
  assert.equal(mapDocument.querySelector('a[href="/map"]')?.getAttribute("aria-current"), "page");

  const coCreateDocument = renderNavigation("co-create");
  assert.equal(coCreateDocument.querySelector('a[href="/co-create"]')?.getAttribute("aria-current"), "page");

  const meDocument = renderNavigation("me");
  assert.equal(meDocument.querySelector('a[href="/me"]'), null);
  assert.equal(meDocument.querySelector('a[href="/me/connections"]')?.textContent, "连接中心");

  const aboutDocument = renderNavigation("about");
  assert.equal(aboutDocument.querySelector('a[href="/about"]')?.getAttribute("aria-current"), "page");
});
