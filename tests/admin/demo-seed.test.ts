import assert from "node:assert/strict";
import test from "node:test";
import { chunkRowsByD1ParameterLimit, DEMO_SEED, seedDemoData, type DemoSeedRepository } from "../../db/demo-seed";

function memoryRepository() {
  const ids = {
    schools: new Set<string>(), users: new Set<string>(), applications: new Set<string>(),
    profiles: new Set<string>(), visibility: new Set<string>(), contributions: new Set<string>(),
    communities: new Set<string>(), managers: new Set<string>(), updates: new Set<string>(), audits: new Set<string>(),
  };
  const repository: DemoSeedRepository = {
    seed: async (seed) => {
      for (const school of seed.schools) ids.schools.add(school.id);
      for (const user of seed.users) ids.users.add(user.id);
      for (const application of seed.applications) ids.applications.add(application.id);
      for (const profile of seed.profiles) ids.profiles.add(profile.id);
      for (const row of seed.visibility) ids.visibility.add(row.id);
      for (const row of seed.contributions) ids.contributions.add(row.id);
      for (const community of seed.communities) ids.communities.add(community.id);
      for (const manager of seed.communityManagers) ids.managers.add(`${manager.communityId}:${manager.userId}`);
      for (const update of seed.communityUpdates) ids.updates.add(update.id);
      ids.audits.add(seed.audit.id);
      return Object.fromEntries(Object.entries(ids).map(([key, value]) => [key, value.size])) as never;
    },
  };
  return { repository, ids };
}

test("defines a safe, clearly fictional Guangdong demo dataset", () => {
  assert.ok(DEMO_SEED.schools.length >= 6);
  assert.ok(new Set(DEMO_SEED.schools.map((school) => school.city)).size >= 3);
  assert.equal(DEMO_SEED.schools.every((school) => school.coordinateStatus === "confirmed"), true);
  assert.ok(DEMO_SEED.profiles.length >= 12);
  assert.equal(DEMO_SEED.applications.filter((application) => application.status === "pending").length, 1);
  assert.equal(DEMO_SEED.users.every((user) => user.email.endsWith(".invalid")), true);
  assert.equal(DEMO_SEED.applications.every((application) => application.avatarKey === null && application.realName === null), true);
  assert.equal(DEMO_SEED.profiles.every((profile) => profile.avatarKey === null && profile.realName === null), true);
  assert.ok(DEMO_SEED.users.every((user) => user.id.startsWith("demo-seed-") || ["demo-admin", "demo-member", "demo-peer"].includes(user.id)));
  assert.ok(DEMO_SEED.contributions.filter((row) => row.status === "confirmed" && row.visibility === "public").length >= 4);
});

test("seeds the two fixed connection-demo members as active, approved, published fictional profiles", () => {
  for (const userId of ["demo-member", "demo-peer"]) {
    const user = DEMO_SEED.users.find((candidate) => candidate.id === userId);
    const application = DEMO_SEED.applications.find((candidate) => candidate.userId === userId);
    const profile = DEMO_SEED.profiles.find((candidate) => candidate.userId === userId);
    assert.equal(user?.status, "active");
    assert.equal(user?.role, "member");
    assert.equal(application?.status, "approved");
    assert.equal(profile?.publishStatus, "published");
    assert.equal(profile?.verifiedBuilder, true);
  }
  const communityOwnerProfile = DEMO_SEED.profiles.find((candidate) => candidate.userId === "demo-member");
  assert.equal(communityOwnerProfile?.slug, "demo-fictional-community-owner");
  assert.notEqual(communityOwnerProfile?.slug, communityOwnerProfile?.userId);
});

test("defines exactly the three planned published fictional communities with one public update each", () => {
  assert.deepEqual(DEMO_SEED.communities.map(({ slug, primaryCity, locationMode, publishStatus }) => ({
    slug, primaryCity, locationMode, publishStatus,
  })), [
    { slug: "demo-guangzhou-ai-builders", primaryCity: "广州", locationMode: "hybrid", publishStatus: "published" },
    { slug: "demo-shenzhen-agent-lab", primaryCity: "深圳", locationMode: "city", publishStatus: "published" },
    { slug: "demo-online-ai-makers", primaryCity: null, locationMode: "online", publishStatus: "published" },
  ]);
  assert.equal(DEMO_SEED.communities.every(({ name, summary }) => name.includes("演示虚构") && summary.includes("演示虚构")), true);
  assert.equal(DEMO_SEED.communities.filter(({ locationMode }) => locationMode === "online").every(({ primaryCity }) => primaryCity === null), true);
  assert.deepEqual(DEMO_SEED.communities.map(({ id }) => DEMO_SEED.communityUpdates.filter((update) => update.communityId === id && update.status === "published").length), [1, 1, 1]);
  assert.deepEqual(DEMO_SEED.communityManagers, DEMO_SEED.communities.map((community) => ({
    communityId: community.id,
    userId: "demo-member",
    role: "owner",
    createdAt: community.createdAt,
  })));
});

test("is demo-admin-only and repeated initialization does not duplicate deterministic rows", async () => {
  const store = memoryRepository();
  await assert.rejects(() => seedDemoData("demo-member", store.repository, 1_000), /forbidden/i);
  const first = await seedDemoData("demo-admin", store.repository, 1_000);
  const second = await seedDemoData("demo-admin", store.repository, 2_000);

  assert.deepEqual(second, first);
  assert.equal(store.ids.schools.size, DEMO_SEED.schools.length);
  assert.equal(store.ids.profiles.size, DEMO_SEED.profiles.length);
  assert.equal(store.ids.communities.size, DEMO_SEED.communities.length);
  assert.equal(store.ids.managers.size, DEMO_SEED.communityManagers.length);
  assert.equal(store.ids.updates.size, DEMO_SEED.communityUpdates.length);
  assert.equal(store.ids.audits.size, 1);
  assert.deepEqual(second, {
    schools: DEMO_SEED.schools.length,
    users: DEMO_SEED.users.length,
    applications: DEMO_SEED.applications.length,
    profiles: DEMO_SEED.profiles.length,
    visibility: DEMO_SEED.visibility.length,
    contributions: DEMO_SEED.contributions.length,
    communities: DEMO_SEED.communities.length,
    managers: DEMO_SEED.communityManagers.length,
    updates: DEMO_SEED.communityUpdates.length,
    audits: 1,
  });
});

test("chunks every Demo seed insert below D1's bind-parameter budget", () => {
  for (const rows of [
    DEMO_SEED.schools, DEMO_SEED.users, DEMO_SEED.applications, DEMO_SEED.profiles, DEMO_SEED.visibility,
    DEMO_SEED.contributions, DEMO_SEED.communities, DEMO_SEED.communityManagers, DEMO_SEED.communityUpdates,
  ]) {
    for (const chunk of chunkRowsByD1ParameterLimit(rows)) {
      assert.ok(chunk.reduce((total, row) => total + Object.keys(row).length, 0) <= 100);
    }
  }
});
