export type ActivityProposalInput = {
  title: string;
  summary: string;
  stage: string;
  timeNote?: string;
  location?: string;
  supportNeeded?: string;
  links: string[];
};

export const ACTIVITY_STAGES = ["idea", "preparing", "scheduled"] as const;

type ActivityProposalValidation = { ok: true; value: ActivityProposalInput } | { ok: false; errors: string[] };

function optionalText(value: unknown, max: number): string | undefined | null {
  if (value === undefined || value === null || value === "") return undefined;
  return typeof value === "string" && value.trim().length <= max ? value.trim() : null;
}

export function validateActivityProposal(value: unknown): ActivityProposalValidation {
  if (!value || typeof value !== "object" || Array.isArray(value)) return { ok: false, errors: ["活动申请格式不正确"] };
  const input = value as Record<string, unknown>;
  const errors: string[] = [];
  const title = typeof input.title === "string" ? input.title.trim() : "";
  const summary = typeof input.summary === "string" ? input.summary.trim() : "";
  if (title.length < 2 || title.length > 100) errors.push("活动主题需为 2–100 个字符");
  if (summary.length < 10 || summary.length > 500) errors.push("活动简介需为 10–500 个字符");
  if (typeof input.stage !== "string" || !ACTIVITY_STAGES.includes(input.stage as (typeof ACTIVITY_STAGES)[number])) errors.push("请选择当前筹备阶段");
  const timeNote = optionalText(input.timeNote, 120);
  const location = optionalText(input.location, 120);
  const supportNeeded = optionalText(input.supportNeeded, 500);
  if (timeNote === null || location === null || supportNeeded === null) errors.push("选填信息长度不正确");
  if (!Array.isArray(input.links) || input.links.length > 3 || input.links.some((link) => {
    if (typeof link !== "string") return true;
    try { return new URL(link).protocol !== "https:"; } catch { return true; }
  })) errors.push("相关链接仅支持 HTTPS，最多 3 条");
  if (errors.length) return { ok: false, errors };
  return { ok: true, value: {
    title, summary, stage: input.stage as string, links: input.links as string[],
    ...(timeNote ? { timeNote } : {}), ...(location ? { location } : {}), ...(supportNeeded ? { supportNeeded } : {}),
  } };
}
