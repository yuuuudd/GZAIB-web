import { CO_CREATE_LEVELS, CO_CREATE_SCOPES, CO_CREATE_TYPES, type PublicCoCreateProject } from "./projects";

export { CO_CREATE_LEVELS, CO_CREATE_SCOPES, CO_CREATE_TYPES };

export function filterCoCreates(items: PublicCoCreateProject[], type: (typeof CO_CREATE_TYPES)[number] | "全部", scope: (typeof CO_CREATE_SCOPES)[number] | "全部", level: (typeof CO_CREATE_LEVELS)[number] | "全部") {
  return items.filter((item) => (type === "全部" || item.type === type) && (scope === "全部" || item.scope === scope) && (level === "全部" || item.level === level));
}
