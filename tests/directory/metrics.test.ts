import assert from "node:assert/strict";
import test from "node:test";
import { createMetricsService, type MetricCounter } from "../../features/directory/service";

test("increments exactly one UTC daily aggregate counter", async () => {
  const counters = new Map<string, number>();
  const repository = {
    isKnownSchool: async () => true,
    increment: async (counter: MetricCounter) => {
      const key = `${counter.metricDate}|${counter.eventType}|${counter.dimensionKey}`;
      const count = (counters.get(key) ?? 0) + 1;
      counters.set(key, count);
      return count;
    },
  };
  const metrics = createMetricsService(repository);
  const now = Date.parse("2026-08-29T16:20:00+08:00");

  assert.equal(await metrics.record({ eventType: "map_view", dimensionKey: "all" }, now), 1);
  assert.equal(counters.size, 1);
  assert.equal(counters.get("2026-08-29|map_view|all"), 1);
});

test("rejects profile ids, emails, arbitrary dimensions and extra identifying fields", async () => {
  const metrics = createMetricsService({ increment: async () => 1, isKnownSchool: async () => true });
  const now = Date.now();

  await assert.rejects(() => metrics.record({ eventType: "profile_view", dimensionKey: "profile:u1" }, now));
  await assert.rejects(() => metrics.record({ eventType: "profile_view", dimensionKey: "lin@example.com" }, now));
  await assert.rejects(() => metrics.record({ eventType: "map_view", dimensionKey: "city:广州" }, now));
  await assert.rejects(() => metrics.record({ eventType: "map_view", dimensionKey: "all", profileId: "u1" } as never, now));
});

test("rejects a school dimension unless the school id exists", async () => {
  let increments = 0;
  const metrics = createMetricsService({
    increment: async () => ++increments,
    isKnownSchool: async (schoolId: string) => schoolId === "sysu",
  });

  await assert.rejects(() => metrics.record({ eventType: "profile_view", dimensionKey: "school:u1" }, Date.now()));
  assert.equal(increments, 0);
});
