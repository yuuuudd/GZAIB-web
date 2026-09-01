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

test("member application offers AMap school search before choosing a school", () => {
  const html = renderToStaticMarkup(createElement(ApplicationForm, { schools: [] }));

  assert.match(html, /搜索高德学校/);
  assert.match(html, /先查看地点和周边地图/);
  assert.doesNotMatch(html, /坐标确认|确认坐标|已由管理员确认/);
});

test("member application keeps only identity, school, intro, skills, and consent in the main flow", () => {
  const html = renderToStaticMarkup(createElement(ApplicationForm, { schools: [] }));

  assert.match(html, /统一极简申请/);
  assert.match(html, /技能点（选择 1–3 项）/);
  assert.match(html, /<details[^>]*class="application-optional"/);
  assert.match(html, /更多资料（全部选填）/);
  assert.doesNotMatch(html, /01 \/ 身份|02 \/ 学校|03 \/ 方向|04 \/ 参与|05 \/ 作品/);
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
