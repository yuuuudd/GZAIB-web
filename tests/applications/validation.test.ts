import assert from "node:assert/strict";
import test from "node:test";
import { CONSENT_VERSION, validateApplication } from "../../features/applications/validation";

const validInput = {
  nickname: "林同学",
  schoolId: "school-1",
  intro: "正在探索 AI 如何帮助校园里的真实协作。",
  currentFocus: "为学生社群制作好用的 AI 工具",
  canOffer: "产品原型评审",
  wantsToMeet: "关心教育创新的伙伴",
  skills: ["产品设计", "AI应用"],
  interests: ["教育创新"],
  roles: ["活动共建者"],
  workLinks: ["https://example.com/lin"],
  visibility: { currentFocus: "members", canOffer: "private" },
  consentAccepted: true,
  consentVersion: CONSENT_VERSION,
};

test("accepts a complete application with allowlisted profile choices", () => {
  assert.deepEqual(validateApplication(validInput), { ok: true, value: validInput });
});

test("rejects an application without a school or explicit current consent", () => {
  assert.equal(validateApplication({ ...validInput, schoolId: "" }).ok, false);
  assert.equal(validateApplication({ ...validInput, consentAccepted: false }).ok, false);
  assert.equal(validateApplication({ ...validInput, consentVersion: "old-version" }).ok, false);
});

test("rejects invalid public data instead of accepting a client-controlled profile", () => {
  assert.equal(validateApplication({ ...validInput, nickname: "林" }).ok, false);
  assert.equal(validateApplication({ ...validInput, intro: "太短" }).ok, false);
  assert.equal(validateApplication({ ...validInput, workLinks: ["http://example.com"] }).ok, false);
  assert.equal(validateApplication({ ...validInput, skills: ["不存在的技能"] }).ok, false);
  assert.equal(validateApplication({ ...validInput, roles: ["管理员"] }).ok, false);
  assert.equal(validateApplication({ ...validInput, visibility: { currentFocus: "team" } }).ok, false);
});
