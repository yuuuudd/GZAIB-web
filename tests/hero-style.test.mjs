import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("home hero title stays clear of the channel cards", async () => {
  const css = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");

  assert.match(css, /\.brand-home-copy h1 \{[^}]*font-size:clamp\(2\.7rem,3\.8vw,4\.7rem\)/);
});
