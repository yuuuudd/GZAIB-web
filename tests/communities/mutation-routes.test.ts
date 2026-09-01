import assert from "node:assert/strict";
// @ts-expect-error The project intentionally runs jsdom without the optional @types/jsdom package.
import { JSDOM } from "jsdom";
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import test from "node:test";
import { handleCommunityClaim } from "../../app/api/community-claims/route";
import { handleCommunityFollow } from "../../app/api/community-follows/route";
import { handleCommunitySubmission } from "../../app/api/community-submissions/route";
import { handleCommunityUpdate } from "../../app/api/community-updates/route";
import { POST as postCommunityClaim } from "../../app/api/community-claims/route";
import { POST as postCommunityFollow } from "../../app/api/community-follows/route";
import { POST as postCommunitySubmission } from "../../app/api/community-submissions/route";
import { POST as postCommunityUpdate } from "../../app/api/community-updates/route";
import { CommunityActions } from "../../components/communities/CommunityActions";
import { CommunityProfile } from "../../components/communities/CommunityProfile";
import { CommunitySubmissionForm } from "../../components/communities/CommunitySubmissionForm";
import {
  createCommunityMutationService,
  type CommunityClaimRecord,
  type CommunityMutationRepository,
  type CommunityProfileSubmissionRecord,
  type CommunityUpdateRecord,
} from "../../features/communities/service";

const NOW = 1_780_000_000_000;

