import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ApplicationForm } from "../../components/forms/ApplicationForm";

test("keeps visibility choices out of the application flow and defers them to account settings", () => {
  const html = renderToStaticMarkup(createElement(ApplicationForm, { schools: [] }));

  assert.doesNotMatch(html, /06 \/ 公开范围/);
  assert.doesNotMatch(html, /visibility-field/);
  assert.match(html, /审核通过后可在账号设置中调整资料公开范围/);
});
