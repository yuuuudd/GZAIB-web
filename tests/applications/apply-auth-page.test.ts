import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("the member application page sends anonymous visitors through the active account login", async () => {
  const page = await readFile(new URL("../../app/apply/page.tsx", import.meta.url), "utf8");
  assert.match(page, /resolveRequestUserId/);
  assert.match(page, /redirect\(accountSignInPath\("\/apply"\)\)/);
});

test("the production proxy canonicalizes www onto the account cookie host", async () => {
  const nginx = await readFile(new URL("../../ops/nginx/gzaibuilders.cn.conf", import.meta.url), "utf8");
  assert.match(nginx, /if \(\$host = www\.gzaibuilders\.cn\)[\s\S]*return 301 https:\/\/gzaibuilders\.cn\$request_uri;/);
});
