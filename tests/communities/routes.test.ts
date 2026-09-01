import assert from "node:assert/strict";
import test from "node:test";
import { handleCommunityList } from "../../app/api/communities/route";
import { handleCommunityDetail } from "../../app/api/communities/[slug]/route";

const community = {
  id: "community-1", slug: "visible", name: "广州 AI 共创社", summary: "一起把 AI 做进真实的社区协作。",
  primaryCity: "广州市", locationMode: "hybrid" as const, focusTags: ["AI"], officialUrl: "https://visible.example",
  sourceUrl: "https://source.example", sourceLabel: "公开来源", updatedAt: 200, claimed: false, updates: [],
};

function dependencies(overrides: Partial<Parameters<typeof handleCommunityList>[1]> = {}) {
  const calls: { query?: unknown; viewerId?: string } = {};
  return {
    calls,
    dependencies: {
      viewerId: async () => "viewer-1",
      service: async () => ({
        list: async (query: unknown, viewerId?: string) => { calls.query = query; calls.viewerId = viewerId; return { items: [{ ...community, followed: true }], citySummaries: [{ city: "广州", communityCount: 1 }] }; },
        getBySlug: async (slug: string, viewerId?: string) => slug === "visible" ? { ...community, ...(viewerId ? { followed: true } : {}) } : undefined,
      }),
      ...overrides,
    },
  };
}

function detailDependencies(overrides: Partial<Parameters<typeof handleCommunityDetail>[2]> = {}) {
  return {
    viewerId: async () => "viewer-1",
    service: async () => ({
      getBySlug: async (slug: string, viewerId?: string) => slug === "visible" ? { ...community, ...(viewerId ? { followed: true } : {}) } : undefined,
    }),
    ...overrides,
  };
}

test("community list accepts only bounded public filters and degrades a viewer failure to visitor", async () => {
  const store = dependencies({ viewerId: async () => { throw new Error("session unavailable"); } });
  const response = await handleCommunityList(new Request("https://demo.local/api/communities?q=AI&city=%E5%B9%BF%E5%B7%9E%E5%B8%82&locationMode=hybrid&focus=%E4%BA%A7%E5%93%81&ignored=secret"), store.dependencies);

  assert.equal(response.status, 200);
  assert.deepEqual(store.calls.query, { q: "AI", city: "广州市", locationMode: "hybrid", focus: "产品" });
  assert.equal(store.calls.viewerId, undefined);
  assert.equal(response.headers.get("Cache-Control"), "public, max-age=60, stale-while-revalidate=300");
  assert.equal(JSON.stringify(await response.json()).includes("secret"), false);
});

test("community detail follows the Vinext async params signature and uses private cache when viewer state is present", async () => {
  const response = await handleCommunityDetail(new Request("https://demo.local/api/communities/visible"), { params: Promise.resolve({ slug: "visible" }) }, detailDependencies());

  assert.equal(response.status, 200);
  assert.equal(response.headers.get("Cache-Control"), "private, no-store");
  assert.deepEqual(await response.json(), { community: { ...community, followed: true } });
});

test("community detail returns 404 for missing records and 503 for storage failures", async () => {
  const missingResponse = await handleCommunityDetail(new Request("https://demo.local/api/communities/missing"), { params: Promise.resolve({ slug: "missing" }) }, detailDependencies());
  assert.equal(missingResponse.status, 404);

  const failedResponse = await handleCommunityDetail(new Request("https://demo.local/api/communities/visible"), { params: Promise.resolve({ slug: "visible" }) }, detailDependencies({ service: async () => { throw new Error("D1 unavailable"); } }));
  assert.equal(failedResponse.status, 503);
});

test("community routes reject oversized values without invoking the service", async () => {
  const store = dependencies();
  const response = await handleCommunityList(new Request(`https://demo.local/api/communities?q=${"a".repeat(101)}`), store.dependencies);

  assert.equal(response.status, 400);
  assert.equal(store.calls.query, undefined);
});