function validProfile(overrides: Record<string, unknown> = {}) {
  return {
    kind: "create",
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

function validClaim(overrides: Record<string, unknown> = {}) {
  return { communityId: "published", evidence: "这是足够长的证明材料，用于说明申请人与社群的真实关系。", evidenceUrl: "https://example.com/evidence", ...overrides };
}

function validUpdate(overrides: Record<string, unknown> = {}) {
  return { communityId: "published", title: "社群共创活动", summary: "这是一段符合要求的社群动态摘要内容。", occurredAt: NOW - 10_000, sourceUrl: "https://example.com/update", ...overrides };
}

function request(path: string, body: unknown, method = "POST") {
  return new Request(`https://site.test${path}`, { method, headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
}

function routeStore(options: { failClaimSave?: boolean } = {}) {
  const profiles: CommunityProfileSubmissionRecord[] = [];
  const claims: CommunityClaimRecord[] = [];
  const updates: CommunityUpdateRecord[] = [];
  const follows = new Map<string, { userId: string; communityId: string; createdAt: number }>();
  const repository: CommunityMutationRepository = {
    isPublishedCommunity: async (id) => id === "published",
    isManager: async (userId, communityId) => userId === "manager" && communityId === "published",
    hasPendingClaim: async (userId, communityId) => claims.some((claim) => claim.applicantUserId === userId && claim.communityId === communityId && claim.status === "pending"),
    saveProfileSubmission: async (record) => { profiles.push(record); },
    saveClaim: async (record) => { if (options.failClaimSave) throw new Error(`D1 failed: ${record.evidence}; reviewer=admin; other-user=member-9`); claims.push(record); return true; },
    saveUpdate: async (record) => { updates.push(record); },
    setFollow: async ({ userId, communityId, following, createdAt }) => {
      const key = `${userId}:${communityId}`;
      if (following) {
        if (!follows.has(key)) follows.set(key, { userId, communityId, createdAt });
      } else follows.delete(key);
    },
    listManagedCommunities: async () => [],
  };
  const service = createCommunityMutationService(repository, () => "server-uuid");
  const dependencies = { resolveUserId: async () => "member-1", service: async () => service, now: () => NOW };
  return { profiles, claims, updates, follows, dependencies };
}

test("server identity overrides any client attempt to forge the submitter", async () => {
  const store = routeStore();
  const response = await handleCommunitySubmission(request("/api/community-submissions", { ...validProfile(), submitterUserId: "admin" }), store.dependencies);

  assert.equal(response.status, 400);
  assert.equal(store.profiles.length, 0);
  assert.equal(JSON.stringify(await response.json()).includes("admin"), false);
});

test("all mutation routes authenticate before parsing or calling a service", async () => {
  let serviceCalls = 0;
  const dependencies = { resolveUserId: async () => null, service: async () => { serviceCalls += 1; throw new Error("must not load"); }, now: () => NOW };
  const invalidJson = (path: string) => new Request(`https://site.test${path}`, { method: "POST", body: "{" });

  for (const [handler, path] of [
    [handleCommunitySubmission, "/api/community-submissions"],
    [handleCommunityClaim, "/api/community-claims"],
    [handleCommunityUpdate, "/api/community-updates"],
    [handleCommunityFollow, "/api/community-follows"],
  ] as const) {
    const response = await handler(invalidJson(path), dependencies);
    assert.equal(response.status, 401);
  }
  assert.equal(serviceCalls, 0);
});

test("real demo-mode route adapters return 401 when the signed session cookie is absent", async () => {
  const previousDemoMode = process.env.DEMO_MODE;
  const previousSecret = process.env.DEMO_SESSION_SECRET;
  process.env.DEMO_MODE = "true";
  process.env.DEMO_SESSION_SECRET = "test-only-demo-session-secret";
  try {
    for (const [handler, path] of [
      [postCommunitySubmission, "/api/community-submissions"],
      [postCommunityClaim, "/api/community-claims"],
      [postCommunityUpdate, "/api/community-updates"],
      [postCommunityFollow, "/api/community-follows"],
    ] as const) {
      const response = await handler(new Request(`https://site.test${path}`, { method: "POST", body: "{" }));
      assert.equal(response.status, 401, path);
    }
  } finally {
    if (previousDemoMode === undefined) delete process.env.DEMO_MODE;
    else process.env.DEMO_MODE = previousDemoMode;
    if (previousSecret === undefined) delete process.env.DEMO_SESSION_SECRET;
    else process.env.DEMO_SESSION_SECRET = previousSecret;
  }
});

test("identity resolver failures return a generic 500 and safe log on every mutation route", async () => {
  let serviceCalls = 0;
  const secret = "identity-store-secret member-9";
  const dependencies = { resolveUserId: async () => { throw new Error(secret); }, service: async () => { serviceCalls += 1; throw new Error("must not load"); }, now: () => NOW };
  const originalError = console.error;
  const logs: unknown[][] = [];
  console.error = (...values: unknown[]) => { logs.push(values); };
  try {
    for (const [handler, path, body] of [
      [handleCommunitySubmission, "/api/community-submissions", validProfile()],
      [handleCommunityClaim, "/api/community-claims", validClaim()],
      [handleCommunityUpdate, "/api/community-updates", validUpdate()],
      [handleCommunityFollow, "/api/community-follows", { communityId: "published", following: true }],
    ] as const) {
      const response = await handler(request(path, body), dependencies);
      assert.equal(response.status, 500);
      const exposed = JSON.stringify(await response.json());
      assert.equal(exposed.includes("identity"), false);
      assert.equal(exposed.includes("member-9"), false);
    }
    assert.equal(serviceCalls, 0);
    assert.equal(logs.length, 4);
    const serializedLogs = JSON.stringify(logs);
    assert.equal(serializedLogs.includes(secret), false);
    assert.equal(serializedLogs.includes("member-9"), false);
  } finally {
    console.error = originalError;
  }
});

test("routes reject client-owned status, review, timestamp, publication and unknown fields", async () => {
  const profileStore = routeStore();
  const profile = await handleCommunitySubmission(request("/api/community-submissions", validProfile({ status: "approved", reviewedBy: "admin", submittedAt: 1, publishedAt: 1 })), profileStore.dependencies);
  assert.equal(profile.status, 400);
  assert.equal(profileStore.profiles.length, 0);

  const claimStore = routeStore();
  const claim = await handleCommunityClaim(request("/api/community-claims", validClaim({ applicantUserId: "admin", status: "approved", reviewedAt: 1 })), claimStore.dependencies);
  assert.equal(claim.status, 400);
  assert.equal(claimStore.claims.length, 0);

  const updateStore = routeStore();
  const update = await handleCommunityUpdate(request("/api/community-updates", validUpdate({ submitterUserId: "admin", status: "published", reviewedBy: "admin" })), { ...updateStore.dependencies, resolveUserId: async () => "manager" });
  assert.equal(update.status, 400);
  assert.equal(updateStore.updates.length, 0);

  const followStore = routeStore();
  const follow = await handleCommunityFollow(request("/api/community-follows", { communityId: "published", following: true, userId: "admin" }), followStore.dependencies);
  assert.equal(follow.status, 400);
  assert.equal(followStore.follows.size, 0);
});

test("successful routes expose only safe acknowledgements while persisting the resolved user", async () => {
  const profileStore = routeStore();
  const profile = await handleCommunitySubmission(request("/api/community-submissions", validProfile()), profileStore.dependencies);
  assert.equal(profile.status, 201);
  assert.equal(profileStore.profiles[0]?.submitterUserId, "member-1");
  assert.deepEqual(await profile.json(), { submission: { id: "server-uuid", kind: "create", communityId: null, status: "pending", submittedAt: NOW } });

  const claimStore = routeStore();
  const claim = await handleCommunityClaim(request("/api/community-claims", validClaim()), claimStore.dependencies);
  assert.equal(claim.status, 201);
  assert.equal(claimStore.claims[0]?.applicantUserId, "member-1");
  const claimBody = JSON.stringify(await claim.json());
  assert.equal(claimBody.includes("证明材料"), false);
  assert.equal(claimBody.includes("member-1"), false);
  assert.equal(claimBody.includes("review"), false);

  const updateStore = routeStore();
  const update = await handleCommunityUpdate(request("/api/community-updates", validUpdate()), { ...updateStore.dependencies, resolveUserId: async () => "manager" });
  assert.equal(update.status, 201);
  assert.equal(updateStore.updates[0]?.submitterUserId, "manager");
  assert.deepEqual(await update.json(), { update: { id: "server-uuid", communityId: "published", status: "pending", submittedAt: NOW } });

  const followStore = routeStore();
  const follow = await handleCommunityFollow(request("/api/community-follows", { communityId: "published", following: true }), followStore.dependencies);
  assert.equal(follow.status, 200);
  assert.deepEqual(await follow.json(), { follow: { communityId: "published", following: true } });
  assert.equal(followStore.follows.get("member-1:published")?.userId, "member-1");
});

test("storage failures return a generic response and generic log without evidence, reviewer fields, or user IDs", async () => {
  const store = routeStore({ failClaimSave: true });
  const originalError = console.error;
  const logs: unknown[][] = [];
  console.error = (...values: unknown[]) => { logs.push(values); };
  try {
    const response = await handleCommunityClaim(request("/api/community-claims", validClaim()), store.dependencies);
    assert.equal(response.status, 500);
    const exposed = `${JSON.stringify(await response.json())} ${JSON.stringify(logs)}`;
    assert.equal(exposed.includes("证明材料"), false);
    assert.equal(exposed.includes("reviewer"), false);
    assert.equal(exposed.includes("member-1"), false);
    assert.equal(exposed.includes("member-9"), false);
  } finally {
    console.error = originalError;
  }
});

type Mounted = { container: HTMLDivElement; dom: JSDOM; unmount(): Promise<void> };

async function mount(element: React.ReactNode): Promise<Mounted> {
  const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', { url: "https://site.test" });
  Object.assign(globalThis, {
    window: dom.window,
    document: dom.window.document,
    HTMLElement: dom.window.HTMLElement,
    Node: dom.window.Node,
    Event: dom.window.Event,
    MouseEvent: dom.window.MouseEvent,
    FormData: dom.window.FormData,
    IS_REACT_ACT_ENVIRONMENT: true,
  });
  const container = dom.window.document.querySelector<HTMLDivElement>("#root")!;
  const root: Root = createRoot(container);
  await act(async () => { root.render(element); });
  return { container, dom, unmount: async () => { await act(async () => { root.unmount(); }); dom.window.close(); } };
}

async function flush() {
  await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)); });
}

