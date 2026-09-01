import assert from "node:assert/strict";
import test from "node:test";
import {
  validateClaimInput,
  validateCommunityProfileInput,
  validateUpdateInput,
} from "../../features/communities/validation";

function valid(overrides: Record<string, unknown> = {}) {
  return {
    name: "广州 AI 产品社群",
    summary: "面向广州创作者的 AI 产品交流与实践社群。",
    primaryCity: "广州",
    locationMode: "city",
    focusTags: ["Agent", "产品"],
    officialUrl: "https://example.com/community",
    sourceUrl: "https://example.com/source",
    sourceLabel: "官方社区页面",
    ...overrides,
  };
}

test("online communities reject a city while city and hybrid require one", () => {
  assert.throws(() => validateCommunityProfileInput(valid({ locationMode: "online", primaryCity: "广州" })), /线上社群/);
  assert.throws(() => validateCommunityProfileInput(valid({ locationMode: "city", primaryCity: "" })), /主要城市/);
  assert.equal(validateCommunityProfileInput(valid({ locationMode: "online", primaryCity: null })).primaryCity, null);
});

test("community URLs must be https and input keys are allowlisted", () => {
  assert.throws(() => validateCommunityProfileInput(valid({ officialUrl: "http://example.com" })), /HTTPS/);
  assert.throws(() => validateCommunityProfileInput({ ...valid(), submitterUserId: "forged" }), /字段/);
  assert.throws(() => validateCommunityProfileInput(valid({ officialUrl: "https://user:pass@example.com" })), /凭据|HTTPS/);
});

test("normalizes unique focus tags and enforces concise copy", () => {
  const result = validateCommunityProfileInput(valid({ focusTags: ["Agent", " Agent ", "产品"] }));
  assert.deepEqual(result.focusTags, ["Agent", "产品"]);
  assert.throws(() => validateCommunityProfileInput(valid({ focusTags: Array.from({ length: 9 }, (_, i) => `标签${i}`) })), /标签/);
  assert.equal(validateCommunityProfileInput(valid({ name: " ＡＩ 社群 " })).name, "AI 社群");
});

test("claim and update inputs are normalized, allowlisted, and constrained", () => {
  assert.deepEqual(validateClaimInput({ communityId: " c-1 ", evidence: " 这是足够长的证明材料，用于说明申请人与社群的关系。 ", evidenceUrl: "https://example.com/evidence" }), {
    communityId: "c-1", evidence: "这是足够长的证明材料,用于说明申请人与社群的关系。", evidenceUrl: "https://example.com/evidence",
  });
  assert.throws(() => validateClaimInput({ communityId: "c-1", evidence: "证明", forged: true }), /字段/);
  assert.throws(() => validateClaimInput({ communityId: "c-1", evidence: "这是足够长的证明材料，用于说明申请人与社群的关系。", evidenceUrl: "http://example.com" }), /HTTPS/);
  assert.deepEqual(validateUpdateInput({ communityId: " c-1 ", title: " 更新标题 ", summary: "这是一段符合要求的更新摘要内容。", occurredAt: 1_725_000_000_000 }), {
    communityId: "c-1", title: "更新标题", summary: "这是一段符合要求的更新摘要内容。", occurredAt: 1_725_000_000_000,
  });
  assert.throws(() => validateUpdateInput({ communityId: "c-1", title: "更新标题", summary: "太短", occurredAt: 0 }), /摘要|时间/);
});
