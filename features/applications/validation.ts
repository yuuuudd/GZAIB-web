import type { ProjectableProfileField, Visibility, VisibilityRules } from "../directory/types";
import type { ApplicationMapEligibility } from "./types";
import type { ApplicationInput } from "./types";

export const CONSENT_VERSION = "builder-map-2026-08-29";

export const SKILL_OPTIONS = [
  "AI应用", "产品设计", "用户研究", "原型设计", "前端开发", "后端开发",
  "数据分析", "机器学习", "内容创作", "社群运营", "活动策划", "视觉设计",
] as const;

export const ROLE_OPTIONS = [
  "活动共建者", "项目发起人", "内容共建者", "技术共建者", "校园连接者", "资源支持者",
] as const;

export const MAP_REQUIRED_VISIBILITY_FIELDS = [
  "nickname", "avatarUrl", "school", "city", "intro", "skills", "roles", "verifiedBuilder", "contributions",
] as const;
export const OPTIONAL_VISIBILITY_FIELDS = ["currentFocus", "canOffer", "wantsToMeet", "workLinks", "major", "grade"] as const;
const ALL_VISIBILITY_FIELDS = [...MAP_REQUIRED_VISIBILITY_FIELDS, ...OPTIONAL_VISIBILITY_FIELDS] as const;
const VISIBILITY_VALUES: readonly Visibility[] = ["public", "members", "private"];

/** The application captures all profile visibility choices before any approval transfer occurs. */
export const DEFAULT_APPLICATION_VISIBILITY: Required<VisibilityRules> = {
  nickname: "public", avatarUrl: "public", school: "public", city: "public", intro: "public", skills: "public", roles: "public",
  verifiedBuilder: "public", contributions: "public",
  currentFocus: "private", canOffer: "private", wantsToMeet: "private", workLinks: "private", major: "private", grade: "private",
};

export function completeApplicationVisibility(visibility: VisibilityRules): Required<VisibilityRules> {
  return { ...DEFAULT_APPLICATION_VISIBILITY, ...visibility };
}

export function getMapEligibility(visibility: VisibilityRules): ApplicationMapEligibility {
  const complete = completeApplicationVisibility(visibility);
  const blockedBy = MAP_REQUIRED_VISIBILITY_FIELDS.filter((field) => complete[field] !== "public") as ProjectableProfileField[];
  return { eligible: blockedBy.length === 0, blockedBy };
}

export type ApplicationValidation =
  | { ok: true; value: ApplicationInput }
  | { ok: false; errors: string[] };

function asObject(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function isText(value: unknown, min: number, max: number, optional = false): value is string | undefined {
  return value === undefined ? optional : typeof value === "string" && value.trim().length >= min && value.trim().length <= max;
}

function isStringArray(value: unknown, max: number, allowlist?: readonly string[]): value is string[] {
  return Array.isArray(value) && value.length <= max && value.every((item) =>
    typeof item === "string" && item.trim().length > 0 && (!allowlist || allowlist.includes(item)),
  );
}

function isHttpsUrl(value: string): boolean {
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

function isVisibilityRules(value: unknown): value is VisibilityRules {
  const rules = asObject(value);
  if (!rules) return false;
  return Object.entries(rules).every(([field, visibility]) =>
    ALL_VISIBILITY_FIELDS.includes(field as (typeof ALL_VISIBILITY_FIELDS)[number])
      && typeof visibility === "string" && VISIBILITY_VALUES.includes(visibility as Visibility),
  );
}

/** Validates and allowlists public form values, intentionally omitting owner and status claims. */
export function validateApplication(value: unknown): ApplicationValidation {
  const input = asObject(value);
  if (!input) return { ok: false, errors: ["申请资料格式不正确"] };

  const errors: string[] = [];
  if (!isText(input.nickname, 2, 30)) errors.push("昵称需为 2–30 个字符");
  if (!isText(input.schoolId, 1, 120)) errors.push("请选择学校");
  if (!isText(input.intro, 10, 160)) errors.push("一句话介绍需为 10–160 个字符");
  if (!isText(input.realName, 1, 60, true)) errors.push("真实姓名格式不正确");
  if (!isText(input.avatarKey, 1, 240, true)) errors.push("头像格式不正确");
  if (!isText(input.major, 1, 100, true) || !isText(input.grade, 1, 40, true)) errors.push("学校资料格式不正确");
  if (!isText(input.currentFocus, 1, 500, true) || !isText(input.canOffer, 1, 500, true) || !isText(input.wantsToMeet, 1, 500, true)) {
    errors.push("方向资料不能超过 500 个字符");
  }
  if (!isStringArray(input.skills, 3, SKILL_OPTIONS) || input.skills.length === 0) errors.push("请选择 1–3 项已支持的技能");
  if (!isStringArray(input.interests, 6)) errors.push("兴趣最多 6 项");
  if (!isStringArray(input.roles, 4, ROLE_OPTIONS)) errors.push("请选择不超过 4 个已支持的参与角色");
  if (!isStringArray(input.workLinks, 5) || input.workLinks.some((link) => !isHttpsUrl(link))) errors.push("作品链接仅支持 HTTPS，最多 5 条");
  if (!isVisibilityRules(input.visibility)) errors.push("公开范围设置不正确");
  if (input.consentAccepted !== true || input.consentVersion !== CONSENT_VERSION) errors.push("请阅读并同意当前社区规则与隐私说明");
  if (errors.length > 0) return { ok: false, errors };

  const normalized: ApplicationInput = {
    nickname: input.nickname as string,
    schoolId: input.schoolId as string,
    intro: input.intro as string,
    skills: input.skills as string[], interests: input.interests as string[], roles: input.roles as string[],
    workLinks: input.workLinks as string[], visibility: input.visibility as VisibilityRules,
    consentAccepted: true, consentVersion: CONSENT_VERSION,
  };
  for (const field of ["realName", "avatarKey", "major", "grade", "currentFocus", "canOffer", "wantsToMeet"] as const) {
    if (input[field] !== undefined) Object.assign(normalized, { [field]: input[field] as string });
  }
  return { ok: true, value: normalized };
}
