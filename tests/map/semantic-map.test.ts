import assert from "node:assert/strict";
import test from "node:test";
import type { DirectorySchool } from "../../features/directory/service";
import {
  DEFAULT_CITY,
  citiesForProvince,
  groupSchoolsByCity,
  groupSchoolsByProvince,
  resolveActiveCity,
  semanticLevelForZoom,
  schoolsForCity,
} from "../../features/map/semantic-map";

function school(overrides: Partial<DirectorySchool> & Pick<DirectorySchool, "id" | "name" | "city">): DirectorySchool {
  return {
    campus: "",
    province: "广东",
    lng: 113.2644,
    lat: 23.1291,
    memberCount: 1,
    previewMembers: [],
    ...overrides,
  };
}

test("groups filtered schools into normalized city totals", () => {
  const summaries = groupSchoolsByCity([
    school({ id: "sysu", name: "中山大学", city: "广州市", memberCount: 3, lng: 113.298, lat: 23.096 }),
    school({ id: "scut", name: "华南理工大学", city: "广州", memberCount: 2, lng: 113.344, lat: 23.157 }),
    school({ id: "szu", name: "深圳大学", city: "深圳市", memberCount: 4, lng: 113.93, lat: 22.53 }),
  ]);

  assert.deepEqual(summaries.map(({ city, memberCount, schoolCount }) => ({ city, memberCount, schoolCount })), [
    { city: "广州", memberCount: 5, schoolCount: 2 },
    { city: "深圳", memberCount: 4, schoolCount: 1 },
  ]);
  assert.equal(summaries[0]?.center.lng, (113.298 * 3 + 113.344 * 2) / 5);
  assert.equal(summaries[0]?.center.lat, (23.096 * 3 + 23.157 * 2) / 5);
});

test("uses a stable fallback center when a city school coordinate is invalid", () => {
  const [summary] = groupSchoolsByCity([
    school({ id: "bad", name: "待定位学校", city: "中山市", lng: Number.NaN, lat: 0 }),
  ]);

  assert.deepEqual(summary?.center, { lng: 113.3928, lat: 22.5176 });
});

test("keeps valid school coordinates across China for national city pins", () => {
  const [summary] = groupSchoolsByCity([
    school({ id: "pku", name: "北京大学", city: "北京市", lng: 116.3109, lat: 39.9928 }),
  ]);

  assert.deepEqual(summary?.center, { lng: 116.3109, lat: 39.9928 });
});

test("groups Wuhan University under Hubei instead of Guangdong", () => {
  const provinces = groupSchoolsByProvince([
    school({ id: "sysu", name: "中山大学", province: "广东", city: "广州", memberCount: 3 }),
    school({ id: "whu", name: "武汉大学", province: "湖北省", city: "武汉市", memberCount: 2, lng: 114.365, lat: 30.536 }),
  ]);

  assert.deepEqual(provinces.map(({ province, memberCount, schoolCount, cityCount }) => ({ province, memberCount, schoolCount, cityCount })), [
    { province: "广东", memberCount: 3, schoolCount: 1, cityCount: 1 },
    { province: "湖北", memberCount: 2, schoolCount: 1, cityCount: 1 },
  ]);
  assert.deepEqual(citiesForProvince(provinces, "湖北省").map(({ city }) => city), ["武汉"]);
});

test("keeps Guangzhou as the default and preserves an explicitly selected empty city", () => {
  const summaries = groupSchoolsByCity([
    school({ id: "szu", name: "深圳大学", city: "深圳市" }),
  ]);

  assert.equal(DEFAULT_CITY, "广州");
  assert.equal(resolveActiveCity(undefined, summaries), "广州");
  assert.equal(resolveActiveCity("珠海市", summaries), "珠海");
  assert.deepEqual(schoolsForCity(summaries, "珠海"), []);
});

test("switches to the Guangdong overview only after zooming out past the semantic threshold", () => {
  assert.equal(semanticLevelForZoom(10.5), "city");
  assert.equal(semanticLevelForZoom(9.25), "city");
  assert.equal(semanticLevelForZoom(9.24), "province");
  assert.equal(semanticLevelForZoom(7), "province");
  assert.equal(semanticLevelForZoom(4.8), "country");
});
