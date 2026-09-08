import assert from "node:assert/strict";
import test from "node:test";
import { createSchoolAdminService, parseSchoolAdminAction, type SchoolAdminRepository } from "../../features/admin/schools";

test("server-geocoded schools become usable immediately", async () => {
  const suggestions: Parameters<SchoolAdminRepository["saveSuggestedAtomic"]>[0][] = [];
  const repository: SchoolAdminRepository = {
    saveSuggestedAtomic: async (input) => { suggestions.push(input); return input.school; },
    confirmCoordinateAtomic: async () => ({ transitioned: true }),
  };
  const service = createSchoolAdminService(repository, async () => ({ longitude: 113_264_400, latitude: 23_129_100 }), () => "school-1", () => "audit-1");
  const result = await service.proposeSchool("demo-admin", { name: "演示大学（虚构）", campus: "共创校区", province: "广东", city: "广州" }, 1_000);

  assert.equal(result.coordinateStatus, "confirmed");
  assert.equal(suggestions[0]?.school.longitude, 113_264_400);
  assert.equal(suggestions[0]?.school.latitude, 23_129_100);
  assert.equal(suggestions[0]?.audit.action, "school.coordinate_confirmed");
});

test("confirms only a stored school id and writes one coordinate-confirmed audit row atomically", async () => {
  const confirmations: Parameters<SchoolAdminRepository["confirmCoordinateAtomic"]>[0][] = [];
  const repository: SchoolAdminRepository = {
    saveSuggestedAtomic: async (input) => input.school,
    confirmCoordinateAtomic: async (input) => { confirmations.push(input); return { transitioned: true }; },
  };
  const service = createSchoolAdminService(repository, async () => ({ longitude: 1, latitude: 1 }), undefined, () => "audit-1");
  await service.confirmSchoolCoordinate("demo-admin", "school-1", 2_000);

  assert.equal(confirmations.length, 1);
  assert.equal(confirmations[0]?.audit.action, "school.coordinate_confirmed");
});

test("school action parser rejects client coordinates and identity claims", () => {
  assert.deepEqual(parseSchoolAdminAction({ action: "confirm", schoolId: "school-1" }), { action: "confirm", schoolId: "school-1" });
  assert.throws(() => parseSchoolAdminAction({ action: "confirm", schoolId: "school-1", longitude: 1 }), /invalid/i);
  assert.throws(() => parseSchoolAdminAction({ action: "propose", name: "演示大学", campus: "校区", city: "广州", role: "admin" }), /invalid/i);
  assert.throws(() => parseSchoolAdminAction({ action: "select_amap", name: "武汉大学", campus: "主校区", city: "武汉", longitude: 114_365_000, latitude: 30_536_000 }), /invalid/i);
  assert.throws(() => parseSchoolAdminAction({ action: "select_amap", name: "演示大学", campus: "主校区", province: "火星", city: "基地", longitude: 114_365_000, latitude: 30_536_000 }), /invalid/i);
});

test("stores an AMap-selected school as immediately usable without calling geocoding", async () => {
  const suggestions: Parameters<SchoolAdminRepository["saveSuggestedAtomic"]>[0][] = [];
  const repository: SchoolAdminRepository = {
    saveSuggestedAtomic: async (input) => { suggestions.push(input); return input.school; },
    confirmCoordinateAtomic: async () => ({ transitioned: true }),
  };
  const service = createSchoolAdminService(repository, async () => { throw new Error("geocoding should not run"); }, () => "school-1", () => "audit-1");
  const result = await service.proposeSelectedSchool("chatgpt:operator", {
    name: "武汉大学", campus: "主校区", province: "湖北", city: "武汉", longitude: 114_365_000, latitude: 30_536_000,
  }, 1_000);

  assert.equal(result.coordinateStatus, "confirmed");
  assert.equal(suggestions[0]?.school.province, "湖北");
  assert.equal(suggestions[0]?.school.longitude, 114_365_000);
  assert.match(suggestions[0]?.audit.diffJson ?? "", /amap_place_search/);
});

test("an authenticated member can select a validated AMap school without admin approval", async () => {
  const saved: Parameters<SchoolAdminRepository["saveSuggestedAtomic"]>[0][] = [];
  const repository: SchoolAdminRepository = {
    saveSuggestedAtomic: async (input) => { saved.push(input); return input.school; },
    confirmCoordinateAtomic: async () => ({ transitioned: true }),
  };
  const service = createSchoolAdminService(repository, async () => { throw new Error("geocoding should not run"); }, () => "school-1", () => "audit-1");
  const selectAmapSchool = (service as Record<string, unknown>).selectAmapSchool;
  assert.equal(typeof selectAmapSchool, "function", "selectAmapSchool should be available to the authenticated application flow");

  const result = await (selectAmapSchool as (actorId: string, input: { name: string; campus: string; province: string; city: string; longitude: number; latitude: number }, now: number) => Promise<{ coordinateStatus: string }>)("demo-member", {
    name: "华南理工大学(五山校区)", campus: "华南理工大学(五山校区)", province: "广东", city: "广州", longitude: 113_349_000, latitude: 23_152_000,
  }, 2_000);

  assert.equal(result.coordinateStatus, "confirmed");
  assert.equal(saved[0]?.audit.actorUserId, "demo-member");
});
