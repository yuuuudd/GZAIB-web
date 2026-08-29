import assert from "node:assert/strict";
import test from "node:test";
import { schoolMembersUrl } from "../../features/directory/client-query";

test("school drawer preserves active public filters while scoping its member request to the selected school", () => {
  assert.equal(
    schoolMembersUrl("school-1", { city: "广州", skills: ["AI应用"], roles: ["活动共建者"], verified: true, q: "林 同学" }),
    "/api/directory?mode=list&limit=24&schoolId=school-1&city=%E5%B9%BF%E5%B7%9E&skills=AI%E5%BA%94%E7%94%A8&roles=%E6%B4%BB%E5%8A%A8%E5%85%B1%E5%BB%BA%E8%80%85&verified=true&q=%E6%9E%97+%E5%90%8C%E5%AD%A6",
  );
});

test("school drawer paging request carries the opaque cursor without adding private fields", () => {
  assert.equal(schoolMembersUrl("school-1", { q: "林同学" }, "member-24"), "/api/directory?mode=list&limit=24&schoolId=school-1&q=%E6%9E%97%E5%90%8C%E5%AD%A6&cursor=member-24");
});
