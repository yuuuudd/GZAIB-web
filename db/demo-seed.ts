import type { getDb } from ".";
import {
  applications,
  auditLogs,
  communities,
  communityManagers,
  communityUpdates,
  contributions,
  memberProfiles,
  profileVisibility,
  schools,
  users,
} from "./schema";

type DemoSeed = {
  schools: (typeof schools.$inferInsert)[];
  users: (typeof users.$inferInsert)[];
  applications: (typeof applications.$inferInsert)[];
  profiles: (typeof memberProfiles.$inferInsert)[];
  visibility: (typeof profileVisibility.$inferInsert)[];
  contributions: (typeof contributions.$inferInsert)[];
  communities: (typeof communities.$inferInsert)[];
  communityManagers: (typeof communityManagers.$inferInsert)[];
  communityUpdates: (typeof communityUpdates.$inferInsert)[];
  audit: typeof auditLogs.$inferInsert;
};

export type DemoSeedCounts = {
  schools: number;
  users: number;
  applications: number;
  profiles: number;
  visibility: number;
  contributions: number;
  communities: number;
  managers: number;
  updates: number;
  audits: number;
};

export type DemoSeedRepository = {
  seed(seed: DemoSeed): Promise<DemoSeedCounts>;
};

const D1_PARAMETER_LIMIT = 100;

/** Plans multi-row inserts without crossing D1's per-statement bind limit. */
export function chunkRowsByD1ParameterLimit<T extends Record<string, unknown>>(rows: T[]): T[][] {
  const chunks: T[][] = [];
  let current: T[] = [];
  let parameters = 0;
  for (const row of rows) {
    const rowParameters = Object.keys(row).length;
    if (rowParameters > D1_PARAMETER_LIMIT) throw new Error("Demo seed row exceeds D1 parameter limit");
    if (current.length > 0 && parameters + rowParameters > D1_PARAMETER_LIMIT) {
      chunks.push(current);
      current = [];
      parameters = 0;
    }
    current.push(row);
    parameters += rowParameters;
  }
  if (current.length > 0) chunks.push(current);
  return chunks;
}

const seedTime = Date.UTC(2026, 7, 29, 12, 0, 0);
const requiredVisibility = ["nickname", "avatarUrl", "school", "city", "intro", "skills", "roles", "verifiedBuilder", "contributions"] as const;
const optionalVisibility = ["currentFocus", "canOffer", "wantsToMeet", "workLinks", "major", "grade"] as const;

const demoSchools: DemoSeed["schools"] = [
  ["demo-seed-school-guangzhou-1", "岭南未来大学（演示虚构）", "共创校区", "广州", 113_264_400, 23_129_100],
  ["demo-seed-school-guangzhou-2", "珠江创意学院（演示虚构）", "南岸校区", "广州", 113_319_000, 23_106_200],
  ["demo-seed-school-shenzhen", "湾区智能大学（演示虚构）", "深圳校区", "深圳", 114_057_900, 22_543_100],
  ["demo-seed-school-foshan", "南粤工程学院（演示虚构）", "佛山校区", "佛山", 113_121_400, 23_021_500],
  ["demo-seed-school-zhuhai", "海湾青年学院（演示虚构）", "珠海校区", "珠海", 113_576_700, 22_270_700],
  ["demo-seed-school-dongguan", "松山湖创新大学（演示虚构）", "湖畔校区", "东莞", 113_751_800, 23_020_700],
].map(([id, name, campus, city, longitude, latitude]) => ({
  id: id as string,
  name: name as string,
  campus: campus as string,
  city: city as string,
  longitude: longitude as number,
  latitude: latitude as number,
  coordinateStatus: "confirmed",
  createdAt: seedTime,
  updatedAt: seedTime,
}));

