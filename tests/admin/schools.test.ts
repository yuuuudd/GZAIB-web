import assert from "node:assert/strict";
import test from "node:test";
import { createSchoolAdminService, parseSchoolAdminAction, type SchoolAdminRepository } from "../../features/admin/schools";

test("proposes a server-geocoded coordinate as suggested rather than immediately publishing it", async () => {
  const suggestions: Parameters<SchoolAdminRepository["saveSuggested"]>[0][] = [];
  const repository: SchoolAdminRepository = {
    saveSuggested: async (school) => { suggestions.push(school); return school; },
    confirmCoordinateAtomic: async () => undefined,
  };
  const service = createSchoolAdminService(repository, async () => ({ longitude: 113_264_400, latitude: 23_129_100 }), () => "school-1", () => "audit-1");
  const result = await service.proposeSchool("demo-admin", { name: "演示大学（虚构）", campus: "共创校区", city: "广州" }, 1_000);

  assert.equal(result.coordinateStatus, "suggested");
  assert.equal(suggestions[0]?.longitude, 113_264_400);
  assert.equal(suggestions[0]?.latitude, 23_129_100);
});

test("confirms only a stored school id and writes one coordinate-confirmed audit row atomically", async () => {
  const confirmations: Parameters<SchoolAdminRepository["confirmCoordinateAtomic"]>[0][] = [];
  const repository: SchoolAdminRepository = {
    saveSuggested: async (school) => school,
    confirmCoordinateAtomic: async (input) => { confirmations.push(input); },
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
