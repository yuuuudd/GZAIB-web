import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("channel account entries use full-page navigation for the sign-in redirect", async () => {
  const [contentHeader, communityPage] = await Promise.all([
    readFile(new URL("../../components/content-hub/ContentHubHeader.tsx", import.meta.url), "utf8"),
    readFile(new URL("../../app/communities/page.tsx", import.meta.url), "utf8"),
  ]);

  assert.match(contentHeader, /<a className="brand-header-action" href="\/me">我的<\/a>/);
  assert.match(communityPage, /<a className="brand-header-action" href="\/me">我的<\/a>/);
});
