export const NEWS_CATEGORIES = ["全部", "AI 应用", "模型动态", "产业观察", "开源工具", "教育实践"] as const;
export const EVENT_TYPES = ["全部", "比赛赛事", "黑客松", "分享会", "工作坊", "展会"] as const;
export const EVENT_LOCATIONS = ["广州", "广东", "线上", "全国"] as const;

export type NewsCategory = Exclude<(typeof NEWS_CATEGORIES)[number], "全部">;
export type EventType = Exclude<(typeof EVENT_TYPES)[number], "全部">;
export type EventLocation = (typeof EVENT_LOCATIONS)[number];
export type EventGroup = "本周进行" | "即将开始" | "长期征集";

export type NewsItem = {
  id: string;
  category: NewsCategory;
  title: string;
  summary: string;
  source: string;
  publishedLabel: string;
  url: string;
  featured?: "lead" | "secondary";
};

export type EventItem = {
  id: string;
  type: EventType;
  title: string;
  summary: string;
  locations: EventLocation[];
  venue: string;
  organizer: string;
  dateLabel: string;
  deadlineLabel: string;
  group: EventGroup;
  url: string;
  featured?: boolean;
};

export const newsItems: NewsItem[] = [
  {
    id: "news-cloud-kite-assistant",
    category: "AI 应用",
    title: "云风筝助手完成首轮虚构体验测试",
    summary: "一个虚构产品团队记录如何为社区协作助手设计清晰、可撤回的操作流程。",
    source: "共创社虚构编辑部",
    publishedLabel: "示例日期 · 9 月 1 日",
    url: "https://example.com/news/cloud-kite-assistant",
    featured: "lead",
  },
  {
    id: "news-pocket-model-notes",
    category: "模型动态",
    title: "口袋模型实验室发布虚构版本笔记",
    summary: "示例文章用假想参数说明如何写一份不夸大能力边界的模型更新说明。",
    source: "口袋模型实验室（虚构）",
    publishedLabel: "示例日期 · 8 月 30 日",
    url: "https://example.com/news/pocket-model-notes",
    featured: "secondary",
  },
  {
    id: "news-river-industry-observer",
    category: "产业观察",
    title: "珠江边的虚构 AI 小团队协作观察",
    summary: "一份虚构观察稿，讨论小团队如何在有限资源下安排验证、复盘与公开沟通。",
    source: "南风产业观察（虚构）",
    publishedLabel: "示例日期 · 8 月 28 日",
    url: "https://example.com/news/river-industry-observer",
    featured: "secondary",
  },
  {
    id: "news-lantern-toolkit",
    category: "开源工具",
    title: "纸灯笼工具箱开放虚构示例仓库",
    summary: "示例内容介绍一组并不存在的教学脚手架，用来演示开源项目的目录与贡献说明。",
    source: "纸灯笼工具组（虚构）",
    publishedLabel: "示例日期 · 8 月 25 日",
    url: "https://example.com/news/lantern-toolkit",
  },
  {
    id: "news-classroom-prompt-lab",
    category: "教育实践",
    title: "榕树课堂完成虚构提示词共备课",
    summary: "虚构教师团队以透明评价标准为主题，整理了一次课堂共备的示例复盘。",
    source: "榕树课堂（虚构）",
    publishedLabel: "示例日期 · 8 月 22 日",
    url: "https://example.com/news/classroom-prompt-lab",
  },
  {
    id: "news-neighborhood-agent",
    category: "AI 应用",
    title: "街角智能体开启虚构社区问答试验",
    summary: "本条为纯虚构案例，用于展示社区问答产品如何标注来源与不确定性。",
    source: "街角实验室（虚构）",
    publishedLabel: "示例日期 · 8 月 18 日",
    url: "https://example.com/news/neighborhood-agent",
  },
];

export const eventItems: EventItem[] = [
  {
    id: "event-paper-plane-workshop",
    type: "工作坊",
    title: "纸飞机 AI 原型工作坊（虚构示例）",
    summary: "参与者用虚构需求练习从问题陈述到低保真原型的完整过程。",
    locations: ["广州", "广东"],
    venue: "广州 · 虚构共创空间",
    organizer: "纸飞机共创组（虚构）",
    dateLabel: "示例日期 · 本周六",
    deadlineLabel: "示例截止 · 本周五",
    group: "本周进行",
    url: "https://example.com/events/paper-plane-workshop",
    featured: true,
  },
  {
    id: "event-starlight-hackathon",
    type: "黑客松",
    title: "星光智能体黑客松（虚构示例）",
    summary: "一个纯虚构的线上协作活动，主题是为公益场景制作可解释的小工具。",
    locations: ["线上", "全国"],
    venue: "线上 · 虚构直播间",
    organizer: "星光开发者小组（虚构）",
    dateLabel: "示例日期 · 9 月中旬",
    deadlineLabel: "示例截止 · 9 月上旬",
    group: "即将开始",
    url: "https://example.com/events/starlight-hackathon",
  },
  {
    id: "event-coconut-demo-contest",
    type: "比赛赛事",
    title: "椰子杯 AI 演示赛（虚构示例）",
    summary: "虚构赛事邀请学习者提交一分钟产品演示，不代表任何真实报名或奖项信息。",
    locations: ["广东", "全国"],
    venue: "广东 · 虚构展示中心",
    organizer: "椰子杯组委会（虚构）",
    dateLabel: "示例日期 · 10 月",
    deadlineLabel: "长期接收虚构作品",
    group: "长期征集",
    url: "https://example.com/events/coconut-demo-contest",
  },
  {
    id: "event-bay-area-sharing",
    type: "分享会",
    title: "湾区小模型分享会（虚构示例）",
    summary: "虚构嘉宾围绕小模型评测与负责任发布进行案例交流。",
    locations: ["广州", "线上"],
    venue: "广州 · 虚构青年空间及线上",
    organizer: "湾区模型茶话会（虚构）",
    dateLabel: "示例日期 · 下周三",
    deadlineLabel: "示例截止 · 下周二",
    group: "即将开始",
    url: "https://example.com/events/bay-area-sharing",
  },
  {
    id: "event-future-tools-expo",
    type: "展会",
    title: "未来工具小展（虚构示例）",
    summary: "虚构展会集中展示学习者制作的本地优先 AI 工具概念。",
    locations: ["广东"],
    venue: "广东 · 虚构创意园",
    organizer: "未来工具社（虚构）",
    dateLabel: "示例日期 · 11 月",
    deadlineLabel: "示例截止 · 10 月",
    group: "长期征集",
    url: "https://example.com/events/future-tools-expo",
  },
];

export function filterNews(items: NewsItem[], category: NewsCategory | "全部"): NewsItem[] {
  return category === "全部" ? [...items] : items.filter((item) => item.category === category);
}

export function filterEvents(items: EventItem[], type: EventType | "全部", location: EventLocation): EventItem[] {
  return items.filter((item) => (type === "全部" || item.type === type) && item.locations.includes(location));
}
