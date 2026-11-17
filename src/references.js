// Public source links, checked 2026-11-15. Summaries are ShowFlow editorial notes.
// These are links to publisher pages; no third-party decks are rehosted.
export const referenceSeeds = [
  {
    id: "front",
    name: "Front",
    title: "团队协作 SaaS · Series A",
    industry: "企业服务",
    stage: "A轮",
    kind: "真实案例",
    publisher: "Front 官方",
    year: "2016",
    url: "https://front.com/blog/inside-fronts-series-a-slide-deck",
    tags: ["协作", "SaaS", "客服", "企业服务"],
    note: "与会议行动卡的协作场景接近。可对照它如何介绍产品与业务进展。",
    takeaway: "产品价值 → 使用场景 → 业务进展",
    theme: "paper",
    verified: true,
  },
  {
    id: "intercom",
    name: "Intercom",
    title: "客户沟通产品 · 首份路演",
    industry: "企业服务",
    stage: "种子轮",
    kind: "真实案例",
    publisher: "Intercom 官方",
    year: "2011",
    url: "https://www.intercom.com/blog/first-pitch-deck",
    tags: ["客服", "SaaS", "客户沟通", "企业服务"],
    note: "由创始人公开的早期材料。适合观察如何在功能有限时讲清楚产品。",
    takeaway: "客户问题 → 产品如何介入 → 下一步",
    theme: "paper",
    verified: true,
  },
  {
    id: "linkedin",
    name: "LinkedIn",
    title: "专业社交网络 · Series B",
    industry: "平台产品",
    stage: "B轮",
    kind: "真实案例",
    publisher: "Reid Hoffman",
    year: "2004",
    url: "https://www.reidhoffman.org/linkedin-pitch-to-greylock/",
    tags: ["平台", "社交", "网络效应", "增长"],
    note: "创始人公开原始演示及逐页说明，可用于比较平台价值和商业假设。",
    takeaway: "产品定位 → 网络价值 → 商业假设",
    theme: "ink",
    verified: true,
  },
  {
    id: "yc",
    name: "Y Combinator",
    title: "种子轮路演结构",
    industry: "通用",
    stage: "种子轮",
    kind: "方法模板",
    publisher: "YC Startup Library",
    year: "指南",
    url: "https://www.ycombinator.com/library/2u-how-to-build-your-seed-round-pitch-deck",
    tags: ["模板", "种子轮", "融资", "初创"],
    note: "用于检查早期路演的内容组织；它是方法指南，不是某家公司的实际路演。",
    takeaway: "一句话价值 → 关键依据 → 明确诉求",
    theme: "warm",
    verified: true,
  },
  {
    id: "sequoia",
    name: "Sequoia",
    title: "从问题到愿景的商业叙事",
    industry: "通用",
    stage: "通用",
    kind: "方法模板",
    publisher: "Sequoia Capital",
    year: "指南",
    url: "https://sequoiacap.com/article/writing-a-business-plan",
    tags: ["模板", "商业计划", "融资", "叙事"],
    note: "用于补齐问题、解决方案、时机、市场与商业模式等信息。",
    takeaway: "问题 → 解决方案 → 为什么现在 → 业务",
    theme: "stage",
    verified: true,
  },
];
export function validPublicUrl(value) {
  try {
    const u = new URL(value);
    return ["https:", "http:"].includes(u.protocol) &&
      !u.username &&
      !u.password
      ? u.href
      : null;
  } catch {
    return null;
  }
}

export function isDeckCandidate(url) {
  try {
    const u = new URL(url);
    return (
      !/ai[-_/]?pitch[-_]deck[-_]generator|free-ai-pitch-deck-generator|\/solutions\/pitch-deck|\/tools\/ai-pitch/i.test(
        u.pathname,
      ) &&
      ![
        "code.minimax.cn",
        "greatars.ai",
        "www.genspark.ai",
        "www.kuse.ai",
        "www.flyppt.com",
        "365.wps.cn",
      ].includes(u.hostname)
    );
  } catch {
    return false;
  }
}
