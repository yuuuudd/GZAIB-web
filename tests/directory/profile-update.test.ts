import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ProfileEditor, simplifyVisibility } from "../../components/forms/ProfileEditor";
import {
  createProfileUpdateService,
  type OwnProfileUpdateContext,
  type ProfileUpdateRepository,
} from "../../features/directory/profile-update";

function context(overrides: Partial<OwnProfileUpdateContext> = {}): OwnProfileUpdateContext {
  return {
    userId: "owner-1", profileId: "profile-1", slug: "lin", schoolId: "school-old", publishStatus: "published",
    visibility: {
      nickname: "public", avatarUrl: "public", school: "public", city: "public", intro: "public", skills: "public",
      roles: "public", verifiedBuilder: "public", contributions: "public", currentFocus: "members", canOffer: "members",
      wantsToMeet: "members", workLinks: "members", major: "members", grade: "private",
    },
    ...overrides,
  };
}

function memoryRepository(initial = context()) {
  const writes: Parameters<ProfileUpdateRepository["applyOwnUpdateAtomic"]>[0][] = [];
  const repository: ProfileUpdateRepository = {
    getOwnUpdateContext: async (userId) => initial.userId === userId ? initial : undefined,
    isConfirmedSchool: async (schoolId) => schoolId === "school-new",
    applyOwnUpdateAtomic: async (input) => { writes.push(input); return { updated: true }; },
  };
  return { repository, writes };
}

test("two-level privacy settings convert legacy member-only fields to private", () => {
  assert.deepEqual(simplifyVisibility({ nickname: "public", currentFocus: "members", grade: "private" }), {
    nickname: "public", currentFocus: "private", grade: "private",
  });
});

test("owner can update allowlisted fields while identity, slug, status, and unknown claims are forbidden", async () => {
  const store = memoryRepository();
  const service = createProfileUpdateService(store.repository);
  await service.updateOwnProfile("owner-1", "owner-1", { intro: "新的校园共建方向介绍，长度满足公开资料要求。", canOffer: "产品评审" }, 1_000);
  assert.deepEqual(store.writes[0]?.profilePatch, { intro: "新的校园共建方向介绍，长度满足公开资料要求。", canOffer: "产品评审" });

  await assert.rejects(() => service.updateOwnProfile("owner-1", "other-user", { intro: "尝试修改其他成员资料，必须被所有权边界拒绝。" }, 1_001), /forbidden/i);
  await assert.rejects(() => service.updateOwnProfile("owner-1", "owner-1", { slug: "changed" } as never, 1_002), /forbidden/i);
  await assert.rejects(() => service.updateOwnProfile("owner-1", "owner-1", { userId: "other-user" } as never, 1_003), /forbidden/i);
});

test("owner can select a normalized avatar key created for their own account", async () => {
  const store = memoryRepository();
  const service = createProfileUpdateService(store.repository);
  const avatarKey = "avatars/owner-1/123e4567-e89b-42d3-a456-426614174000.webp";

  await service.updateOwnProfile("owner-1", "owner-1", { avatarKey }, 1_010);

  assert.equal(store.writes[0]?.profilePatch.avatarKey, avatarKey);
  assert.equal(store.writes[0]?.applicationPatch.avatarKey, avatarKey);
});

test("profile update rejects an otherwise valid avatar key owned by another account", async () => {
  const store = memoryRepository();
  const service = createProfileUpdateService(store.repository);

  await assert.rejects(
    () => service.updateOwnProfile("owner-1", "owner-1", {
      avatarKey: "avatars/other-owner/123e4567-e89b-42d3-a456-426614174000.webp",
    }, 1_011),
    /avatar owner/i,
  );
  assert.equal(store.writes.length, 0);
});

test("published map-required fields cannot become private until the profile is explicitly hidden", async () => {
  const store = memoryRepository();
  const service = createProfileUpdateService(store.repository);
  await assert.rejects(
    () => service.updateOwnProfile("owner-1", "owner-1", { visibility: { intro: "private" } }, 1_000),
    /隐藏.*地图资料/,
  );
  assert.equal(store.writes.length, 0);

  await service.updateOwnProfile("owner-1", "owner-1", {
    mapVisibility: "hidden", visibility: { intro: "private" },
  }, 1_001);
  assert.equal(store.writes[0]?.publishStatus, "unpublished");
  assert.equal(store.writes[0]?.visibility.intro, "private");
});

