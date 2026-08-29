import assert from "node:assert/strict";
import test from "node:test";
import { projectProfile } from "../../features/directory/public-profile";
import type { MemberProfileRecord, VisibilityRules } from "../../features/directory/types";

const profile: MemberProfileRecord = {
  id: "profile-1",
  userId: "user-1",
  slug: "lin-tong-xue",
  nickname: "林同学",
  avatarUrl: "/avatars/lin.webp",
  school: "中山大学",
  city: "广州",
  intro: "关注 AI 产品与教育",
  skills: ["产品设计", "AI应用"],
  roles: ["活动共建者"],
  verifiedBuilder: true,
  contributions: [],
  currentFocus: "为学生社群制作 AI 工具",
  canOffer: "产品原型评审",
  wantsToMeet: "教育创新者",
  workLinks: ["https://example.com/lin"],
  major: "传播学",
  grade: "大三",
  loginEmail: "lin@example.com",
  reviewNotes: "审核通过，联系方式只供本人使用",
  wechat: "lin-private",
  contactCard: { email: "lin@example.com", wechat: "lin-private" },
};

const rules: VisibilityRules = {
  nickname: "public",
  avatarUrl: "public",
  school: "public",
  city: "public",
  intro: "public",
  skills: "public",
  roles: "public",
  verifiedBuilder: "public",
  contributions: "public",
  currentFocus: "members",
  canOffer: "members",
  wantsToMeet: "members",
  workLinks: "members",
  major: "members",
  grade: "private",
};

const visitorProfile = {
  slug: "lin-tong-xue",
  nickname: "林同学",
  avatarUrl: "/avatars/lin.webp",
  school: "中山大学",
  city: "广州",
  intro: "关注 AI 产品与教育",
  skills: ["产品设计", "AI应用"],
  roles: ["活动共建者"],
  verifiedBuilder: true,
  contributions: [],
};

test("projects only public fields for a visitor", () => {
  assert.deepEqual(projectProfile(profile, rules, { kind: "visitor" }), visitorProfile);
});

test("includes member-visible fields for an approved member", () => {
  assert.deepEqual(projectProfile(profile, rules, { kind: "member", userId: "user-2" }), {
    ...visitorProfile,
    currentFocus: "为学生社群制作 AI 工具",
    canOffer: "产品原型评审",
    wantsToMeet: "教育创新者",
    workLinks: ["https://example.com/lin"],
    major: "传播学",
  });
});

test("allows admins to review every allowlisted profile field", () => {
  assert.deepEqual(projectProfile(profile, rules, { kind: "admin", userId: "admin-1" }), {
    ...visitorProfile,
    currentFocus: "为学生社群制作 AI 工具",
    canOffer: "产品原型评审",
    wantsToMeet: "教育创新者",
    workLinks: ["https://example.com/lin"],
    major: "传播学",
    grade: "大三",
  });
});

test("never serializes login, review, or private contact fields", () => {
  for (const viewer of [
    { kind: "visitor" as const },
    { kind: "member" as const, userId: "user-2" },
    { kind: "admin" as const, userId: "admin-1" },
  ]) {
    const projected = projectProfile(profile, rules, viewer);
    for (const forbidden of ["loginEmail", "reviewNotes", "wechat", "contactCard"]) {
      assert.equal(JSON.stringify(projected).includes(`\"${forbidden}\"`), false);
    }
  }
});
