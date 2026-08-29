import assert from "node:assert/strict";
import test from "node:test";
import { SQLiteSyncDialect } from "drizzle-orm/sqlite-core";
import { applications, memberProfiles, users } from "../../db/schema";
import { getPublishedProfileBySlug, listPublishedDirectory } from "../../lib/db/repositories/directory";
import { listApprovedContributions } from "../../lib/db/repositories/contributions";

const profileRow = {
  profile: {
    id: "profile-1",
    userId: "user-1",
    slug: "lin-tong-xue",
    nickname: "林同学",
    realName: "林真实姓名",
    avatarKey: "avatars/user-1/lin.webp",
    schoolId: "school-1",
    major: "传播学",
    grade: "大三",
    intro: "关注 AI 产品与教育",
    currentFocus: "为学生社群制作 AI 工具",
    canOffer: "产品原型评审",
    wantsToMeet: "教育创新者",
    skillsJson: '["产品设计"]',
    interestsJson: "[]",
    rolesJson: '["活动共建者"]',
    workLinksJson: '["https://example.com/lin"]',
    publishStatus: "published",
    verifiedBuilder: true,
    publishedAt: 1,
    createdAt: 1,
    updatedAt: 1,
  },
  school: {
    id: "school-1",
    name: "中山大学",
    campus: "主校区",
    city: "广州",
    longitude: 113000000,
    latitude: 23000000,
    coordinateStatus: "confirmed",
    createdAt: 1,
    updatedAt: 1,
  },
};

function directoryDb() {
  const rowsBuilder = {
    innerJoin: () => rowsBuilder,
    where: () => Promise.resolve([profileRow]),
  };
  const visibilityBuilder = {
    where: () => Promise.resolve([
      { fieldName: "nickname", visibility: "public" },
      { fieldName: "avatarUrl", visibility: "public" },
      { fieldName: "school", visibility: "public" },
      { fieldName: "city", visibility: "public" },
      { fieldName: "intro", visibility: "public" },
      { fieldName: "skills", visibility: "public" },
      { fieldName: "roles", visibility: "public" },
      { fieldName: "verifiedBuilder", visibility: "public" },
      { fieldName: "contributions", visibility: "public" },
      { fieldName: "currentFocus", visibility: "members" },
    ]),
  };

  return {
    select: (selection: Record<string, unknown>) => ({
      from: () => "profile" in selection ? rowsBuilder : visibilityBuilder,
    }),
  };
}

test("published directory repositories return a viewer-projected DTO", async () => {
  const db = directoryDb();
  const expected = {
    slug: "lin-tong-xue",
    nickname: "林同学",
    avatarUrl: "/api/avatars/avatars/user-1/lin.webp",
    school: "中山大学",
    city: "广州",
    intro: "关注 AI 产品与教育",
    skills: ["产品设计"],
    roles: ["活动共建者"],
    verifiedBuilder: true,
    contributions: [],
  };

  assert.deepEqual(await listPublishedDirectory(db as never, {}, { kind: "visitor" }), [expected]);
  assert.deepEqual(await getPublishedProfileBySlug(db as never, "lin-tong-xue", { kind: "visitor" }), expected);
});

test("approved contribution query requires an approved active published profile", async () => {
  const joins: unknown[] = [];
  let condition: unknown;
  const builder = {
    innerJoin: (table: unknown) => {
      joins.push(table);
      return builder;
    },
    where: (where: unknown) => {
      condition = where;
      return Promise.resolve([]);
    },
  };
  const db = { select: () => ({ from: () => builder }) };

  assert.deepEqual(await listApprovedContributions(db as never, "profile-1"), []);
  for (const table of [memberProfiles, users, applications]) {
    assert.ok(joins.includes(table));
  }

  const query = new SQLiteSyncDialect().sqlToQuery(condition as never);
  assert.match(query.sql, /"applications"\."status" = \?/);
  assert.match(query.sql, /"users"\."status" = \?/);
  assert.match(query.sql, /"member_profiles"\."publish_status" = \?/);
  assert.ok(query.params.includes("approved"));
  assert.ok(query.params.includes("active"));
  assert.ok(query.params.includes("published"));
});
