import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("home hero uses a semibold Source Han serif treatment sized for two desktop lines", async () => {
  const css = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");

  assert.match(
    css,
    /\.brand-hero h1\s*\{[^}]*font-family:\s*var\(--font-source-han-serif\),\s*"Source Han Serif SC",\s*"Noto Serif CJK SC",\s*serif;[^}]*font-size:\s*clamp\(2\.9rem,5\.8vw,5\.6rem\);[^}]*font-weight:\s*600;[^}]*line-height:\s*1\.3;[^}]*letter-spacing:\s*\.05em;/s,
  );
  assert.match(css, /\.hero-title-line\s*\{[^}]*display:\s*block;[^}]*white-space:\s*nowrap;/s);
});
