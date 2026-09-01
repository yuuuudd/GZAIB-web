export const NEWS_CATEGORIES = ["全部", "AI 应用", "模型动态", "产业观察", "开源工具", "教育实践"] as const;
export type NewsCategory = Exclude<(typeof NEWS_CATEGORIES)[number], "全部">;

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

export const EVENT_TYPES = ["全部", "比赛赛事", "黑客松", "分享会", "工作坊", "展会"] as const;
export const EVENT_LOCATIONS = ["广州", "广东", "线上", "全国"] as const;
export type EventType = Exclude<(typeof EVENT_TYPES)[number], "全部">;
export type EventLocation = (typeof EVENT_LOCATIONS)[number];
export type EventGroup = "本周进行" | "即将开始" | "长期征集";

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
    id: "gpt-5-6-launch",
    category: "模型动态",
    title: "GPT-5.6 正式上线 ChatGPT、Codex 与 API",
    summary: "OpenAI 发布 Sol、Terra、Luna 三个模型层级，重点提升复杂知识工作、编程、智能体协作和单位成本效率。",
    source: "OpenAI",
    publishedLabel: "2026-07-09 · 8 月持续更新",
    url: "https://openai.com/zh-Hans-CN/index/gpt-5-6/",
    featured: "lead",
  },
  {
    id: "tencent-hy3-global",
    category: "开源工具",
    title: "腾讯混元 Hy3 向全球开发者开放",
    summary: "Hy3 扩大国际开放，可经 API、腾讯云及多种开发工具接入，并进入 Hugging Face、ModelScope 等模型社区。",
    source: "腾讯",
    publishedLabel: "2026-08-05",
    url: "https://www.tencent.com/zh-cn/tencent-hy3-now-available-globally-extending-practical-ai-across-products-workflows-and-cloud-services/",
    featured: "secondary",
  },
  {
    id: "gemini-omni-1-1-flash",
    category: "AI 应用",
    title: "Gemini Omni 1.1 Flash 增强生成视频控制",
    summary: "Google 面向开发者加入场景延展、首尾帧插值、4K 放大与更快原型迭代等视频生成控制能力。",
    source: "Google",
    publishedLabel: "2026-08-27",
    url: "https://blog.google/innovation-and-ai/technology/developers-tools/build-with-gemini-omni-1-1-flash/",
    featured: "secondary",
  },
  {
    id: "openai-hugging-face-incident",
    category: "产业观察",
    title: "OpenAI 公开 Hugging Face 安全事件与整改方向",
    summary: "OpenAI 披露内部安全评估中的隔离绕过事件，并提出加强沙箱、监控、对齐研究与事件响应的后续措施。",
    source: "OpenAI",
    publishedLabel: "2026-08-26",
    url: "https://openai.com/index/hugging-face-incident-and-the-road-ahead/",
  },
  {
    id: "anthropic-alignment-security",
    category: "产业观察",
    title: "Anthropic 调整对齐与安全工作",
    summary: "Anthropic 在复盘网络安全评估事件后，宣布加强高风险评估监控、沙箱防护和外部独立审查。",
    source: "Anthropic",
    publishedLabel: "2026-08-31",
    url: "https://www.anthropic.com/news/improving-alignment-security-efforts",
  },
  {
    id: "datawhale-learning-roadmap",
    category: "教育实践",
    title: "Datawhale 发起 AI Learning Roadmap 共建",
    summary: "这项开源培养路线提案覆盖 AI 素养、RAG、Agent、多模态与模型工程，并强调用可运行项目验收学习成果。",
    source: "Datawhale · GitHub",
    publishedLabel: "2026-07-11",
    url: "https://github.com/datawhalechina/DOPMC/issues/429",
  },
  {
    id: "guangdong-ai-for-science-plan",
    category: "产业观察",
    title: "广东发布 AI 赋能科学研究行动方案",
    summary: "广东提出布局领域基础模型与科研示范场景，并建设广州国际生物岛、深圳河套、珠海唐家湾、东莞松山湖等科研高地。",
    source: "广东网信网 · 广东省科技厅",
    publishedLabel: "2026-06-09",
    url: "https://cagd.gov.cn/v/2026/06/9223.html",
  },
];

