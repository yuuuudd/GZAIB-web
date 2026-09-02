import assert from "node:assert/strict";
import test from "node:test";
import { mapConnectionCardState } from "../../components/connections/map-card-state";

test("map connection card turns a pending request into a locked waiting action", () => {
  assert.equal(mapConnectionCardState("pending"), "waiting");
});

test("map connection card only unlocks contacts for an accepted request", () => {
  assert.equal(mapConnectionCardState("accepted"), "connected");
  assert.equal(mapConnectionCardState("declined"), "declined");
  assert.equal(mapConnectionCardState(undefined), "ready");
});
