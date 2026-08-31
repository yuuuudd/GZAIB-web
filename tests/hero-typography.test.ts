import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("home hero uses the approved KaiTi GB2312 headline treatment and open spacing", async () => {
  const css = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");

  assert.match(
    css,
    /\.brand-hero h1\s*\{[^}]*font-family:\s*"KaiTi_GB2312",\s*"楷体_GB2312",\s*"KaiTi",\s*"STKaiti",\s*"Kaiti SC",\s*"楷体",\s*serif;[^}]*font-weight:\s*400;[^}]*line-height:\s*1\.35;[^}]*letter-spacing:\s*\.1em;/s,
  );
});
