import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { nextSafetyDialogFocusIndex, safetyDialogSuccessState, shouldCloseSafetyDialog } from "../../components/safety/dialog-focus";

test("safety dialogs wrap keyboard focus and close only on Escape", () => {
  assert.equal(nextSafetyDialogFocusIndex(2, 3, false), 0);
  assert.equal(nextSafetyDialogFocusIndex(0, 3, true), 2);
  assert.equal(shouldCloseSafetyDialog("Escape"), true);
  assert.equal(shouldCloseSafetyDialog("Enter"), false);
});

test("successful safety actions move focus to stable feedback", () => {
  assert.deepEqual(safetyDialogSuccessState("blocked"), { open: false, focusTarget: "status", result: "blocked" });
  assert.deepEqual(safetyDialogSuccessState("reported"), { open: false, focusTarget: "status", result: "reported" });
});

test("both safety controls use native modal focus and stable feedback", () => {
  for (const path of ["components/safety/BlockButton.tsx", "components/safety/ReportDialog.tsx"]) {
    const source = readFileSync(path, "utf8");
    assert.match(source, /<Modal/);
    assert.match(source, /role="status"/);
    assert.match(source, /tabIndex=\{-1\}/);
  }
});
