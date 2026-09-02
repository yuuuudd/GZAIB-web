import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { JSDOM } from "jsdom";
import { CoCreateSquare } from "../../components/co-create/CoCreateSquare";
import { coCreateItems, filterCoCreates } from "../../features/co-create/catalog";

test("co-create filters keep only items matching every selected participation constraint", () => {
  const items = filterCoCreates(coCreateItems, "活动协作", "线上", "新手友好");
  assert.deepEqual(items.map((item) => item.id), ["tool-sharing"]);
  assert.deepEqual(filterCoCreates(coCreateItems, "项目共创", "广州", "需要经验"), []);
});

test("co-create hero keeps the action copy without a decorative illustration", () => {
  const document = new JSDOM(renderToStaticMarkup(createElement(CoCreateSquare))).window.document;
  assert.match(document.querySelector(".co-create-hero")?.textContent ?? "", /让想做的事/);
  assert.equal(document.querySelector(".co-create-hero-art"), null);
  assert.equal(document.querySelector(".idea-network"), null);
});

test("co-create hero exposes the four category shortcuts used by the main filters", () => {
  const document = new JSDOM(renderToStaticMarkup(createElement(CoCreateSquare))).window.document;
  const shortcuts = [...document.querySelectorAll(".co-create-hero-shortcuts button b")].map((label) => label.textContent?.trim());
  assert.deepEqual(shortcuts, ["活动协作", "项目共创", "校园连接", "资源协作"]);
});

test("co-create participation panel keeps only the three core actions", () => {
  const document = new JSDOM(renderToStaticMarkup(createElement(CoCreateSquare))).window.document;
  const panel = document.querySelector(".co-create-aside");
  assert.match(panel?.textContent ?? "", /发起共创/);
  assert.match(panel?.textContent ?? "", /寻找伙伴/);
  assert.match(panel?.textContent ?? "", /我的共创/);
  assert.equal(panel?.querySelectorAll("a").length, 3);
});

test("co-create keeps auxiliary copy out of shortcuts, metrics, and quick actions", () => {
  const document = new JSDOM(renderToStaticMarkup(createElement(CoCreateSquare))).window.document;
  assert.equal(document.querySelectorAll(".co-create-hero-shortcuts small").length, 0);
  assert.equal(document.querySelector(".co-create-metrics > span"), null);
  assert.equal(document.querySelector(".co-create-heading > small"), null);
  assert.equal(document.querySelectorAll(".co-create-aside a small").length, 0);
  assert.match(document.querySelector(".co-create-hero-copy > p:not(.community-kicker)")?.textContent ?? "", /^发现正在发生的项目、活动和真实需求，找到你可以加入的位置。$/);
  assert.equal(document.querySelector(".co-create-heading"), null);
});

test("co-create keeps the hero focused on its message without CTA buttons", () => {
  const hero = new JSDOM(renderToStaticMarkup(createElement(CoCreateSquare))).window.document;
  assert.equal(hero.querySelectorAll(".co-create-hero-copy a").length, 0);
  assert.equal(hero.querySelectorAll(".co-create-aside a").length, 3);
});

test("co-create omits the experience filter and offsets the desktop hero toward the routes", () => {
  const document = new JSDOM(renderToStaticMarkup(createElement(CoCreateSquare))).window.document;
  const css = readFileSync("app/globals.css", "utf8");
  assert.doesNotMatch(document.querySelector(".co-create-filters")?.textContent ?? "", /新手友好|需要经验/);
  assert.match(css, /\.co-create-hero-copy\{[^}]*transform:translateX\(124px\)/);
  assert.match(css, /\.co-create-main\{[^}]*margin:-10px auto 0/);
});

test("co-create restores 50px to the quick panel while retaining its right edge", () => {
  const css = readFileSync("app/globals.css", "utf8");
  assert.match(css, /\/\* Compact quick panel preserves its right edge\. \*\//);
  assert.match(css, /\.co-create-layout\{[^}]*grid-template-columns:1032px 242px[^}]*margin-left:118px/);
  assert.match(css, /\.co-create-aside\{[^}]*width:242px[^}]*max-width:242px/);
});

test("co-create uses the same public square naming and four-category vocabulary throughout", () => {
  const document = new JSDOM(renderToStaticMarkup(createElement(CoCreateSquare))).window.document;
  assert.equal(document.querySelector(".community-kicker")?.textContent, "广州 AI 共创社 · 共创广场");
  assert.match(document.querySelector(".co-create-hero-copy > p:not(.community-kicker)")?.textContent ?? "", /^发现正在发生的项目、活动和真实需求，找到你可以加入的位置。$/);
  assert.equal(coCreateItems.find((item) => item.id === "tool-sharing")?.type, "活动协作");
  assert.equal(document.querySelector(".co-create-flow p"), null);
  assert.match(document.querySelector(".co-create-metrics")?.textContent ?? "", /参与高校/);
});

test("co-create uses fixed desktop geometry instead of stretching components across spare grid space", () => {
  const css = readFileSync("app/globals.css", "utf8");
  assert.match(css, /\/\* Fixed desktop geometry: stable component widths without auto-fill\. \*\//);
  assert.match(css, /\.co-create-top\{[^}]*grid-template-columns:620px 760px[^}]*column-gap:56px/);
  assert.match(css, /\.co-create-hero-shortcuts\{[^}]*width:720px[^}]*grid-template-columns:repeat\(2,344px\)/);
  assert.match(css, /\.co-create-metrics\{[^}]*width:720px[^}]*height:72px/);
  assert.match(css, /\.co-create-layout\{[^}]*grid-template-columns:1032px 320px[^}]*column-gap:28px/);
  assert.match(css, /\.co-create-list\{[^}]*grid-template-columns:repeat\(3,332px\)/);
  assert.match(css, /\.co-create-card\{[^}]*width:332px[^}]*height:auto[^}]*min-height:260px/);
  assert.match(css, /\.co-create-hero-copy\{[^}]*height:376px[^}]*justify-content:flex-start/);
});

test("co-create keeps hero, category routes, and activity data in one two-column top surface", () => {
  const document = new JSDOM(renderToStaticMarkup(createElement(CoCreateSquare))).window.document;
  const top = document.querySelector(".co-create-top");
  assert.ok(top?.querySelector(":scope > .co-create-hero"));
  assert.ok(top?.querySelector(":scope > .co-create-top-actions .co-create-hero-shortcuts"));
  assert.ok(top?.querySelector(":scope > .co-create-top-actions .co-create-metrics"));
  assert.equal(document.querySelector(".co-create-heading"), null);
  assert.ok(document.querySelector(".co-create-main > .co-create-layout > .co-create-opportunities > .co-create-filters"));
});
