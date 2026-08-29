import assert from "node:assert/strict";
import test from "node:test";
import * as schema from "../db/schema";

test("core schema exports every required table", () => {
  for (const name of [
    "users", "magicLinkTokens", "sessions", "schools", "applications",
    "memberProfiles", "profileVisibility", "contributions", "notifications", "dailyMetrics", "auditLogs",
  ]) assert.ok(name in schema, `missing ${name}`);
  for (const name of ["contactCards", "connectionRequests", "blocks", "reports"]) {
    assert.ok(name in schema, `missing ${name}`);
  }
});