const memberUsers: DemoSeed["users"] = Array.from({ length: 12 }, (_, index) => ({
  id: `demo-seed-member-${String(index + 1).padStart(2, "0")}`,
  email: `fictional-builder-${String(index + 1).padStart(2, "0")}@builder-map.invalid`,
  role: "member" as const,
  status: "active" as const,
  createdAt: seedTime + index,
  updatedAt: seedTime + index,
}));

const pendingUser: DemoSeed["users"][number] = {
  id: "demo-seed-pending-01",
  email: "fictional-pending-01@builder-map.invalid",
  role: "member",
  status: "active",
  createdAt: seedTime,
  updatedAt: seedTime,
};

const connectionDemoUsers: DemoSeed["users"] = [
  { id: "demo-member", email: "demo-member@builder-map.invalid", role: "member", status: "active", createdAt: seedTime, updatedAt: seedTime },
  { id: "demo-peer", email: "demo-peer@builder-map.invalid", role: "member", status: "active", createdAt: seedTime + 1, updatedAt: seedTime + 1 },
];

const allPublicVisibility = Object.fromEntries(requiredVisibility.map((field) => [field, "public"]));
const applicationVisibility = { ...allPublicVisibility, ...Object.fromEntries(optionalVisibility.map((field) => [field, "private"])) };

const approvedApplications: DemoSeed["applications"] = memberUsers.map((user, index) => ({
  id: `demo-seed-application-${String(index + 1).padStart(2, "0")}`,
  userId: user.id,
  status: "approved",
  nickname: `演示共建者${String(index + 1).padStart(2, "0")}（虚构）`,
  realName: null,
  avatarKey: null,
  schoolId: demoSchools[index % demoSchools.length]!.id,
  major: null,
  grade: null,
  intro: `这是第 ${index + 1} 位完全虚构的演示共建者，用于展示公开目录与跨校协作。`,
  currentFocus: null,
  canOffer: null,
  wantsToMeet: null,
  skillsJson: JSON.stringify(index % 2 === 0 ? ["AI应用", "产品设计"] : ["内容创作", "活动策划"]),
  interestsJson: JSON.stringify(["校园共建", "人工智能"]),
  rolesJson: JSON.stringify(["活动共建者"]),
  workLinksJson: "[]",
  visibilityJson: JSON.stringify(applicationVisibility),
  consentVersion: "builder-map-2026-08-29",
  consentAcceptedAt: seedTime,
  submittedAt: seedTime,
  reviewedAt: seedTime,
  reviewedBy: "demo-admin",
  reviewReason: null,
  createdAt: seedTime + index,
  updatedAt: seedTime + index,
}));

const pendingApplication: DemoSeed["applications"][number] = {
  id: "demo-seed-application-pending-01",
  userId: pendingUser.id,
  status: "pending",
  nickname: "待审核演示申请者（虚构）",
  realName: null,
  avatarKey: null,
  schoolId: demoSchools[0]!.id,
  major: null,
  grade: null,
  intro: "这是完全虚构的待审核申请，仅用于展示运营审核流程与隐私边界。",
  currentFocus: null,
  canOffer: null,
  wantsToMeet: null,
  skillsJson: JSON.stringify(["AI应用"]),
  interestsJson: JSON.stringify(["校园共建"]),
  rolesJson: JSON.stringify(["活动共建者"]),
  workLinksJson: "[]",
  visibilityJson: JSON.stringify(applicationVisibility),
  consentVersion: "builder-map-2026-08-29",
  consentAcceptedAt: seedTime,
  submittedAt: seedTime,
  reviewedAt: null,
  reviewedBy: null,
  reviewReason: null,
  createdAt: seedTime,
  updatedAt: seedTime,
};

