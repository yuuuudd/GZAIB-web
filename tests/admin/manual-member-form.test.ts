import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ManualMemberForm, saveManualMember } from "../../components/admin/ManualMemberForm";

test("manual member form offers draft and publish options but never requests a login email", () => {
  const html = renderToStaticMarkup(createElement(ManualMemberForm, { schools: [] }));
  assert.match(html, /保存为草稿/);
  assert.match(html, /确认发布到地图/);
  assert.doesNotMatch(html, /登录邮箱/);
  assert.doesNotMatch(html, /name="email"/);
});

test("manual member form provides an in-place school search rather than requiring a separate page", () => {
  const html = renderToStaticMarkup(createElement(ManualMemberForm, { schools: [], amapKey: "test-key" }));
  assert.match(html, /搜索高德学校/);
});

test("manual member form constrains skills and roles to values accepted by the API", () => {
  const html = renderToStaticMarkup(createElement(ManualMemberForm, { schools: [] }));

  assert.match(html, /type="checkbox" name="skills" value="AI应用"/);
  assert.match(html, /type="checkbox" name="skills" value="机器学习"/);
  assert.match(html, /type="checkbox" name="roles" value="活动共建者"/);
  assert.match(html, /type="checkbox" name="roles" value="校园连接者"/);
  assert.doesNotMatch(html, /<input name="skills"/);
  assert.doesNotMatch(html, /<input name="roles"/);
});

test("manual member form resets the captured form after an asynchronous save", async () => {
  const formData = new FormData();
  formData.set("nickname", "测试成员");
  formData.set("schoolId", "school-1");
  formData.set("intro", "这是一段符合长度要求的成员介绍");
  formData.append("skills", "AI应用");
  formData.set("interests", "校园共建");
  formData.append("roles", "活动共建者");
  formData.set("publication", "draft");
  let resetCount = 0;
  let message = "";

  await saveManualMember({
    formElement: { reset: () => { resetCount += 1; } },
    formData,
    request: async () => new Response(JSON.stringify({ slug: "test-member" }), {
      status: 201,
      headers: { "content-type": "application/json" },
    }),
    setMessage: (value) => { message = value; },
    setPending: () => undefined,
    clearSelectedSchool: () => undefined,
  });

  assert.equal(resetCount, 1);
  assert.equal(message, "已保存。成员资料地址：/members/test-member");
});
