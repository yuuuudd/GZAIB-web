import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ManualMemberForm } from "../../components/admin/ManualMemberForm";

test("manual member form offers draft and publish options but never requests a login email", () => {
  const html = renderToStaticMarkup(createElement(ManualMemberForm, { schools: [] }));
  assert.match(html, /保存为草稿/);
  assert.match(html, /确认发布到地图/);
  assert.doesNotMatch(html, /登录邮箱/);
  assert.doesNotMatch(html, /name="email"/);
});
