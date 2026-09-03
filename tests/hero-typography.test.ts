import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("home hero uses a semibold Source Han serif treatment sized for two desktop lines", async () => {
  const layout = await readFile(new URL("../app/layout.tsx", import.meta.url), "utf8");
  const css = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");

  assert.match(layout, /import localFont from "next\/font\/local"/);
  assert.match(layout, /src:"\.\/fonts\/SourceHanSerifSC-SemiBold\.otf",\s*weight:"600"/);
  assert.match(
    css,
    /\.brand-hero h1\s*\{[^}]*font-family:\s*var\(--font-source-han-serif\),\s*"Source Han Serif SC",\s*"Noto Serif CJK SC",\s*serif;[^}]*font-size:\s*clamp\(2\.9rem,5\.8vw,5\.6rem\);[^}]*font-weight:\s*600;[^}]*line-height:\s*1\.3;[^}]*letter-spacing:\s*\.05em;/s,
  );
  assert.match(css, /\.hero-title-line\s*\{[^}]*display:\s*block;[^}]*white-space:\s*nowrap;/s);
});

test("map section title uses the matching semibold serif treatment on one desktop line", async () => {
  const css = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");

  assert.match(
    css,
    /\.map-heading-row h2\s*\{[^}]*max-width:\s*none;[^}]*font-family:\s*var\(--font-source-han-serif\),\s*"Source Han Serif SC",\s*"Noto Serif CJK SC",\s*serif;[^}]*font-size:\s*clamp\(2\.2rem,3\.6vw,3\.6rem\);[^}]*font-weight:\s*600;[^}]*line-height:\s*1\.12;[^}]*letter-spacing:\s*\.05em;[^}]*white-space:\s*nowrap;/s,
  );
  assert.match(
    css,
    /\.map-heading-row h2\s*\{[^}]*white-space:\s*nowrap;[^}]*\}\s*@media\s*\(max-width:720px\)\s*\{\s*\.map-heading-row h2\s*\{[^}]*white-space:\s*normal;/s,
  );
});

test("home's co-creation hero matches the first-screen title typography", async () => {
  const css = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");

  assert.match(
    css,
    /\.approval-heading h2\s*\{[^}]*font-family:var\(--font-source-han-serif\),"Source Han Serif SC","Noto Serif CJK SC",serif;[^}]*font-size:clamp\(2\.7rem,3\.8vw,4\.7rem\);[^}]*font-weight:600;[^}]*line-height:1\.22;[^}]*letter-spacing:\.025em;/s,
  );
});

test("home's first-screen hero copy retains the requested right offset and moves down from its prior position", async () => {
  const css = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");

  assert.match(css, /\.brand-home-copy\s*\{[^}]*transform:translate\(10%,-10%\);/s);
});
