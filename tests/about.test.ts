import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("about hero layers the connection-and-action copy beside each icon over its supplied artwork", async () => {
  const page = await readFile(new URL("../app/about/page.tsx", import.meta.url), "utf8");
  const css = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");

  for (const copy of ["让愿意行动的人", "彼此看见", "让想做的事", "找到同行者", "连接", "行动", "高校", "社群", "想法", "项目", "成果"]) assert.match(page, new RegExp(copy));
  assert.match(page, /className="about-hero-overlay"/);
  assert.match(css, /\.about-hero-overlay\s*\{/);
  assert.match(css, /\.about-orbit-card\s*\{/);
  assert.match(css, /\.about-orbit-card\s*\{[^}]*width:7\.5%;[^}]*min-width:0;/s);
  assert.match(css, /\.about-orbit-card-1\s*\{\s*top:15\.2%;\s*left:69\.7%/);
  assert.match(css, /\.about-orbit-card-2\s*\{\s*top:28\.5%;\s*left:50\.2%/);
  assert.match(css, /\.about-orbit-card-3\s*\{\s*top:28%;\s*left:84%/);
  assert.match(css, /\.about-orbit-card-4\s*\{\s*top:44%;\s*left:91\.9%/);
  assert.match(css, /\.about-orbit-card-5\s*\{\s*top:60\.7%;\s*left:51\.1%/);
  assert.match(css, /\.about-orbit-card-6\s*\{\s*top:74\.4%;\s*left:61\.2%/);
  assert.match(css, /\.about-orbit-card-7\s*\{\s*top:67%;\s*left:87\.3%/);
});

test("about page omits the removed third artwork screen", async () => {
  const page = await readFile(new URL("../app/about/page.tsx", import.meta.url), "utf8");
  assert.doesNotMatch(page, /03-connection-action\.png/);
});

test("about canvas continues the supplied artwork base gradient", async () => {
  const css = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");

  assert.match(css, /\.about-shell\s*\{\s*background:linear-gradient\(90deg,#fafafa 0%,#f4f5f9 100%\);/);
  assert.match(css, /\.about-screen\s*\{[^}]*background:inherit;/s);
});

test("about position screen layers its copy over the supplied background", async () => {
  const page = await readFile(new URL("../app/about/page.tsx", import.meta.url), "utf8");
  const css = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");

  for (const copy of ["AI 是共同议题", "不是我们的边界", "AI / 共同议题", "青年 / 主要参与者", "共创 / 核心方法"]) assert.match(page, new RegExp(copy));
  assert.match(page, />AI<\/span> 把我们聚在一起/);
  assert.doesNotMatch(page, /让愿意行动的人彼此看见，<br \/>让想做的事找到/);
  assert.doesNotMatch(page, /技术是起点|好奇、探索|开放协作/);
  assert.match(page, /className="about-position-heading"/);
  assert.match(page, /className="about-position-overlay"/);
  assert.match(page, /\/about\/02-position-background\.png/);
  assert.match(css, /\.about-position-overlay\s*\{/);
  assert.match(css, /\.about-position-pillars\s*\{/);
  assert.match(css, /\.about-position-overlay\s*\{\s*inset:11\.7% 0 0;/);
  assert.match(css, /\.about-position-pillars\s*\{[^}]*top:50%;[^}]*padding:0 12\.5%;/s);
  assert.match(css, /\.about-position-closing\s*\{[^}]*top:78%;/s);
  assert.match(css, /\.about-position-heading\s*\{\s*transform:translateY\(-30%\) scale\(1\.3\);[^}]*transform-origin:top center;/);
  assert.match(css, /\.about-position-closing\s*\{\s*transform:translateY\(-20%\);/);
});

test("about co-creation archive layers its copy over the supplied background", async () => {
  const page = await readFile(new URL("../app/about/page.tsx", import.meta.url), "utf8");
  const css = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");

  for (const copy of ["CO-CREATION ARCHIVE", "让每一次行动", "共创的痕迹", "让人被看见", "让组织被发现", "让想法找到人", "让行动真的发生", "让每次行动留下东西", "共建地图", "AI 社群", "共创广场", "活动赛事", "共创档案"]) assert.match(page, new RegExp(copy));
  assert.match(page, /\/about\/04-co-creation-loop-background\.png/);
  assert.match(page, /className="about-loop-overlay"/);
  assert.match(css, /\.about-loop-overlay\s*\{/);
  assert.match(css, /\.about-loop-card\s*\{/);
  assert.match(css, /\.about-loop-intro\s*\{[^}]*transform:scale\(1\.2\);[^}]*transform-origin:top left;/s);
  assert.match(css, /\.about-loop-step\s*\{[^}]*transform:translateX\(-50%\);/s);
  for (const position of ["15.5%", "32.8%", "49.8%", "66.7%", "84.9%"]) assert.match(css, new RegExp(`left:${position.replace(".", "\\.")}`));
  assert.match(css, /\.about-loop-step-1\s*\{\s*transform:translate\(-55%,-10%\);/);
  assert.match(css, /\.about-loop-step-2\s*\{\s*transform:translate\(-55%,-5%\);/);
  assert.match(css, /\.about-loop-step-3\s*\{\s*transform:translate\(-55%,-3%\);/);
  assert.match(css, /\.about-loop-step-4\s*\{\s*transform:translate\(-55%,-5%\);/);
  assert.match(css, /\.about-loop-step-5\s*\{\s*transform:translateX\(-60%\);/);
  assert.match(css, /\.about-loop>img\s*\{[^}]*object-position:-1% -1%;[^}]*transform:scale\(1\.02\);/s);
});
