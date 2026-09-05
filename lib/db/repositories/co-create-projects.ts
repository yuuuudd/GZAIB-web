import { and, desc, eq, inArray } from "drizzle-orm";
import type { getDb } from "../../../db";
import { coCreateProjects, memberProfiles, users } from "../../../db/schema";
import type { CoCreateProjectInput } from "../../../features/co-create/projects";

type Db = ReturnType<typeof getDb>;
type NewProject = CoCreateProjectInput & { id: string; ownerUserId: string; createdAt: number; updatedAt: number };

const projectFields = {
  id: coCreateProjects.id,
  ownerUserId: coCreateProjects.ownerUserId,
  title: coCreateProjects.title,
  type: coCreateProjects.type,
  participationMode: coCreateProjects.scope,
  status: coCreateProjects.recruitmentStatus,
  summary: coCreateProjects.summary,
  details: coCreateProjects.details,
  problem: coCreateProjects.problem,
  roles: coCreateProjects.roles,
  effort: coCreateProjects.effort,
  deadline: coCreateProjects.deadline,
  location: coCreateProjects.location,
  locationTbd: coCreateProjects.locationTbd,
  startsAt: coCreateProjects.startsAt,
  endsAt: coCreateProjects.endsAt,
  timeTbd: coCreateProjects.timeTbd,
  publishStatus: coCreateProjects.publishStatus,
  createdAt: coCreateProjects.createdAt,
  updatedAt: coCreateProjects.updatedAt,
};

function values(input: CoCreateProjectInput) {
  return {
    title: input.title, type: input.type, scope: input.participationMode, recruitmentStatus: input.status,
    summary: input.summary, details: input.details, problem: input.problem, roles: input.roles,
    effort: input.effort, deadline: input.deadline ?? null, level: "新手友好" as const,
    location: input.location ?? null, locationTbd: input.locationTbd,
    startsAt: input.startsAt ?? null, endsAt: input.endsAt ?? null, timeTbd: input.timeTbd,
  };
}

export function createCoCreateProjectRepository(db: Db) {
  return {
    async listPublished() {
      return db.select({ ...projectFields, organizer: memberProfiles.nickname, organizerSlug: memberProfiles.slug })
        .from(coCreateProjects)
        .innerJoin(memberProfiles, eq(memberProfiles.userId, coCreateProjects.ownerUserId))
        .innerJoin(users, eq(users.id, coCreateProjects.ownerUserId))
        .where(and(
          eq(coCreateProjects.publishStatus, "published"),
          eq(memberProfiles.publishStatus, "published"),
          inArray(users.status, ["active", "connection_suspended"]),
        )).orderBy(desc(coCreateProjects.updatedAt), desc(coCreateProjects.id));
    },
    async findPublicById(id: string) {
      const rows = await db.select({ ...projectFields, organizer: memberProfiles.nickname, organizerSlug: memberProfiles.slug })
        .from(coCreateProjects)
        .innerJoin(memberProfiles, eq(memberProfiles.userId, coCreateProjects.ownerUserId))
        .innerJoin(users, eq(users.id, coCreateProjects.ownerUserId))
        .where(and(eq(coCreateProjects.id, id), eq(coCreateProjects.publishStatus, "published"), eq(memberProfiles.publishStatus, "published"), inArray(users.status, ["active", "connection_suspended"])));
      return rows[0];
    },
    listByOwner(ownerUserId: string) {
      return db.select(projectFields).from(coCreateProjects).where(eq(coCreateProjects.ownerUserId, ownerUserId)).orderBy(desc(coCreateProjects.updatedAt));
    },
    async findOwnedById(id: string, ownerUserId: string) {
      const rows = await db.select(projectFields).from(coCreateProjects).where(and(eq(coCreateProjects.id, id), eq(coCreateProjects.ownerUserId, ownerUserId)));
      return rows[0];
    },
    async create(input: NewProject) {
      await db.insert(coCreateProjects).values({ id: input.id, ownerUserId: input.ownerUserId, ...values(input), publishStatus: "published", createdAt: input.createdAt, updatedAt: input.updatedAt });
      return { id: input.id, publishStatus: "published" as const };
    },
    async updateOwned(id: string, ownerUserId: string, input: CoCreateProjectInput, updatedAt: number) {
      const rows = await db.update(coCreateProjects).set({ ...values(input), updatedAt }).where(and(eq(coCreateProjects.id, id), eq(coCreateProjects.ownerUserId, ownerUserId))).returning({ id: coCreateProjects.id });
      return rows.length === 1;
    },
    async setPublishStatusOwned(id: string, ownerUserId: string, publishStatus: "published" | "archived", updatedAt: number) {
      const rows = await db.update(coCreateProjects).set({ publishStatus, updatedAt }).where(and(eq(coCreateProjects.id, id), eq(coCreateProjects.ownerUserId, ownerUserId))).returning({ id: coCreateProjects.id });
      return rows.length === 1;
    },
  };
}
