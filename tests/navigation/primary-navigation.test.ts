import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { PrimaryNavigation } from "../../components/navigation/PrimaryNavigation";

test("primary navigation uses browser-native links for the home and application routes", () => {
  const html = renderToStaticMarkup(createElement(PrimaryNavigation));

  assert.match(html, /<a href="\/">共建地图<\/a>/);
  assert.match(html, /<a href="\/apply">申请点亮<\/a>/);
});
