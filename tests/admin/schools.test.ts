import assert from "node:assert/strict";
import test from "node:test";
import { createSchoolAdminService, parseSchoolAdminAction, type SchoolAdminRepository } from "../../features/admin/schools";

test("proposes a server-geocoded coordinate as suggested rather than immediately publishing it", async () => {
  const suggestions: Parameters<SchoolAdminRepository["saveSuggestedAtomic"]>[0][] = [];
  const repository: SchoolAdminRepository = {
    saveSuggestedAtomic: async (input) => { suggestions.push(input); return input.school; },
    confirmCoordinateAtomic: async () => ({ transitioned: true }),
  };
  const service = createSchoolAdminService(repository, async () => ({ longitude: 113_264_400, latitude: 23_129_100 }), () => "school-1", () => "audit-1");
  const result = await service.proposeSchool("demo-admin", { name: "演示大学（虚构）", campus: "共创校区", city: "广州" }, 1_000);

  assert.equal(result.coordinateStatus, "suggested");
  assert.equal(suggestions[0]?.school.longitude, 113_264_400);
  assert.equal(suggestions[0]?.school.latitude, 23_129_100);
  assert.equal(suggestions[0]?.audit.action, "school.coordinate_suggested");
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
});

test("stores an administrator-selected AMap result as a suggested coordinate without calling geocoding", async () => {
  const suggestions: Parameters<SchoolAdminRepository["saveSuggestedAtomic"]>[0][] = [];
  const repository: SchoolAdminRepository = {
    saveSuggestedAtomic: async (input) => { suggestions.push(input); return input.school; },
    confirmCoordinateAtomic: async () => ({ transitioned: true }),
  };
  const service = createSchoolAdminService(repository, async () => { throw new Error("geocoding should not run"); }, () => "school-1", () => "audit-1");
  const result = await service.proposeSelectedSchool("chatgpt:operator", {
    name: "Guangzhou AI University", campus: "Main campus", city: "Guangzhou", longitude: 113_264_400, latitude: 23_129_100,
  }, 1_000);

  assert.equal(result.coordinateStatus, "suggested");
  assert.equal(suggestions[0]?.school.longitude, 113_264_400);
  assert.match(suggestions[0]?.audit.diffJson ?? "", /amap_place_search/);
});