const connectionDemoApplications: DemoSeed["applications"] = connectionDemoUsers.map((user, index) => ({
  id: `demo-connection-application-${index + 1}`,
  userId: user.id,
  status: "approved",
  nickname: index === 0 ? "共建者 A（演示虚构）" : "共建者 B（演示虚构）",
  realName: null,
  avatarKey: null,
  schoolId: demoSchools[index]!.id,
  major: null,
  grade: null,
  intro: index === 0 ? "用于完整演示连接申请与同意流程的虚构共建者 A。" : "用于完整演示连接申请与同意流程的虚构共建者 B。",
  currentFocus: null,
  canOffer: null,
  wantsToMeet: null,
  skillsJson: JSON.stringify(index === 0 ? ["AI应用", "产品设计"] : ["活动策划", "内容创作"]),
  interestsJson: JSON.stringify(["校园共建", "人工智能"]),
  rolesJson: JSON.stringify(["活动共建者"]),
  workLinksJson: "[]",
  visibilityJson: JSON.stringify(applicationVisibility),
  consentVersion: "builder-map-2026-08-29",
  consentAcceptedAt: seedTime,
  submittedAt: seedTime,
  reviewedAt: seedTime,
  reviewedBy: "demo-admin",
  reviewReason: null,
  createdAt: seedTime + index,
  updatedAt: seedTime + index,
}));

const confirmedProfileIndexes = new Set([0, 1, 2, 3, 4, 5]);
const demoProfiles: DemoSeed["profiles"] = memberUsers.map((user, index) => ({
  id: `demo-seed-profile-${String(index + 1).padStart(2, "0")}`,
  userId: user.id,
  slug: `demo-fictional-builder-${String(index + 1).padStart(2, "0")}`,
  nickname: approvedApplications[index]!.nickname,
  realName: null,
  avatarKey: null,
  schoolId: approvedApplications[index]!.schoolId,
  major: null,
  grade: null,
  intro: approvedApplications[index]!.intro,
  currentFocus: null,
  canOffer: null,
  wantsToMeet: null,
  skillsJson: approvedApplications[index]!.skillsJson,
  interestsJson: approvedApplications[index]!.interestsJson,
  rolesJson: approvedApplications[index]!.rolesJson,
  workLinksJson: "[]",
  publishStatus: "published",
  verifiedBuilder: confirmedProfileIndexes.has(index),
  publishedAt: seedTime,
  createdAt: seedTime + index,
  updatedAt: seedTime + index,
}));

const connectionDemoProfiles: DemoSeed["profiles"] = connectionDemoUsers.map((user, index) => ({
  id: `demo-connection-profile-${index + 1}`,
  userId: user.id,
  slug: index === 0 ? "demo-fictional-community-owner" : "peer",
  nickname: connectionDemoApplications[index]!.nickname,
  realName: null,
  avatarKey: null,
  schoolId: connectionDemoApplications[index]!.schoolId,
  major: null,
  grade: null,
  intro: connectionDemoApplications[index]!.intro,
  currentFocus: null,
  canOffer: null,
  wantsToMeet: null,
  skillsJson: connectionDemoApplications[index]!.skillsJson,
  interestsJson: connectionDemoApplications[index]!.interestsJson,
  rolesJson: connectionDemoApplications[index]!.rolesJson,
  workLinksJson: "[]",
  publishStatus: "published",
  verifiedBuilder: true,
  publishedAt: seedTime,
  createdAt: seedTime + index,
  updatedAt: seedTime + index,
}));

const demoVisibility: DemoSeed["visibility"] = [...demoProfiles, ...connectionDemoProfiles].flatMap((profile) => [
  ...requiredVisibility.map((fieldName) => ({
    id: `${profile.id}:${fieldName}`, profileId: profile.id, fieldName, visibility: "public" as const, updatedAt: seedTime,
  })),
  ...optionalVisibility.map((fieldName) => ({
    id: `${profile.id}:${fieldName}`, profileId: profile.id, fieldName, visibility: "private" as const, updatedAt: seedTime,
  })),
]);