const publicCommunity = {
  id: "published", slug: "published", name: "广州 AI 产品社群", summary: "面向广州创作者的 AI 产品交流与实践社群。",
  primaryCity: "广州", locationMode: "city" as const, focusTags: ["Agent"], officialUrl: "https://example.com/community",
  sourceUrl: "https://example.com/source", sourceLabel: "官方社区页面", claimed: false, updatedAt: NOW, updates: [], followed: false,
};

test("logged-in community profiles enable the real follow control while visitors retain the apply CTA", async () => {
  const loggedIn = await mount(createElement(CommunityProfile, { community: publicCommunity, isLoggedIn: true }));
  try {
    const follow = [...loggedIn.container.querySelectorAll("button")].find((button) => button.textContent === "关注社群");
    assert.ok(follow);
    assert.equal(follow.disabled, false);
  } finally { await loggedIn.unmount(); }

  const visitor = await mount(createElement(CommunityProfile, { community: publicCommunity, isLoggedIn: false }));
  try {
    assert.equal(visitor.container.querySelector('a[href="/apply"]')?.textContent, "关注社群（审核成员可关注）");
    assert.equal(visitor.container.querySelector("button"), null);
  } finally { await visitor.unmount(); }
});

test("CommunityActions sends the exact follow payload, updates only after success, and exposes failures as status text", async () => {
  const originalFetch = globalThis.fetch;
  const calls: Array<{ method?: string; body?: string }> = [];
  globalThis.fetch = async (_input, init) => { calls.push({ method: init?.method, body: String(init?.body) }); return Response.json({ follow: { communityId: "published", following: true } }); };
  const mounted = await mount(createElement(CommunityActions, { communityId: "published", officialUrl: "https://example.com", officialDomain: "example.com", isLoggedIn: true, initiallyFollowed: false, followEnabled: true }));
  try {
    const button = mounted.container.querySelector("button")!;
    await act(async () => { button.click(); });
    await flush();
    assert.deepEqual(calls, [{ method: "POST", body: '{"communityId":"published","following":true}' }]);
    assert.equal(button.textContent, "已关注");
  } finally {
    globalThis.fetch = originalFetch;
    await mounted.unmount();
  }

  globalThis.fetch = async () => Response.json({ error: "暂时无法关注" }, { status: 500 });
  const failed = await mount(createElement(CommunityActions, { communityId: "published", officialUrl: "https://example.com", officialDomain: "example.com", isLoggedIn: true, initiallyFollowed: false, followEnabled: true }));
  try {
    const button = failed.container.querySelector("button")!;
    await act(async () => { button.click(); });
    await flush();
    assert.equal(button.textContent, "关注社群");
    assert.match(failed.container.querySelector('[role="status"]')?.textContent ?? "", /暂时无法/);
  } finally {
    globalThis.fetch = originalFetch;
    await failed.unmount();
  }
});

