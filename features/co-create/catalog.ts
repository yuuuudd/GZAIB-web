export const CO_CREATE_TYPES = ["全部", "活动协作", "项目共创", "内容共创", "校园连接", "技术支持", "资源协作"] as const;
export const CO_CREATE_SCOPES = ["广州", "广东", "线上"] as const;
export const CO_CREATE_LEVELS = ["新手友好", "需要经验"] as const;

export type CoCreateItem = {
  id: string;
  title: string;
  status: "招募中" | "组队中" | "想法征集";
  type: Exclude<(typeof CO_CREATE_TYPES)[number], "全部">;
  scope: "广州" | "广东" | "线上" | "跨校";
  summary: string;
  roles: string;
  effort: string;
  deadline?: string;
  organizer: string;
  level: (typeof CO_CREATE_LEVELS)[number];
  action: string;
};

export const coCreateItems: CoCreateItem[] = [
  { id: "ai-night", title: "广州高校 AI 共创夜", status: "招募中", type: "活动协作", scope: "广州", summary: "围绕 AI 工具、真实案例和校园实践，组织一场 90 分钟的跨校交流。", roles: "主持人 1 名、摄影记录 1 名、现场协助 2 名", effort: "活动前 2 小时 + 活动当天", deadline: "9 月 10 日", organizer: "中山大学 林同学", level: "新手友好", action: "查看详情" },
  { id: "knowledge-base", title: "校园知识库 AI 原型小组", status: "组队中", type: "项目共创", scope: "跨校", summary: "用一周时间做出一个面向学生社团的 AI 知识库原型。", roles: "产品 1 名、前端 1 名、视觉设计 1 名", effort: "每周约 3 小时", deadline: "9 月 15 日", organizer: "广州 AI 共创社", level: "需要经验", action: "加入项目" },
  { id: "tool-sharing", title: "AI 工具实践分享征集", status: "想法征集", type: "活动协作", scope: "线上", summary: "分享你真正使用过的 AI 工具、工作流或失败经验。", roles: "分享者 5 名", effort: "准备一次 5–20 分钟分享", deadline: "9 月 20 日", organizer: "广州 AI 共创社", level: "新手友好", action: "提交分享想法" },
];

export function filterCoCreates(items: CoCreateItem[], type: (typeof CO_CREATE_TYPES)[number], scope: (typeof CO_CREATE_SCOPES)[number] | "全部", level: (typeof CO_CREATE_LEVELS)[number] | "全部") {
  return items.filter((item) => (type === "全部" || item.type === type) && (scope === "全部" || item.scope === scope) && (level === "全部" || item.level === level));
}