export const eventItems: EventItem[] = [
  {
    id: "aix-origin-2026",
    type: "黑客松",
    title: "AIx Origin 黑客松",
    summary: "围绕 AI + Fintech 与 AI + Healthcare 的跨城共创，香港与深圳同步开展，适合短周期完成 AI 产品原型并连接队友。",
    locations: ["广东", "全国"],
    venue: "深圳与香港同步进行",
    organizer: "AIx Origin",
    dateLabel: "08.31—09.06",
    deadlineLabel: "查看主办方最新通知",
    group: "本周进行",
    url: "https://aixorigin.innoai.org.cn/",
    featured: true,
  },
  {
    id: "rebuild-z-geia-2026",
    type: "黑客松",
    title: "REBUILD-Z × GEIA AI 黑客松",
    summary: "聚焦 AI、具身智能与人形机器人，包含赛前交流、48 小时驻场开发和参访环节。",
    locations: ["广东", "全国"],
    venue: "深圳 · 大中华喜来登酒店",
    organizer: "REBUILD-Z、GEIA、杭州 AI 工坊",
    dateLabel: "09.08—09.11",
    deadlineLabel: "以活动页最新状态为准",
    group: "即将开始",
    url: "https://ai.builderlab.cn/activities/b18cb7dc-8def-4929-ad9c-26048d851be3",
  },
  {
    id: "huadu-ai-trainer-competition",
    type: "比赛赛事",
    title: "广州花都人工智能训练师职业技能竞赛",
    summary: "采用理论与实操结合的个人赛制，面向在广州工作、学习或居住满一年且符合专业条件的参赛者。",
    locations: ["广州", "广东"],
    venue: "广州 · 花都区",
    organizer: "花都区人力资源和社会保障局等",
    dateLabel: "09.12—09.13",
    deadlineLabel: "09.06",
    group: "即将开始",
    url: "https://www.huadu.gov.cn/zdlyxxgk/jycy/jycyxx/content/mpost_10958582.html",
  },
  {
    id: "gosim-shenzhen-2026",
    type: "展会",
    title: "GOSIM Shenzhen 2026 全球开源 AI 大会",
    summary: "覆盖 Agentic AI、开源模型、基础设施与具身智能，包含主题演讲、论坛、Workshop、Hackathon 和项目演示。",
    locations: ["广东", "全国"],
    venue: "深圳 · 南山伊敦酒店",
    organizer: "GOSIM",
    dateLabel: "10.16—10.17",
    deadlineLabel: "购票与 CFP 进行中",
    group: "即将开始",
    url: "https://shenzhen2026.gosim.org/zh/",
  },
  {
    id: "tianchi-cross-border-recommendation",
    type: "比赛赛事",
    title: "天池经典打榜赛：跨境智能算法赛",
    summary: "以跨境电商推荐为背景的长期线上学习赛，适合数据分析与推荐算法学习者练习模型迭代。",
    locations: ["线上", "全国"],
    venue: "线上",
    organizer: "阿里云天池",
    dateLabel: "进行至 09.30",
    deadlineLabel: "09.30 · 报名前再次确认状态",
    group: "长期征集",
    url: "https://tianchi.aliyun.com/competition/coupleList",
  },
  {
    id: "ai-hangzhou-agent-challenge",
    type: "比赛赛事",
    title: "2026 AI 杭州“码动未来”智能体创新大赛",
    summary: "围绕真实 AI 场景构建智能体应用，初赛线上提交，重点考察问题价值、创新性与落地能力。",
    locations: ["线上", "全国"],
    venue: "线上初赛 · 杭州决赛",
    organizer: "AI 杭州开发者社区等",
    dateLabel: "作品截止 09.19",
    deadlineLabel: "09.19",
    group: "即将开始",
    url: "https://aichallenge.msup.com.cn/",
  },
  {
    id: "gosim-shenzhen-volunteers",
    type: "展会",
    title: "GOSIM Shenzhen 2026 高校志愿者招募",
    summary: "面向在校本科生和研究生的大会志愿者机会，提供会议服务实践、技术社区连接、证书与入场权益。",
    locations: ["广东", "全国"],
    venue: "深圳 · 南山伊敦酒店",
    organizer: "GOSIM",
    dateLabel: "10.15—10.17",
    deadlineLabel: "招募进行中",
    group: "长期征集",
    url: "https://shenzhen2026.gosim.org/zh/volunteers/",
  },
];

export function filterNews(items: NewsItem[], category: (typeof NEWS_CATEGORIES)[number]) {
  return category === "全部" ? items : items.filter((item) => item.category === category);
}

export function filterEvents(items: EventItem[], type: (typeof EVENT_TYPES)[number], location: EventLocation) {
  return items.filter((item) => (type === "全部" || item.type === type) && item.locations.includes(location));
}
