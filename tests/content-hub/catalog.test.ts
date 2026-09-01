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
  type EventGroup,
} from "../../features/content-hub/catalog";

test("catalog vocabularies match the approved filter choices", () => {
  assert.deepEqual(NEWS_CATEGORIES, ["全部", "AI 应用", "模型动态", "产业观察", "开源工具", "教育实践"]);
  assert.deepEqual(EVENT_TYPES, ["全部", "比赛赛事", "黑客松", "分享会", "工作坊", "展会"]);
  assert.deepEqual(EVENT_LOCATIONS, ["广州", "广东", "线上", "全国"]);
});

test("news filters preserve the whole catalog or select one exact category", () => {
  assert.ok(newsItems.length >= 6);
  assert.deepEqual(filterNews(newsItems, "全部"), newsItems);

  const openSourceNews = filterNews(newsItems, "开源工具");
  assert.ok(openSourceNews.length >= 1);
  assert.ok(openSourceNews.every((item) => item.category === "开源工具"));
});

test("event filters require both the selected type and exact location", () => {
  const approvedGroups: EventGroup[] = ["本周进行", "即将开始", "长期征集"];
  assert.ok(eventItems.length >= 4);

  const workshops = filterEvents(eventItems, "工作坊", "广州");
  assert.ok(workshops.length >= 1);
  assert.ok(workshops.every((item) => item.type === "工作坊" && item.locations.includes("广州")));
  assert.ok(workshops.every((item) => approvedGroups.includes(item.group)));
});

test("all example catalog links use HTTPS", () => {
  for (const item of [...newsItems, ...eventItems]) {
    assert.equal(new URL(item.url).protocol, "https:");
  }
});
