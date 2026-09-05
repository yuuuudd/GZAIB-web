import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import { drizzle } from "drizzle-orm/d1";
import { coCreateProjects, memberProfiles, users } from "../../db/schema";
import { validateCoCreateProject } from "../../features/co-create/projects";
import { createCoCreateProjectRepository } from "../../lib/db/repositories/co-create-projects";

class Statement {
  constructor(private database: DatabaseSync, private sql: string, private params: unknown[] = []) {}
  bind(...params: unknown[]) { return new Statement(this.database, this.sql, params); }
  async run() {
    const result = this.database.prepare(this.sql).run(...this.params as never[]);
    return { success: true, results: [], meta: { changes: Number(result.changes) } };
  }
  async all() {
    return { success: true, results: this.database.prepare(this.sql).all(...this.params as never[]), meta: { changes: 0 } };
  }
  async raw() {
    return (this.database.prepare(this.sql).all(...this.params as never[]) as Record<string, unknown>[]).map(Object.values);
  }
}

function testRepository() {
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec(`
    create table users (id text primary key, email text not null, role text not null default 'member', status text not null default 'active', created_at integer not null, updated_at integer not null);
    create table member_profiles (id text primary key, user_id text not null, slug text not null, nickname text not null, real_name text, avatar_key text, school_id text not null, major text, grade text, intro text not null, current_focus text, can_offer text, wants_to_meet text, skills_json text not null default '[]', interests_json text not null default '[]', roles_json text not null default '[]', work_links_json text not null default '[]', publish_status text not null, admin_managed integer not null default 0, verified_builder integer not null default 0, published_at integer, created_at integer not null, updated_at integer not null);
    create table co_create_projects (id text primary key, owner_user_id text not null, title text not null, type text not null, scope text not null, recruitment_status text not null, summary text not null, details text not null, problem text not null, roles text not null, effort text not null, deadline text, level text not null, publish_status text not null default 'published', created_at integer not null, updated_at integer not null);
  `);
  const adapter = { prepare: (sql: string) => new Statement(sqlite, sql), batch: async (statements: Statement[]) => Promise.all(statements.map((statement) => statement.run())) };
  const db = drizzle(adapter as never, { schema: { coCreateProjects, memberProfiles, users } });
  return { sqlite, repository: createCoCreateProjectRepository(db as never) };
}

const validInput = {
  title: "校园知识库 AI 原型小组",
  type: "项目共创",
  scope: "跨校",
  status: "组队中",
  summary: "用一周时间做出一个面向学生社团的 AI 知识库原型。",
  details: "先访谈社团负责人，再完成可检索、可演示的网页原型。",
  problem: "社团资料分散，新成员很难快速找到可靠答案。",
  roles: "产品 1 名、前端 1 名、视觉设计 1 名",
  effort: "每周约 3 小时",
  deadline: "2026-09-15",
  level: "需要经验",
} as const;

test("project validation accepts a complete project and trims its text", () => {
  const result = validateCoCreateProject({ ...validInput, title: `  ${validInput.title}  ` });
  assert.equal(result.ok, true);
  if (result.ok) assert.equal(result.value.title, validInput.title);
});

test("project validation rejects missing collaboration details", () => {
  const result = validateCoCreateProject({ ...validInput, problem: "", roles: "" });
  assert.equal(result.ok, false);
  if (!result.ok) assert.match(result.errors.join(" "), /问题|角色/);
});

test("public project queries omit archived projects and expose a published organizer", async () => {
  const { sqlite, repository } = testRepository();
  sqlite.exec(`
    insert into users values ('owner-1', 'owner@example.test', 'member', 'active', 1, 1);
    insert into member_profiles (id,user_id,slug,nickname,school_id,intro,publish_status,created_at,updated_at) values ('profile-1','owner-1','owner','发起人','school','介绍','published',1,1);
  `);
  await repository.create({ id: "open", ownerUserId: "owner-1", ...validInput, createdAt: 10, updatedAt: 10 });
  await repository.create({ id: "hidden", ownerUserId: "owner-1", ...validInput, title: "已下架", createdAt: 11, updatedAt: 11 });
  await repository.setPublishStatusOwned("hidden", "owner-1", "archived", 12);

  const rows = await repository.listPublished();
  assert.deepEqual(rows.map((row) => row.id), ["open"]);
  assert.equal(rows[0]?.organizerSlug, "owner");
  sqlite.close();
});

test("project updates are limited to their owner", async () => {
  const { sqlite, repository } = testRepository();
  sqlite.exec("insert into users values ('owner-1', 'owner@example.test', 'member', 'active', 1, 1)");
  await repository.create({ id: "project-1", ownerUserId: "owner-1", ...validInput, createdAt: 10, updatedAt: 10 });

  assert.equal(await repository.updateOwned("project-1", "stranger", { ...validInput, title: "被篡改" }, 20), false);
  assert.equal(await repository.updateOwned("project-1", "owner-1", { ...validInput, title: "本人更新" }, 21), true);
  assert.equal((await repository.listByOwner("owner-1"))[0]?.title, "本人更新");
  sqlite.close();
});
