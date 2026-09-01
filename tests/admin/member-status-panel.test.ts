import assert from "node:assert/strict";
import test from "node:test";
import { JSDOM } from "jsdom";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { MemberStatusPanel } from "../../components/admin/MemberStatusPanel";

const member = {
  id: "member-1", nickname: "小鱼", realName: "王小鱼", email: "fish@example.com",
  school: "中山大学", campus: "南校园", city: "广州", major: "计算机", grade: "2025级",
  intro: "正在做校园 AI 项目。", skills: ["AI应用"], interests: ["校园共建"], roles: ["活动共建者"],
  workLinks: ["https://example.com/work"], currentFocus: "智能体", canOffer: "产品设计", wantsToMeet: "开发者",
  slug: "fish-member-1", status: "active", publishStatus: "published", verifiedBuilder: true,
  adminManaged: false, createdAt: "2026-09-01",
};

test("member cards expose stored identity and profile details to administrators", () => {
  const html = renderToStaticMarkup(createElement(MemberStatusPanel, { members: [member] }));
  for (const value of ["王小鱼", "fish@example.com", "中山大学", "南校园", "计算机", "2025级", "正在做校园 AI 项目。", "AI应用", "智能体", "member-1"]) {
    assert.match(html, new RegExp(value));
  }
  assert.match(html, /查看完整资料/);
  assert.match(html, /删除成员/);
});

test("successful actions update the same member row and show inline feedback", async () => {
  const dom = new JSDOM('<div id="root"></div>', { url: "https://example.test/admin/members" });
  Object.assign(globalThis, {
    window: dom.window, document: dom.window.document, HTMLElement: dom.window.HTMLElement,
    Node: dom.window.Node, Event: dom.window.Event, MouseEvent: dom.window.MouseEvent,
    IS_REACT_ACT_ENVIRONMENT: true,
    fetch: async () => Response.json({ memberId: "member-1", status: "hidden" }),
  });
  const root = createRoot(document.querySelector("#root")!);
  await act(async () => root.render(createElement(MemberStatusPanel, { members: [member] })));

  const hide = [...document.querySelectorAll("button")].find((button) => button.textContent === "隐藏资料") as HTMLButtonElement;
  await act(async () => hide.click());

  const row = document.querySelector('[data-member-id="member-1"]')!;
  assert.match(row.textContent ?? "", /已隐藏/);
  assert.match(row.textContent ?? "", /已隐藏小鱼的资料/);
  assert.equal(row.querySelector('[role="status"]')?.getAttribute("data-tone"), "success");
  await act(async () => root.unmount());
  dom.window.close();
});

test("failed actions keep the current status and show the API error in the same row", async () => {
  const dom = new JSDOM('<div id="root"></div>', { url: "https://example.test/admin/members" });
  Object.assign(globalThis, {
    window: dom.window, document: dom.window.document, HTMLElement: dom.window.HTMLElement,
    Node: dom.window.Node, Event: dom.window.Event, MouseEvent: dom.window.MouseEvent,
    IS_REACT_ACT_ENVIRONMENT: true,
    fetch: async () => Response.json({ error: "数据库暂时不可用" }, { status: 503 }),
  });
  const root = createRoot(document.querySelector("#root")!);
  await act(async () => root.render(createElement(MemberStatusPanel, { members: [member] })));

  const suspend = [...document.querySelectorAll("button")].find((button) => button.textContent === "暂停账号") as HTMLButtonElement;
  await act(async () => suspend.click());

  const row = document.querySelector('[data-member-id="member-1"]')!;
  assert.match(row.textContent ?? "", /正常/);
  assert.equal(row.querySelector('[role="alert"]')?.textContent, "数据库暂时不可用");
  assert.equal(row.querySelector('[role="alert"]')?.getAttribute("data-tone"), "error");
  await act(async () => root.unmount());
  dom.window.close();
});
