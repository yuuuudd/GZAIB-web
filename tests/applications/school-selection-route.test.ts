import assert from "node:assert/strict";
import test from "node:test";

test("authenticated applicant can save an AMap school through the public selection route", async () => {
  let module: Record<string, unknown> = {};
  try {
    module = await import("../../app/api/schools/route") as Record<string, unknown>;
  } catch {
    // The assertion below stays red until the public route exists.
  }
  const handleSchoolSelectionPost = module.handleSchoolSelectionPost;
  assert.equal(typeof handleSchoolSelectionPost, "function", "public school selection route should exist");

  let actor = "";
  const response = await (handleSchoolSelectionPost as (request: Request, dependencies: Record<string, unknown>) => Promise<Response>)(new Request("https://site.test/api/schools", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ action: "select_amap", name: "华南理工大学(五山校区)", campus: "华南理工大学(五山校区)", city: "广州", longitude: 113_349_000, latitude: 23_152_000 }),
  }), {
    authenticate: async () => "demo-member",
    service: async () => ({ selectAmapSchool: async (actorId: string, input: object) => { actor = actorId; return { id: "school-1", coordinateStatus: "confirmed", ...input }; } }),
    now: () => 2_000,
  });

  assert.equal(response.status, 201);
  assert.equal(actor, "demo-member");
  assert.equal((await response.json() as { coordinateStatus: string }).coordinateStatus, "confirmed");
});
