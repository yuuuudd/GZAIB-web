import assert from "node:assert/strict";
import test from "node:test";
import { createElement, type ComponentType } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { AmapNamespace } from "../../components/map/AmapLoader";

test("selected school renders a reusable AMap preview before confirmation", async () => {
  const module = await import("../../components/map/AmapLoader");
  const Preview = (module as Record<string, unknown>).AmapLocationPreview;

  assert.equal(typeof Preview, "function", "AmapLocationPreview should be exported");

  const html = renderToStaticMarkup(createElement(Preview as ComponentType<Record<string, unknown>>, {
    amap: {} as AmapNamespace,
    location: {
      name: "华南理工大学（五山校区）",
      city: "广州市",
      district: "天河区",
      address: "五山路381号",
      longitude: 113_349_000,
      latitude: 23_152_000,
    },
    onConfirm: () => undefined,
    onBack: () => undefined,
  }));

  assert.match(html, /aria-label="华南理工大学（五山校区）周边地图"/);
  assert.match(html, /天河区/);
  assert.match(html, /五山路381号/);
  assert.match(html, /确认使用这个学校/);
  assert.match(html, /返回搜索结果/);
});