const activityPairs = [
  ["demo-cross-campus-lab", "演示跨校原型实验室（虚构）", 0, 1],
  ["demo-ai-workshop", "演示校园 AI 工作坊（虚构）", 2, 3],
  ["demo-community-day", "演示共建开放日（虚构）", 4, 5],
] as const;
const demoContributions: DemoSeed["contributions"] = activityPairs.flatMap(([activityKey, title, left, right]) => [left, right].map((index) => ({
  id: `demo-seed-contribution-${activityKey}-${index + 1}`,
  profileId: demoProfiles[index]!.id,
  activityKey,
  title,
  activityDate: seedTime - (index + 1) * 86_400_000,
  role: "活动共建者",
  outcome: "共同完成一项仅用于产品展示的虚构校园共建成果。",
  publicSummary: "来自两所演示学校的虚构成员共同参与，形成一条公开的跨校协作连接。",
  visibility: "public" as const,
  status: "confirmed" as const,
  confirmedBy: "demo-admin",
  confirmedAt: seedTime,
  createdAt: seedTime,
  updatedAt: seedTime,
})));

const demoCommunities: DemoSeed["communities"] = [
  {
    id: "demo-community-guangzhou-ai-builders",
    slug: "demo-guangzhou-ai-builders",
    name: "广州 AI 共建者社群（演示虚构）",
    summary: "演示虚构：用于演练广州 AI 共建、社群关注与审核流程。",
    primaryCity: "广州",
    locationMode: "hybrid",
    focusTagsJson: JSON.stringify(["AI 应用", "产品共创"]),
    officialUrl: "https://demo-guangzhou-ai-builders.invalid",
    sourceUrl: "https://demo-guangzhou-ai-builders.invalid/about",
    sourceLabel: "演示虚构官方页",
    publishStatus: "published",
    publishedAt: seedTime,
    createdAt: seedTime,
    updatedAt: seedTime,
  },
  {
    id: "demo-community-shenzhen-agent-lab",
    slug: "demo-shenzhen-agent-lab",
    name: "深圳 Agent 实验室（演示虚构）",
    summary: "演示虚构：用于展示深圳城市级 Agent 实验与开发者交流。",
    primaryCity: "深圳",
    locationMode: "city",
    focusTagsJson: JSON.stringify(["Agent", "开发者"]),
    officialUrl: "https://demo-shenzhen-agent-lab.invalid",
    sourceUrl: "https://demo-shenzhen-agent-lab.invalid/about",
    sourceLabel: "演示虚构官方页",
    publishStatus: "published",
    publishedAt: seedTime,
    createdAt: seedTime,
    updatedAt: seedTime,
  },
  {
    id: "demo-community-online-ai-makers",
    slug: "demo-online-ai-makers",
    name: "线上 AI 制作者社群（演示虚构）",
    summary: "演示虚构：用于展示不生成城市点位的纯线上 AI 制作者社群。",
    primaryCity: null,
    locationMode: "online",
    focusTagsJson: JSON.stringify(["AI 创作", "开源"]),
    officialUrl: "https://demo-online-ai-makers.invalid",
    sourceUrl: "https://demo-online-ai-makers.invalid/about",
    sourceLabel: "演示虚构官方页",
    publishStatus: "published",
    publishedAt: seedTime,
    createdAt: seedTime,
    updatedAt: seedTime,
  },
];

const demoCommunityManagers: DemoSeed["communityManagers"] = demoCommunities.map((community) => ({
  communityId: community.id,
  userId: "demo-member",
  role: "owner",
  createdAt: community.createdAt,
}));

const demoCommunityUpdates: DemoSeed["communityUpdates"] = demoCommunities.map((community, index) => ({
  id: `demo-community-update-${index + 1}`,
  communityId: community.id,
  submitterUserId: "demo-member",
  title: `${community.name}首条动态`,
  summary: "演示虚构：这是一条经审核公开的社群动态，仅供本地演练。",
  occurredAt: seedTime - index * 86_400_000,
  sourceUrl: `${community.officialUrl}/updates/demo-1`,
  status: "published",
  submittedAt: seedTime,
  reviewedAt: seedTime,
  reviewedBy: "demo-admin",
  reviewReason: null,
  createdAt: seedTime,
  updatedAt: seedTime,
}));

