import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ActivityProposalForm } from "../../components/activities/ActivityProposalForm";
import { validateActivityProposal } from "../../features/activities/proposals";

const valid = {
  title: "校园 AI 共创工作坊",
  summary: "邀请不同专业的同学一起完成一个可演示的 AI 应用原型。",
  stage: "idea",
  timeNote: "九月下旬周末",
  location: "广州大学城",
  supportNeeded: "希望连接场地和技术导师",
  links: ["https://example.com/plan"],
};

test("activity proposal accepts the minimum useful private submission", () => {
  assert.deepEqual(validateActivityProposal(valid), { ok: true, value: valid });
});

test("activity proposal rejects missing essentials and unsafe links", () => {
  assert.equal(validateActivityProposal({ ...valid, title: "" }).ok, false);
  assert.equal(validateActivityProposal({ ...valid, summary: "太短" }).ok, false);
  assert.equal(validateActivityProposal({ ...valid, stage: "published" }).ok, false);
  assert.equal(validateActivityProposal({ ...valid, links: ["http://example.com"] }).ok, false);
});

test("activity proposal form keeps contact account-owned and optional details optional", () => {
  const html = renderToStaticMarkup(createElement(ActivityProposalForm));

  assert.match(html, /申请共建活动/);
  assert.match(html, /账号邮箱作为默认联系方式/);
  assert.doesNotMatch(html, /name="contactEmail"/);
  assert.match(html, /name="timeNote"/);
  assert.doesNotMatch(html, /name="timeNote"[^>]*required/);
});
