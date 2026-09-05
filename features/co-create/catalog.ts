import { CO_CREATE_PARTICIPATION_MODES, CO_CREATE_TYPES, type PublicCoCreateProject } from "./projects";

export { CO_CREATE_PARTICIPATION_MODES, CO_CREATE_TYPES };

export function filterCoCreates(items: PublicCoCreateProject[], type: (typeof CO_CREATE_TYPES)[number] | "全部", mode: (typeof CO_CREATE_PARTICIPATION_MODES)[number] | "全部") {
  return items.filter((item) => (type === "全部" || item.type === type) && (mode === "全部" || item.participationMode === mode));
}
