import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("community pages expose the lightweight profile actions and no vanity leaderboard", () => {
  const source = readFileSync("components/communities/CommunityProfile.tsx", "utf8");
  assert.match(source, /关注社群/);
  assert.match(source, /官方入口/);
  assert.match(source, /联系负责人/);
  assert.doesNotMatch(source, /排行榜|活跃指数|成员总数/);
});

test("community pages keep the directory form and public profile boundaries", () => {
  const directory = readFileSync("components/communities/CommunityDirectory.tsx", "utf8");
  const profile = readFileSync("components/communities/CommunityProfile.tsx", "utf8");
  const actions = readFileSync("components/communities/CommunityActions.tsx", "utf8");

  for (const field of ["q", "city", "locationMode", "focus"]) assert.match(directory, new RegExp(`name=["']${field}["']`));
  assert.match(directory, /method="get"/i);
  assert.match(directory, /暂时没有匹配的社群/);
  assert.match(profile, /活动与赛事即将接入/);
  assert.doesNotMatch(profile, /reviewReason|submitterId|reviewerId/);
  assert.match(actions, /followEnabled/);
  assert.match(actions, /暂未开放关注/);
});

test("community directory query normalization selects the first repeated supported value", () => {
  const page = readFileSync("app/communities/page.tsx", "utf8");
  assert.match(page, /string \| string\[\] \| undefined/);
  assert.match(page, /Array\.isArray\(raw\) \? raw\[0\] : raw/);
});
