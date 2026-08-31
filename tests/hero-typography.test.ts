import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("home hero uses the approved Kai-style headline treatment", async () => {
  const css = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");

  assert.match(
    css,
    /\.brand-hero h1\s*\{[^}]*font-family:\s*"Kaiti SC",\s*"STKaiti",\s*"KaiTi",\s*"楷体",\s*serif;[^}]*font-weight:\s*400;[^}]*letter-spacing:\s*\.035em;/s,
  );
});
