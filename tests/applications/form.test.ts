import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ApplicationForm } from "../../components/forms/ApplicationForm";

test("keeps visibility choices out of the application flow", () => {
  const html = renderToStaticMarkup(createElement(ApplicationForm, { schools: [] }));

  assert.doesNotMatch(html, /06 \/ 公开范围/);
  assert.doesNotMatch(html, /visibility-field/);
  assert.match(html, /通过审核后，随时可以在「我的」继续完善/);
});

test("member application keeps AMap school search available without expanding the main form", () => {
  const html = renderToStaticMarkup(createElement(ApplicationForm, { schools: [] }));

  assert.match(html, /找不到学校 \/ 校区？搜索地图/);
  assert.doesNotMatch(html, /坐标确认|确认坐标|已由管理员确认/);
});

test("school choices do not repeat a campus identical to the school name", () => {
  const html = renderToStaticMarkup(createElement(ApplicationForm, { schools: [{
    id: "school-1", name: "中山大学(广州校区南校园)", campus: "中山大学(广州校区南校园)", city: "广州",
  }] }));

  assert.match(html, /中山大学\(广州校区南校园\) · 广州/);
  assert.doesNotMatch(html, /中山大学\(广州校区南校园\) · 中山大学\(广州校区南校园\)/);
});

test("member application uses the three compact sections and requires one of four default avatars or an upload", () => {
  const html = renderToStaticMarkup(createElement(ApplicationForm, { schools: [] }));

  assert.match(html, /01 基本身份/);
  assert.match(html, /02 让大家认识你/);
  assert.match(html, /03 审核与提交/);
  assert.match(html, /技能点（选择 1–3 项）/);
  assert.match(html, /一句话介绍（10–50 字）/);
  for (const avatar of ["avatar-yellow", "avatar-cow", "avatar-cat", "avatar-kangaroo"]) {
    assert.match(html, new RegExp(`/brand/${avatar}\\.png`));
  }
  assert.doesNotMatch(html, /更多资料（全部选填）|专业|年级|我正在做什么|我能提供什么|我希望认识谁|感兴趣的方向|参与角色|作品链接/);
});

test("member application collects a private contact method before review", () => {
  const html = renderToStaticMarkup(createElement(ApplicationForm, { schools: [], initialContact: { email: "member@example.com", wechat: "gzaib-member" } }));

  assert.match(html, /联系方式（至少填写一种）/);
  assert.match(html, /name="wechat"/);
  assert.match(html, /name="email"[^>]*value="member@example.com"/);
  assert.match(html, /name="wechat"[^>]*value="gzaib-member"/);
  assert.match(html, /name="otherContact"/);
  assert.match(html, /不会公开展示，仅在双方接受连接后交换/);
});

test("AMap results can select only a matching confirmed school", async () => {
  const module = await import("../../components/forms/ApplicationForm");
  const matchConfirmedSchool = (module as Record<string, unknown>).matchConfirmedSchool;
  assert.equal(typeof matchConfirmedSchool, "function", "matchConfirmedSchool should be exported");

  const schools = [
    { id: "scut-wushan", name: "华南理工大学", campus: "五山校区", city: "广州" },
    { id: "scut-university-town", name: "华南理工大学", campus: "大学城校区", city: "广州" },
  ];
  const match = (matchConfirmedSchool as (name: string, options: typeof schools) => { id: string } | undefined)("华南理工大学(五山校区)", schools);

  assert.equal(match?.id, "scut-wushan");
  assert.equal((matchConfirmedSchool as (name: string, options: typeof schools) => unknown)("未知学院", schools), undefined);
});
