import assert from "node:assert/strict";
import test from "node:test";
import { GET } from "../../app/api/school-emblem/route";

test("automatic emblems match exact schools, share a daily catalogue, and survive refresh failures", async () => {
  const originalFetch = globalThis.fetch;
  const originalNow = Date.now;
  let now = 1_000;
  let calls = 0;
  let unavailable = false;
  const entries = [
    { name: "广州大学", school_id: "293" },
    { name: "北京师范大学(珠海校区)", school_id: "3015" },
    { name: "北京师范大学", school_id: "46" },
    { name: "无效学校", school_id: "https://example.com" },
  ];
  const request = (name: string) => GET(new Request(`https://gzaibuilders.cn/api/school-emblem?name=${encodeURIComponent(name)}`));
  globalThis.fetch = async (input) => {
    calls++;
    assert.equal(String(input), "https://static-data.gaokao.cn/www/2.0/school/name.json");
    if (unavailable) throw new Error("upstream unavailable");
    return Response.json({ data: entries });
  };
  Date.now = () => now;
  try {
    assert.equal((await request("")).status, 400);
    assert.equal((await request("校".repeat(101))).status, 400);
    assert.equal(calls, 0);
    unavailable = true;
    assert.equal((await request("广州大学")).status, 503);
    unavailable = false;
    now += 300_001;
    calls = 0;
    const [first, campus] = await Promise.all([request("广州大学"), request(" 广州大学（大学城校区） ")]);
    assert.equal(first.status, 302);
    assert.equal(first.headers.get("location"), "https://static-data.gaokao.cn/upload/logo/293.jpg");
    assert.equal(campus.headers.get("location"), first.headers.get("location"));
    assert.equal(calls, 1);
    assert.match(first.headers.get("cache-control")!, /max-age=86400/);
    assert.equal((await request("北京师范大学（珠海校区）")).headers.get("location"), "https://static-data.gaokao.cn/upload/logo/3015.jpg");
    for (const name of ["广州大学新华学院", "新学校", "无效学校", "广州大学(独立学院)"]) {
      assert.equal((await request(name)).status, 404);
    }
    entries.push({ name: "新学校", school_id: "4000" });
    now += 86_400_001;
    assert.equal((await request("新学校")).headers.get("location"), "https://static-data.gaokao.cn/upload/logo/4000.jpg");
    assert.equal(calls, 2);
    unavailable = true;
    now += 86_400_001;
    assert.equal((await request("广州大学")).status, 302);
    assert.equal(calls, 3);
    assert.equal((await request("广州大学")).status, 302);
    assert.equal(calls, 3);
  } finally {
    globalThis.fetch = originalFetch;
    Date.now = originalNow;
  }
});
