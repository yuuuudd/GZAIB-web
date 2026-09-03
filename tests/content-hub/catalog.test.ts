import assert from "node:assert/strict";
import test from "node:test";
import {
  EVENT_LOCATIONS,
  EVENT_TYPES,
  NEWS_CATEGORIES,
  eventItems,
  filterEvents,
  filterNews,
  newsItems,
} from "../../features/content-hub/catalog";

test("content hub exposes the approved filter vocabularies", () => {
  assert.deepEqual(NEWS_CATEGORIES, ["全部", "AI 应用", "模型动态", "产业观察", "开源工具", "教育实践"]);
  assert.deepEqual(EVENT_TYPES, ["全部", "比赛赛事", "黑客松", "分享会", "工作坊", "展会"]);
  assert.deepEqual(EVENT_LOCATIONS, ["全部", "广州", "广东", "线上", "全国"]);
});

test("news catalog contains the seven approved sourced stories", () => {
  assert.equal(newsItems.length, 7);
  assert.equal(filterNews(newsItems, "全部").length, 7);
  assert.ok(filterNews(newsItems, "开源工具").some((item) => item.title.includes("Hy3")));
  assert.ok(newsItems.every((item) => item.source && item.publishedLabel));
});

test("event filters combine approved type and region without changing time groups", () => {
  assert.equal(eventItems.length, 7);
  const filtered = filterEvents(eventItems, "黑客松", "广东");
  assert.ok(filtered.length >= 2);
  assert.ok(filtered.every((item) => item.type === "黑客松" && item.locations.includes("广东")));
  assert.ok(filtered.every((item) => ["本周进行", "即将开始", "长期征集"].includes(item.group)));
});

test("event location filter can include every region", () => {
  assert.equal(filterEvents(eventItems, "全部", "全部").length, eventItems.length);
});

test("published catalogs use safe sources and exclude the three withheld names", () => {
  for (const item of [...newsItems, ...eventItems]) assert.equal(new URL(item.url).protocol, "https:");
  const text = JSON.stringify({ newsItems, eventItems });
  assert.doesNotMatch(text, /深客松|肇客松|莞客松/);
});
