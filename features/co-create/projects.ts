export const CO_CREATE_TYPES = ["活动协作", "项目共创", "内容共创", "校园连接", "技术支持", "资源协作"] as const;
export const CO_CREATE_SCOPES = ["广州", "广东", "线上", "跨校"] as const;
export const CO_CREATE_STATUSES = ["招募中", "组队中", "想法征集"] as const;
export const CO_CREATE_LEVELS = ["新手友好", "需要经验"] as const;

export type CoCreateProjectInput = {
  title: string;
  type: (typeof CO_CREATE_TYPES)[number];
  scope: (typeof CO_CREATE_SCOPES)[number];
  status: (typeof CO_CREATE_STATUSES)[number];
  summary: string;
  details: string;
  problem: string;
  roles: string;
  effort: string;
  deadline?: string;
  level: (typeof CO_CREATE_LEVELS)[number];
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
  if (deadline.length > 50) errors.push("截止时间不能超过 50 个字符");
  if (!CO_CREATE_TYPES.includes(input.type as never)) errors.push("请选择项目类型");
  if (!CO_CREATE_SCOPES.includes(input.scope as never)) errors.push("请选择参与范围");
  if (!CO_CREATE_STATUSES.includes(input.status as never)) errors.push("请选择项目状态");
  if (!CO_CREATE_LEVELS.includes(input.level as never)) errors.push("请选择经验要求");
  if (errors.length) return { ok: false, errors };
  return { ok: true, value: {
    title, summary, details, problem, roles, effort,
    type: input.type as CoCreateProjectInput["type"], scope: input.scope as CoCreateProjectInput["scope"],
    status: input.status as CoCreateProjectInput["status"], level: input.level as CoCreateProjectInput["level"],
    ...(deadline ? { deadline } : {}),
  } };
}
