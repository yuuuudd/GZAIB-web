import assert from "node:assert/strict";
import test from "node:test";

test("authenticated applicant can save an AMap school through the public selection route", async () => {
  let importedRoute: Record<string, unknown> = {};
  try {
    importedRoute = await import("../../app/api/schools/route") as Record<string, unknown>;
  } catch {
    // The assertion below stays red until the public route exists.
  }
  const handleSchoolSelectionPost = importedRoute.handleSchoolSelectionPost;
  assert.equal(typeof handleSchoolSelectionPost, "function", "public school selection route should exist");

  let actor = "";
  const response = await (handleSchoolSelectionPost as (request: Request, dependencies: Record<string, unknown>) => Promise<Response>)(new Request("https://site.test/api/schools", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ action: "select_amap", name: "武汉大学", campus: "主校区", province: "湖北", city: "武汉", longitude: 114_365_000, latitude: 30_536_000 }),
  }), {
    authenticate: async () => "demo-member",
    service: async () => ({ selectAmapSchool: async (actorId: string, input: object) => { actor = actorId; return { id: "school-1", coordinateStatus: "confirmed", ...input }; } }),
    now: () => 2_000,
  });

  assert.equal(response.status, 201);
  assert.equal(actor, "demo-member");
  const school = await response.json() as { coordinateStatus: string; province: string };
  assert.equal(school.coordinateStatus, "confirmed");
  assert.equal(school.province, "湖北");
});
