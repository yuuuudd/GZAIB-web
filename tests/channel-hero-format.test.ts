import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("the four channel heroes use their approved copy and layout", async () => {
  const [home, map, square, events, about, css] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../components/map/BuilderMap.tsx", import.meta.url), "utf8"),
    readFile(new URL("../components/co-create/CoCreateSquare.tsx", import.meta.url), "utf8"),
    readFile(new URL("../components/content-hub/EventDirectory.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/about/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);

  assert.match(map, /探索高校能量，发现同频伙伴/);
  assert.match(map, /<a className="map-light-avatar-action" href="\/apply">点亮我的头像/);
  assert.match(map, /看见正在行动的高校与共建者，<br \/>让每一束光连接成更大的创造力网络。/);
  assert.match(home, /以 AI 为共同议题，以高校青年为主要参与者。<br \/>连接人、想法与行动，<br \/>让一次相遇，成为下一次共创的开始。/);
  assert.match(square, /让每一个想法/);
  assert.match(square, /找到同行者/);
  assert.match(square, /广州AI共创社 · 共创广场/);
  assert.match(events, /className="event-hero-row"/);
  assert.match(events, /让每一次相遇，都成为共创的开始。/);
  assert.match(about, /CO-CREATION ARCHIVE · 共创档案/);
  assert.match(about, /留下<em>共创的痕迹<\/em>/);
  assert.match(css, /\.map-heading-row h2\s*\{[^}]*letter-spacing:\.05em;[^}]*white-space:nowrap;/s);
  assert.match(css, /\.map-light-avatar-action\s*\{[^}]*border-radius:999px;[^}]*background:var\(--cobalt\);[^}]*color:#fff;/s);
  assert.match(css, /\.event-hero-row h1\s*\{[^}]*font-family:var\(--font-source-han-serif\)[^}]*letter-spacing:\.05em;[^}]*white-space:nowrap;/s);
  assert.match(css, /\.event-hero-row\s*\{\s*display:block;\s*margin-top:\.35rem;/);
  assert.match(css, /\.co-create-hero-copy h1\s*\{[^}]*font-family:var\(--font-source-han-serif\)[^}]*letter-spacing:\.05em;/s);
});
