import type { CommunityLocationMode, CommunityProfileInput } from "./types";

type ClaimInput = { communityId: string; evidence: string; evidenceUrl?: string };
type UpdateInput = { communityId: string; title: string; summary: string; occurredAt: number; sourceUrl?: string };

const PROFILE_KEYS = ["name", "summary", "primaryCity", "locationMode", "focusTags", "officialUrl", "sourceUrl", "sourceLabel"] as const;
const CLAIM_KEYS = ["communityId", "evidence", "evidenceUrl"] as const;
const UPDATE_KEYS = ["communityId", "title", "summary", "occurredAt", "sourceUrl"] as const;
const LOCATION_MODES: readonly CommunityLocationMode[] = ["city", "hybrid", "online"];

function objectOf(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("输入格式不正确");
  return value as Record<string, unknown>;
}

function allowlisted(value: unknown, keys: readonly string[]): Record<string, unknown> {
  const input = objectOf(value);
  const unknown = Object.keys(input).find((key) => !keys.includes(key));
  if (unknown) throw new Error(`包含不允许的字段：${unknown}`);
  return input;
}

function text(value: unknown, field: string, min: number, max: number): string {
  if (typeof value !== "string") throw new Error(`${field}格式不正确`);
  const normalized = value.normalize("NFKC").trim();
  if (normalized.length < min || normalized.length > max) throw new Error(`${field}长度需为 ${min}–${max} 个字符`);
  return normalized;
}

export function safeHttpsUrl(value: unknown, field: string): string {
  const normalized = text(value, field, 1, 2_000);
  try {
    const url = new URL(normalized);
    if (url.protocol !== "https:" || url.username || url.password) throw new Error();
    return normalized;
  } catch {
    throw new Error(`${field}必须是不含凭据的 HTTPS 地址`);
  }
}

export function validateCommunityProfileInput(value: unknown): CommunityProfileInput {
  const input = allowlisted(value, PROFILE_KEYS);
  const locationMode = input.locationMode;
  if (typeof locationMode !== "string" || !LOCATION_MODES.includes(locationMode as CommunityLocationMode)) throw new Error("社群地点模式不正确");
  let primaryCity: string | null = null;
  if (input.primaryCity !== null) primaryCity = text(input.primaryCity, "主要城市", 2, 40);
  if (locationMode === "online" && primaryCity !== null) throw new Error("线上社群不能填写主要城市");
  if ((locationMode === "city" || locationMode === "hybrid") && primaryCity === null) throw new Error("城市和混合社群必须填写主要城市");
  if (!Array.isArray(input.focusTags) || input.focusTags.length < 1 || input.focusTags.length > 8) throw new Error("标签数量需为 1–8 个");
  const focusTags = input.focusTags.map((tag) => text(tag, "标签", 1, 24)).filter((tag, index, tags) => tags.indexOf(tag) === index);
  return {
    name: text(input.name, "名称", 2, 80),
    summary: text(input.summary, "简介", 10, 300),
    primaryCity,
    locationMode: locationMode as CommunityLocationMode,
    focusTags,
    officialUrl: safeHttpsUrl(input.officialUrl, "官方链接"),
    sourceUrl: safeHttpsUrl(input.sourceUrl, "来源链接"),
    sourceLabel: text(input.sourceLabel, "来源名称", 2, 80),
  };
}

export function validateClaimInput(value: unknown): ClaimInput {
  const input = allowlisted(value, CLAIM_KEYS);
  const result: ClaimInput = { communityId: text(input.communityId, "社群 ID", 1, 120), evidence: text(input.evidence, "证明材料", 20, 500) };
  if (input.evidenceUrl !== undefined) result.evidenceUrl = safeHttpsUrl(input.evidenceUrl, "证明链接");
  return result;
}

export function validateUpdateInput(value: unknown): UpdateInput {
  const input = allowlisted(value, UPDATE_KEYS);
  if (typeof input.occurredAt !== "number" || !Number.isInteger(input.occurredAt) || !Number.isFinite(input.occurredAt) || input.occurredAt <= 0) throw new Error("发生时间必须是有效毫秒时间");
  const result: UpdateInput = {
    communityId: text(input.communityId, "社群 ID", 1, 120),
    title: text(input.title, "标题", 2, 100),
    summary: text(input.summary, "摘要", 10, 500),
    occurredAt: input.occurredAt,
  };
  if (input.sourceUrl !== undefined) result.sourceUrl = safeHttpsUrl(input.sourceUrl, "来源链接");
  return result;
}
