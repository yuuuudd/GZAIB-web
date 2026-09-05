import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { handleCreateCoCreateProject } from "../../app/api/co-create-projects/route";
import { handleUpdateCoCreateProject } from "../../app/api/co-create-projects/[id]/route";
import { CoCreateProjectForm } from "../../components/co-create/CoCreateProjectForm";
import { MyCoCreateProjects } from "../../components/co-create/MyCoCreateProjects";

const project = {
  title: "校园知识库 AI 原型小组", type: "项目共创", scope: "跨校", status: "组队中",
  summary: "用一周时间做出一个面向学生社团的 AI 知识库原型。",
  details: "先访谈社团负责人，再完成可检索、可演示的网页原型。",
  problem: "社团资料分散，新成员很难快速找到可靠答案。",
  roles: "产品 1 名、前端 1 名、视觉设计 1 名", effort: "每周约 3 小时",
  deadline: "2026-09-15", level: "需要经验",
} as const;

function request(body: unknown) {
  return new Request("https://site.test/api/co-create-projects", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
}

test("creating a project derives its owner from the authenticated session", async () => {
  let saved: Record<string, unknown> | undefined;
  const response = await handleCreateCoCreateProject(request({ ...project, ownerUserId: "attacker" }), {
    resolveUserId: async () => "member-1",
    create: async (input) => { saved = input; return { id: input.id, publishStatus: "published" }; },
    id: () => "project-1", now: () => 100,
  });
  assert.equal(response.status, 201);
  assert.equal(saved?.ownerUserId, "member-1");
  assert.equal(saved?.publishStatus, undefined);
});

test("creating a project requires login", async () => {
  const response = await handleCreateCoCreateProject(request(project), {
    resolveUserId: async () => null, create: async () => { throw new Error("must not save"); }, id: () => "project-1", now: () => 100,
  });
  assert.equal(response.status, 401);
});

test("updating returns not found when the project is not owned by the session", async () => {
  const response = await handleUpdateCoCreateProject(request(project), "project-1", {
    resolveUserId: async () => "member-2", updateOwned: async () => false, setPublishStatusOwned: async () => false, now: () => 200,
  });
  assert.equal(response.status, 404);
});

test("owners can archive and republish without deleting a project", async () => {
  const statuses: string[] = [];
  const dependencies = {
    resolveUserId: async () => "member-1", updateOwned: async () => true,
    setPublishStatusOwned: async (_id: string, _owner: string, status: "published" | "archived") => { statuses.push(status); return true; }, now: () => 200,
  };
  assert.equal((await handleUpdateCoCreateProject(request({ action: "archive" }), "project-1", dependencies)).status, 200);
  assert.equal((await handleUpdateCoCreateProject(request({ action: "publish" }), "project-1", dependencies)).status, 200);
  assert.deepEqual(statuses, ["archived", "published"]);
});

test("the project form collects every public detail and states immediate publication", () => {
  const html = renderToStaticMarkup(createElement(CoCreateProjectForm));
  for (const name of ["title", "type", "scope", "status", "summary", "details", "problem", "roles", "effort", "deadline", "level"]) {
    assert.match(html, new RegExp(`name="${name}"`));
  }
  assert.match(html, /发布后将立即出现在共创广场/);
});

test("my projects offers edit and the reversible action for each publication state", () => {
  const base = { id: "open", ownerUserId: "member-1", ...project, publishStatus: "published" as const, createdAt: 1, updatedAt: 1 };
  const html = renderToStaticMarkup(createElement(MyCoCreateProjects, { projects: [base, { ...base, id: "hidden", title: "已下架项目", publishStatus: "archived" }] }));
  assert.match(html, /href="\/me\/co-creates\/open\/edit"/);
  assert.match(html, /下架/);
  assert.match(html, /重新公开/);
});
