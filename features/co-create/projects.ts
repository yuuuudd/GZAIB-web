export const CO_CREATE_TYPES = ["活动协作", "项目共创", "内容共创", "校园连接", "技术支持", "资源协作"] as const;
export const CO_CREATE_PARTICIPATION_MODES = ["线上", "线下", "混合"] as const;
export const CO_CREATE_STATUSES = ["招募中", "组队中", "想法征集"] as const;

export type CoCreateProjectInput = {
  title: string;
  type: (typeof CO_CREATE_TYPES)[number];
  participationMode: (typeof CO_CREATE_PARTICIPATION_MODES)[number];
  status: (typeof CO_CREATE_STATUSES)[number];
  summary: string;
  details: string;
  problem: string;
  roles: string;
  effort: string;
  deadline?: string;
  location?: string;
  locationTbd: boolean;
  startsAt?: string;
  endsAt?: string;
  timeTbd: boolean;
};

export type CoCreateProject = CoCreateProjectInput & {
  id: string;
  ownerUserId: string;
  publishStatus: "published" | "archived";
  createdAt: number;
  updatedAt: number;
};

export type PublicCoCreateProject = CoCreateProject & {
  organizer: string;
  organizerSlug: string;
  isOwner: boolean;
};

type Validation = { ok: true; value: CoCreateProjectInput } | { ok: false; errors: string[] };

function required(input: Record<string, unknown>, name: string, label: string, min: number, max: number, errors: string[]) {
  const value = typeof input[name] === "string" ? input[name].trim() : "";
  if (value.length < min || value.length > max) errors.push(`${label}需为 ${min}–${max} 个字符`);
  return value;
}

function validDate(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const [, year, month, day] = match.map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

function validDateTime(value: string) {
  const match = /^(\d{4}-\d{2}-\d{2})T([01]\d|2[0-3]):[0-5]\d$/.exec(value);
  return Boolean(match && validDate(match[1]));
}

export function validateCoCreateProject(value: unknown): Validation {
  if (!value || typeof value !== "object" || Array.isArray(value)) return { ok: false, errors: ["项目格式不正确"] };
  const input = value as Record<string, unknown>;
  const errors: string[] = [];
  const title = required(input, "title", "项目名称", 2, 100, errors);
  const summary = required(input, "summary", "简要介绍", 10, 300, errors);
  const details = required(input, "details", "详细介绍", 10, 2000, errors);
  const problem = required(input, "problem", "希望解决的问题", 5, 500, errors);
  const roles = required(input, "roles", "招募角色", 2, 500, errors);
  const effort = required(input, "effort", "参与投入", 2, 200, errors);
  const deadline = typeof input.deadline === "string" ? input.deadline.trim() : "";
  if (deadline && !validDate(deadline)) errors.push("截止时间格式不正确");
  const participationMode = input.participationMode;
  const location = typeof input.location === "string" ? input.location.trim() : "";
  const locationTbd = input.locationTbd === true;
  const timeTbd = input.timeTbd === true;
  const startsAt = typeof input.startsAt === "string" ? input.startsAt.trim() : "";
  const endsAt = typeof input.endsAt === "string" ? input.endsAt.trim() : "";
  if (location.length > 200) errors.push("活动地点不能超过 200 个字符");
  if (participationMode !== "线上" && !locationTbd && location.length < 2) errors.push("请填写活动地点或选择地点待定");
  if (!timeTbd && !startsAt) errors.push("请选择开始时间");
  if (!timeTbd && !endsAt) errors.push("请选择结束时间");
  if (!timeTbd && startsAt && !validDateTime(startsAt)) errors.push("开始时间格式不正确");
  if (!timeTbd && endsAt && !validDateTime(endsAt)) errors.push("结束时间格式不正确");
  if (!timeTbd && validDateTime(startsAt) && validDateTime(endsAt) && endsAt <= startsAt) errors.push("结束时间需晚于开始时间");
  if (!CO_CREATE_TYPES.includes(input.type as never)) errors.push("请选择项目类型");
  if (!CO_CREATE_PARTICIPATION_MODES.includes(participationMode as never)) errors.push("请选择参与方式");
  if (!CO_CREATE_STATUSES.includes(input.status as never)) errors.push("请选择项目状态");
  if (errors.length) return { ok: false, errors };
  return { ok: true, value: {
    title, summary, details, problem, roles, effort,
    type: input.type as CoCreateProjectInput["type"], participationMode: participationMode as CoCreateProjectInput["participationMode"],
    status: input.status as CoCreateProjectInput["status"], locationTbd, timeTbd,
    ...(deadline ? { deadline } : {}), ...(location ? { location } : {}),
    ...(!timeTbd && startsAt ? { startsAt } : {}), ...(!timeTbd && endsAt ? { endsAt } : {}),
  } };
}
