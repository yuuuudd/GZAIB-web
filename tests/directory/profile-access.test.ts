import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemberProfile } from "../../components/directory/MemberProfile";
import {
  createProfileAccessService,
  deriveProfileViewer,
  type ProfileAccessCandidate,
  type ProfileAccessRepository,
} from "../../features/directory/profile-access";
import type { Viewer } from "../../features/directory/types";
import type { Session } from "../../features/identity/types";

function candidate(overrides: Partial<ProfileAccessCandidate> = {}): ProfileAccessCandidate {
  return {
    accountStatus: "active",
    applicationStatus: "approved",
    publishStatus: "published",
    profile: {
      id: "profile-1", userId: "owner-1", slug: "lin", nickname: "林同学", school: "中山大学", city: "广州",
      intro: "正在探索 AI 如何帮助校园里的真实协作。", skills: ["产品设计"], roles: ["活动共建者"],
      verifiedBuilder: true,
      contributions: [{ id: "c1", title: "校园 AI 共创夜", activityDate: 1_780_000_000_000, role: "活动主理", outcome: "完成原型", publicSummary: "共同完成校园服务原型。" }],
      currentFocus: "校园知识库", canOffer: "产品原型评审", wantsToMeet: "教育创新者", grade: "大三",
      loginEmail: "private@example.test", reviewNotes: "private",
    },
    visibility: {
      nickname: "public", school: "public", city: "public", intro: "public", skills: "public", roles: "public",
      verifiedBuilder: "public", contributions: "public", currentFocus: "members", canOffer: "members",
      wantsToMeet: "members", grade: "private",
    },
    ...overrides,
  };
}

function memoryRepository(initial = candidate()) {
  let current = initial;
  const requestedSlugs: string[] = [];
  const repository: ProfileAccessRepository = {
    findBySlug: async (slug) => {
      requestedSlugs.push(slug);
      return current.profile.slug === slug ? current : undefined;
    },
    findByUserId: async (userId) => current.profile.userId === userId ? current : undefined,
  };
  return { repository, requestedSlugs, replace: (next: ProfileAccessCandidate) => { current = next; } };
}

test("visitor receives only public ProjectedProfile fields while an approved member receives member fields", async () => {
  const store = memoryRepository();
  const service = createProfileAccessService(store.repository);
  const visitor = await service.getProfile("lin", { kind: "visitor" });
  const member = await service.getProfile("lin", { kind: "member", userId: "member-2" });

  assert.equal(visitor?.canOffer, undefined);
  assert.equal(member?.canOffer, "产品原型评审");
  assert.equal(member?.grade, undefined);
  assert.equal("loginEmail" in (member ?? {}), false);
  assert.equal("reviewNotes" in (member ?? {}), false);
  assert.equal(member?.contributions?.[0]?.title, "校园 AI 共创夜");
});

test("owner receives all allowlisted editable fields without raw private account data", async () => {
  const service = createProfileAccessService(memoryRepository().repository);
  const owner = await service.getOwnProfile("owner-1");
  assert.equal(owner?.grade, "大三");
  assert.equal(owner?.canOffer, "产品原型评审");
  assert.equal("loginEmail" in (owner ?? {}), false);
});

test("hidden, unpublished, and inactive profiles are absent from public slug lookup", async () => {
  for (const hidden of [
    candidate({ publishStatus: "unpublished" }),
    candidate({ accountStatus: "hidden" }),
    candidate({ accountStatus: "suspended" }),
    candidate({ accountStatus: "deleted" }),
  ]) {
    const service = createProfileAccessService(memoryRepository(hidden).repository);
    assert.equal(await service.getProfile("lin", { kind: "visitor" }), undefined);
  }
});

test("connection suspension does not hide an otherwise published slug profile", async () => {
  const service = createProfileAccessService(memoryRepository(candidate({ accountStatus: "connection_suspended" })).repository);

  const profile = await service.getProfile("lin", { kind: "visitor" });

  assert.equal(profile?.slug, "lin");
  assert.equal(profile?.nickname, "林同学");
});

test("a pending school-change review keeps the previously approved profile public at its prior school", async () => {
  const service = createProfileAccessService(memoryRepository(candidate({ applicationStatus: "pending" })).repository);
  const profile = await service.getProfile("lin", { kind: "visitor" });
  assert.equal(profile?.school, "中山大学");
  assert.equal(profile?.nickname, "林同学");
});

test("stable slug lookup is exact and a visibility change affects the next query immediately", async () => {
  const store = memoryRepository();
  const service = createProfileAccessService(store.repository);
  assert.equal((await service.getProfile("lin", { kind: "member", userId: "member-2" }))?.canOffer, "产品原型评审");

  store.replace(candidate({ visibility: { ...candidate().visibility, canOffer: "private" } }));
  assert.equal((await service.getProfile("lin", { kind: "member", userId: "member-2" }))?.canOffer, undefined);
  assert.equal(await service.getProfile("lin-old", { kind: "visitor" }), undefined);
  assert.deepEqual(store.requestedSlugs, ["lin", "lin", "lin-old"]);
});

test("a member viewer must be server-derived and never supplied through profile input", async () => {
  const service = createProfileAccessService(memoryRepository().repository);
  const viewers: Viewer[] = [{ kind: "visitor" }, { kind: "member", userId: "member-2" }];
  assert.equal((await service.getProfile("lin", viewers[0]!))?.canOffer, undefined);
  assert.equal((await service.getProfile("lin", viewers[1]!))?.canOffer, "产品原型评审");
});

test("server viewer derivation grants member projection only to approved members", async () => {
  const memberSession: Session = { identity: { id: "demo-member", role: "member", displayName: "演示共建者" }, expiresAt: 9_999 };
  const adminSession: Session = { identity: { id: "demo-admin", role: "admin", displayName: "演示运营员" }, expiresAt: 9_999 };
  assert.deepEqual(await deriveProfileViewer(undefined, async () => false), { kind: "visitor" });
  assert.deepEqual(await deriveProfileViewer(memberSession, async () => false), { kind: "visitor" });
  assert.deepEqual(await deriveProfileViewer(memberSession, async () => true), { kind: "member", userId: "demo-member" });
  assert.deepEqual(await deriveProfileViewer(adminSession, async () => false), { kind: "admin", userId: "demo-admin" });
});

test("member profile renders a visitor-safe connection CTA without exposing a contact card", () => {
  const profile = candidate().profile;
  const projected = {
    slug: profile.slug, nickname: profile.nickname, school: profile.school, city: profile.city, intro: profile.intro,
    skills: profile.skills, roles: profile.roles, verifiedBuilder: profile.verifiedBuilder, contributions: profile.contributions,
    currentFocus: profile.currentFocus, canOffer: profile.canOffer, wantsToMeet: profile.wantsToMeet,
  };
  const html = renderToStaticMarkup(createElement(MemberProfile, { profile: projected }));
  assert.match(html, /认证共建者/);
  assert.match(html, /校园 AI 共创夜/);
  assert.match(html, /审核成员可发起连接/);
  assert.match(html, /href="\/apply"/);
  assert.match(html, /审核通过的成员可以发起连接/);
  assert.doesNotMatch(html, /微信号|@example\.com/);
});