export const DEMO_SEED: DemoSeed = {
  schools: demoSchools,
  users: [{
    id: "demo-admin", email: "demo-admin@builder-map.invalid", role: "admin", status: "active",
    createdAt: seedTime, updatedAt: seedTime,
  }, ...connectionDemoUsers, ...memberUsers, pendingUser],
  applications: [...connectionDemoApplications, ...approvedApplications, pendingApplication],
  profiles: [...connectionDemoProfiles, ...demoProfiles],
  visibility: demoVisibility,
  contributions: demoContributions,
  communities: demoCommunities,
  communityManagers: demoCommunityManagers,
  communityUpdates: demoCommunityUpdates,
  audit: {
    id: "demo-seed-audit-initialized", actorUserId: "demo-admin", targetType: "demo", targetId: "builder-map-demo-v1",
    action: "demo.seeded", diffJson: JSON.stringify({ dataset: "builder-map-demo-v1" }), createdAt: seedTime,
  },
};

export async function seedDemoData(adminId: string, repository: DemoSeedRepository, now: number): Promise<DemoSeedCounts> {
  if (adminId !== "demo-admin") throw new Error("Forbidden");
  return repository.seed({ ...DEMO_SEED, audit: { ...DEMO_SEED.audit, actorUserId: adminId, createdAt: now } });
}

type Db = ReturnType<typeof getDb>;

export function createDemoSeedRepository(db: Db): DemoSeedRepository {
  return {
    async seed(seed) {
      const statements = [
        ...chunkRowsByD1ParameterLimit(seed.schools).map((rows) => db.insert(schools).values(rows).onConflictDoNothing()),
        ...chunkRowsByD1ParameterLimit(seed.users).map((rows) => db.insert(users).values(rows).onConflictDoNothing()),
        ...chunkRowsByD1ParameterLimit(seed.communities).map((rows) => db.insert(communities).values(rows).onConflictDoNothing()),
        ...chunkRowsByD1ParameterLimit(seed.applications).map((rows) => db.insert(applications).values(rows).onConflictDoNothing()),
        ...chunkRowsByD1ParameterLimit(seed.profiles).map((rows) => db.insert(memberProfiles).values(rows).onConflictDoNothing()),
        ...chunkRowsByD1ParameterLimit(seed.visibility).map((rows) => db.insert(profileVisibility).values(rows).onConflictDoNothing()),
        ...chunkRowsByD1ParameterLimit(seed.contributions).map((rows) => db.insert(contributions).values(rows).onConflictDoNothing()),
        ...chunkRowsByD1ParameterLimit(seed.communityManagers).map((rows) => db.insert(communityManagers).values(rows).onConflictDoNothing()),
        ...chunkRowsByD1ParameterLimit(seed.communityUpdates).map((rows) => db.insert(communityUpdates).values(rows).onConflictDoNothing()),
        db.insert(auditLogs).values(seed.audit).onConflictDoNothing(),
      ];
      await db.batch(statements as [typeof statements[number], ...typeof statements[number][]]);
      return {
        schools: seed.schools.length,
        users: seed.users.length,
        applications: seed.applications.length,
        profiles: seed.profiles.length,
        visibility: seed.visibility.length,
        contributions: seed.contributions.length,
        communities: seed.communities.length,
        managers: seed.communityManagers.length,
        updates: seed.communityUpdates.length,
        audits: 1,
      };
    },
  };
}

export async function createRuntimeDemoSeedRepository(): Promise<DemoSeedRepository> {
  const { getDb } = await import(".");
  return createDemoSeedRepository(getDb());
}