test("CommunitySubmissionForm reports review-gated success without changing public content", async () => {
  const originalFetch = globalThis.fetch;
  let submittedBody = "";
  globalThis.fetch = async (_input, init) => { submittedBody = String(init?.body); return Response.json({ submission: { id: "server-uuid", status: "pending" } }, { status: 201 }); };
  const mounted = await mount(createElement(CommunitySubmissionForm, { mode: "create" }));
  try {
    const values: Record<string, string> = {
      name: "广州 AI 产品社群", summary: "面向广州创作者的 AI 产品交流与实践社群。", primaryCity: "广州",
      focusTags: "Agent,产品", officialUrl: "https://example.com/community", sourceUrl: "https://example.com/source", sourceLabel: "官方社区页面",
    };
    for (const [name, value] of Object.entries(values)) {
      const control = mounted.container.querySelector<HTMLInputElement | HTMLTextAreaElement>(`[name="${name}"]`)!;
      control.value = value;
    }
    const form = mounted.container.querySelector("form")!;
    await act(async () => { form.dispatchEvent(new mounted.dom.window.Event("submit", { bubbles: true, cancelable: true })); });
    await flush();
    assert.equal(JSON.parse(submittedBody).kind, "create");
    assert.equal(mounted.container.querySelector('[role="status"]')?.textContent, "已提交，运营审核通过后公开");
    assert.doesNotMatch(mounted.container.textContent ?? "", /已公开/);
  } finally {
    globalThis.fetch = originalFetch;
    await mounted.unmount();
  }
});
