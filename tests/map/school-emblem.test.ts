import assert from "node:assert/strict";
import test from "node:test";
import { existsSync } from "node:fs";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
// @ts-expect-error The project runs jsdom without its optional type package.
import { JSDOM } from "jsdom";
import { renderToStaticMarkup } from "react-dom/server";
import { SchoolDirectoryFallback } from "../../components/map/SchoolDirectoryFallback";
import { SchoolEmblem } from "../../components/map/SchoolEmblem";
import type { DirectorySchool } from "../../features/directory/service";

test("school list matches campus names to their own emblems without borrowing a similarly named school's logo", () => {
  const names = ["中山大学(广州校区南校园)", "华南理工大学（五山校区）", "哈尔滨工业大学(深圳校区)", "韩山师范学院", "岭南师范学院(寸金校区)", "南方科技大学", "上海交通大学(闵行本部校区)", "武汉大学", "中山大学新华学院", "新学校"];
  const schools: DirectorySchool[] = names.map((name, i) => ({ id: String(i), name, campus: "主校区", province: "广东", city: "广州", lng: 113, lat: 23, memberCount: 1, previewMembers: [] }));
  const html = renderToStaticMarkup(createElement(SchoolDirectoryFallback, { schools, onSelect() {} }));
  const images = [...html.matchAll(/<img\b[^>]*src="([^"]+)"/g)].map((match) => match[1]);
  assert.deepEqual(images, ["sysu.png", "scut.png", "hit.png", "hanshan.png", "lingnan.jpg", "sustech.png", "sjtu.png", "whu.png"].map((file) => `/school-emblems/${file}`));
  for (const src of images) assert.ok(existsSync(`public${src}`), `Missing emblem asset: ${src}`);
  assert.match(html, /school-list-badge[^>]*>中<\/span>/);
  assert.match(html, /school-list-badge[^>]*>新<\/span>/);
});

test("a failed emblem falls back to the school initial and another school can still display its emblem", async () => {
  const dom = new JSDOM('<div id="root"></div>');
  Object.assign(globalThis, { window: dom.window, document: dom.window.document, IS_REACT_ACT_ENVIRONMENT: true });
  const root = createRoot(document.querySelector("#root")!);
  try {
    await act(async () => root.render(createElement(SchoolEmblem, { name: "中山大学", className: "school-list-badge" })));
    await act(async () => document.querySelector("img")!.dispatchEvent(new dom.window.Event("error")));
    assert.equal(document.querySelector("img"), null);
    assert.equal(document.querySelector(".school-list-badge")?.textContent, "中");
    await act(async () => root.render(createElement(SchoolEmblem, { name: "华南理工大学", className: "school-list-badge" })));
    assert.equal(document.querySelector("img")?.getAttribute("src"), "/school-emblems/scut.png");
  } finally {
    await act(async () => root.unmount());
    dom.window.close();
  }
});
