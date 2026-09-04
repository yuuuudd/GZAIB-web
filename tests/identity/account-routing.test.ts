import assert from "node:assert/strict";
import test from "node:test";
import { accountSignInPath } from "../../features/identity/account-paths";

test("local authentication uses the in-app login while Sites keeps its hosted sign-in", () => {
  assert.equal(accountSignInPath("/me/connections", "local"), "/login?return_to=%2Fme%2Fconnections");
  assert.equal(accountSignInPath("/me/connections", "sites"), "/signin-with-chatgpt?return_to=%2Fme%2Fconnections");
  assert.equal(accountSignInPath("//evil.test", "local"), "/login?return_to=%2F");
});