test("school change keeps the approved profile published at its prior school and stores only the proposal for review", async () => {
  const store = memoryRepository();
  const service = createProfileUpdateService(store.repository);
  await service.updateOwnProfile("owner-1", "owner-1", { schoolId: "school-new" }, 2_000);

  assert.equal(store.writes[0]?.profilePatch.schoolId, undefined);
  assert.equal(store.writes[0]?.publishStatus, "published");
  assert.deepEqual(store.writes[0]?.applicationPatch, { schoolId: "school-new", status: "pending" });
  assert.equal(store.writes[0]?.slug, "lin");
});

test("school proposal rejects unknown or unconfirmed schools", async () => {
  const service = createProfileUpdateService(memoryRepository().repository);
  await assert.rejects(() => service.updateOwnProfile("owner-1", "owner-1", { schoolId: "unknown" }, 2_000), /school/i);
});

test("visibility and public profile updates are committed in one immediate write", async () => {
  const store = memoryRepository();
  const service = createProfileUpdateService(store.repository);
  await service.updateOwnProfile("owner-1", "owner-1", {
    currentFocus: "新的校园 AI 项目", visibility: { currentFocus: "public" }, mapVisibility: "shown",
  }, 3_000);
  assert.equal(store.writes.length, 1);
  assert.equal(store.writes[0]?.visibility.currentFocus, "public");
  assert.equal(store.writes[0]?.profilePatch.currentFocus, "新的校园 AI 项目");
  assert.equal(store.writes[0]?.publishStatus, "published");
});

test("member center groups profile controls into four focused settings tabs", () => {
  const html = renderToStaticMarkup(createElement(ProfileEditor, {
    profile: { slug: "lin", nickname: "林同学", school: "中山大学", city: "广州", intro: "正在探索 AI 如何帮助校园里的真实协作。", skills: ["产品设计"], roles: ["活动共建者"], verifiedBuilder: true, contributions: [] },
    visibility: context().visibility,
    schools: [{ id: "school-old", name: "中山大学", campus: "主校区", city: "广州" }],
    currentSchoolId: "school-old",
    published: true,
  }));
  assert.match(html, /role="tablist"/);
  assert.match(html, />个人资料<\/button>/);
  assert.match(html, />联系方式与链接<\/button>/);
  assert.match(html, />展示与隐私<\/button>/);
  assert.match(html, />账号设置<\/button>/);
  assert.match(html, /aria-selected="true"[^>]*>个人资料/);
  assert.match(html, /预览公开主页/);
  assert.match(html, /已在共建地图展示/);
  assert.match(html, /我正在做什么/);
  assert.match(html, /联系方式只会在双方接受连接后交换/);
  assert.match(html, /在共建地图中展示我的资料/);
  assert.match(html, /删除我的账号/);
  assert.match(html, /地图展示期间，这些资料会保持公开/);
  assert.match(html, /name="schoolId"/);
  assert.match(html, /更换头像/);
  assert.match(html, /type="file"/);
  assert.doesNotMatch(html, /member-hub-actions/);
  assert.doesNotMatch(html, /保存资料与公开设置/);
  const contactPanel = html.slice(html.indexOf('id="settings-contact"'), html.indexOf('id="settings-privacy"'));
  assert.match(contactPanel, />保存更改<\/button>/);
  assert.doesNotMatch(contactPanel, /保存联系方式|保存链接/);
  assert.match(html, /<input(?=[^>]*aria-label="昵称公开范围")(?=[^>]*disabled)[^>]*type="checkbox"/);

  const hiddenHtml = renderToStaticMarkup(createElement(ProfileEditor, {
    profile: { slug: "lin", nickname: "林同学", school: "中山大学", city: "广州", intro: "正在探索 AI 如何帮助校园里的真实协作。", skills: ["产品设计"], roles: ["活动共建者"], verifiedBuilder: true, contributions: [] },
    visibility: { ...context().visibility, nickname: "private" },
    schools: [{ id: "school-old", name: "中山大学", campus: "主校区", city: "广州" }],
    currentSchoolId: "school-old",
    published: false,
  }));
  assert.match(hiddenHtml, /aria-label="昵称公开范围"/);
  assert.doesNotMatch(hiddenHtml, /<input(?=[^>]*aria-label="昵称公开范围")(?=[^>]*disabled)[^>]*type="checkbox"/);
});
