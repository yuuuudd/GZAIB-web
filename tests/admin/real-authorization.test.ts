import assert from "node:assert/strict";
import test from "node:test";
import { authorizeChatGPTAdmin } from "../../features/admin/identity";

test("authorizes only a header-derived ChatGPT email in the administrator allowlist", () => {
  assert.deepEqual(authorizeChatGPTAdmin({ userId: "oai-user-1", email: "JL5319604@gmail.com" }, "jl5319604@gmail.com"), {
    id: "chatgpt:oai-user-1",
    email: "jl5319604@gmail.com",
  });
});

test("rejects a ChatGPT account outside the administrator allowlist", () => {
  assert.throws(() => authorizeChatGPTAdmin({ userId: "oai-user-2", email: "2074712958@qq.com" }, "jl5319604@gmail.com"));
});

test("rejects access when the production administrator allowlist is empty", () => {
  assert.throws(() => authorizeChatGPTAdmin({ userId: "oai-user-1", email: "jl5319604@gmail.com" }, ""));
});
