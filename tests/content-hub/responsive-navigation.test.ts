import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
// @ts-expect-error The project intentionally runs jsdom without the optional @types/jsdom package.
import { JSDOM } from "jsdom";

type DisplayCandidate = {
  important: boolean;
  order: number;
  specificity: number;
  value: string;
};

function closingBrace(source: string, openingBrace: number): number {
  let depth = 1;
  for (let index = openingBrace + 1; index < source.length; index += 1) {
    if (source[index] === "{") depth += 1;
    if (source[index] === "}") depth -= 1;
    if (depth === 0) return index;
  }
  throw new Error("Unbalanced CSS block");
}

function maxWidthMatches(query: string, viewportWidth: number): boolean {
  const match = query.match(/max-width\s*:\s*(\d+)px/i);
  return !match || viewportWidth <= Number(match[1]);
}

function specificity(selector: string): number {
  const ids = selector.match(/#[\w-]+/g)?.length ?? 0;
  const classesAndAttributes = selector.match(/\.[\w-]+|\[[^\]]+\]/g)?.length ?? 0;
  const elements = selector.match(/(?:^|[\s>+~])([a-z][\w-]*)/gi)?.length ?? 0;
  return ids * 100 + classesAndAttributes * 10 + elements;
}

function effectiveDisplay(css: string, headerClass: string, viewportWidth: number): string | undefined {
  const dom = new JSDOM(`<header class="brand-header ${headerClass}"><nav class="brand-nav"></nav></header>`);
  const navigation = dom.window.document.querySelector("nav")!;
  let candidate: DisplayCandidate | undefined;
  let order = 0;

  function visit(source: string, active: boolean) {
    let cursor = 0;
    while (cursor < source.length) {
      const openingBrace = source.indexOf("{", cursor);
      if (openingBrace === -1) break;
      const prelude = source.slice(cursor, openingBrace).replace(/@import[^;]+;/g, "").trim();
      const end = closingBrace(source, openingBrace);
      const body = source.slice(openingBrace + 1, end);
      cursor = end + 1;

      if (prelude.startsWith("@media")) {
        visit(body, active && maxWidthMatches(prelude, viewportWidth));
        continue;
      }
      if (!active || prelude.startsWith("@")) continue;

      const display = body.match(/(?:^|;)\s*display\s*:\s*([^;!}]+?)\s*(!important)?\s*(?:;|$)/i);
      if (!display) continue;
      for (const selector of prelude.split(",").map((value) => value.trim())) {
        order += 1;
        let matches = false;
        try { matches = navigation.matches(selector); } catch { matches = false; }
        if (!matches) continue;
        const next = {
          important: Boolean(display[2]),
          order,
          specificity: specificity(selector),
          value: display[1]!.trim(),
        };
        if (!candidate
          || Number(next.important) > Number(candidate.important)
          || (next.important === candidate.important && next.specificity > candidate.specificity)
          || (next.important === candidate.important && next.specificity === candidate.specificity && next.order > candidate.order)) {
          candidate = next;
        }
      }
    }
  }

  try {
    visit(css.replace(/\/\*[\s\S]*?\*\//g, ""), true);
    return candidate?.value;
  } finally {
    dom.window.close();
  }
}

test("public channel navigation remains visible at mobile breakpoints", async () => {
  const css = await readFile(new URL("../../app/globals.css", import.meta.url), "utf8");

  assert.equal(effectiveDisplay(css, "", 720), "flex");
  assert.equal(effectiveDisplay(css, "", 420), "flex");
  assert.equal(effectiveDisplay(css, "community-header", 760), "flex");
  assert.equal(effectiveDisplay(css, "community-header", 420), "flex");
});

test("mobile headers reserve separate rows for account actions and navigation", async () => {
  const css = await readFile(new URL("../../app/globals.css", import.meta.url), "utf8");

  assert.match(css, /\.community-header[^}]*grid-template-areas:\s*"brand action"\s*"nav nav";/s);
  assert.match(css, /\.community-header\s*>\s*\.brand-header-action(?=[^{]*\{)[^{]*\{[^}]*grid-area:\s*action;/s);
});
