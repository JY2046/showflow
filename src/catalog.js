const randomUUID = () => globalThis.crypto.randomUUID();
const CATALOG_URL =
  "https://raw.githubusercontent.com/midovislam/awesome-pitch-decks/main/deck_index.csv";
const CATALOG_PAGE = "https://github.com/midovislam/awesome-pitch-decks";
// Editorial query associations, not externally verified industry labels.
const sectors = [
  {
    pattern: /协作|会议|效率|生产力|办公|collaboration|productivity|saas/i,
    industry: "企业服务",
    companies: [
      "Front",
      "Intercom",
      "Buffer",
      "Slack",
      "Loom",
      "Dropbox",
      "Figma",
      "Notion",
      "Asana",
      "DocSend",
      "GitLab",
      "Airtable",
      "Trello",
      "Miro",
      "Calendly",
      "Gusto",
      "Mattermost",
    ],
  },
  {
    pattern: /人工智能|大模型|机器学习|\bai\b|machine learning/i,
    industry: "人工智能",
    companies: [
      "Replit",
      "Deepgram",
      "OpenAI",
      "Anthropic",
      "Hugging Face",
      "Cohere",
      "Cerebras",
      "V7",
      "AssemblyAI",
      "Jasper",
      "DataRobot",
      "Weights & Biases",
      "Databricks",
    ],
  },
  {
    pattern: /制造|工厂|质检|工业|硬件|manufactur|industrial|hardware/i,
    industry: "企业服务",
    companies: [
      "Tulip",
      "Instrumental",
      "Augury",
      "Desktop Metal",
      "MakerBot",
      "Formlabs",
      "Samsara",
      "Relativity Space",
      "Gecko Robotics",
      "Tesla",
    ],
  },
  {
    pattern: /电商|零售|消费|珠宝|commerce|retail|consumer/i,
    industry: "消费产品",
    companies: [
      "Shopify",
      "Warby Parker",
      "Casper",
      "Glossier",
      "Allbirds",
      "Harrys",
      "DTC",
      "Faire",
      "Instacart",
      "Wish",
      "Etsy",
      "Brandless",
    ],
  },
  {
    pattern: /金融|支付|fintech|payment/i,
    industry: "平台产品",
    companies: [
      "Brex",
      "Stripe",
      "Coinbase",
      "Monzo",
      "Revolut",
      "Wise",
      "Mollie",
      "Mambu",
      "N26",
      "Square",
      "Robinhood",
    ],
  },
  {
    pattern: /医疗|健康|health|medical/i,
    industry: "企业服务",
    companies: [
      "Oscar",
      "98point6",
      "100Plus",
      "Alto",
      "Hims",
      "Ro",
      "Nurx",
      "Virta",
      "Heal",
      "Doctolib",
      "Zocdoc",
    ],
  },
  {
    pattern: /教育|培训|学习|education|edtech/i,
    industry: "消费产品",
    companies: [
      "Duolingo",
      "ClassDojo",
      "Coursera",
      "Udemy",
      "MasterClass",
      "Outschool",
      "Quizlet",
      "Kahoot",
      "Brainly",
    ],
  },
  {
    pattern: /物流|供应链|运输|logistics|supply chain|transport/i,
    industry: "企业服务",
    companies: [
      "Flexport",
      "Uber",
      "7bridges",
      "Shippo",
      "Sendle",
      "Convoy",
      "KeepTruckin",
      "Samsara",
      "Delhivery",
    ],
  },
  {
    pattern: /社交|平台|marketplace|social/i,
    industry: "平台产品",
    companies: [
      "LinkedIn",
      "Facebook",
      "Airbnb",
      "YouTube",
      "Reddit",
      "Pinterest",
      "Discord",
      "Tinder",
      "Bumble",
    ],
  },
];
export function parseCsv(raw) {
  const rows = [];
  let row = [],
    field = "",
    quoted = false;
  for (let i = 0; i < raw.length; i++) {
    const c = raw[i];
    if (c === '"') {
      if (quoted && raw[i + 1] === '"') {
        field += '"';
        i++;
      } else quoted = !quoted;
    } else if (c === "," && !quoted) {
      row.push(field);
      field = "";
    } else if ((c === "\n" || c === "\r") && !quoted) {
      if (c === "\r" && raw[i + 1] === "\n") i++;
      row.push(field);
      if (row.some(Boolean)) rows.push(row);
      row = [];
      field = "";
    } else field += c;
  }
  if (field || row.length) {
    row.push(field);
    rows.push(row);
  }
  const [header, ...data] = rows;
  return data.map((cells) =>
    Object.fromEntries(
      header.map((h, i) => [h.replace(/^\ufeff/, ""), cells[i] || ""]),
    ),
  );
}
const normalize = (s) =>
  String(s)
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]/gu, "");
export function rankCatalog(rows, query) {
  const groups = sectors.filter((s) => s.pattern.test(query)),
    q = query.toLowerCase();
  return rows
    .map((r) => {
      const name = r.company_name || "",
        n = name.toLowerCase();
      let score = n.length > 2 && q.includes(n) ? 100 : 0;
      let industry = "通用";
      for (const group of groups) {
        if (group.companies.some((c) => normalize(c) === normalize(name))) {
          score +=
            60 -
            group.companies.findIndex((c) => normalize(c) === normalize(name));
          industry = group.industry;
        }
      }
      return { r, score, industry };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score || Number(b.r.year) - Number(a.r.year));
}
export async function searchPublicCatalog(body, { fetcher = fetch } = {}) {
  const query = String(body.query || "").trim();
  if (query.length < 2 || query.length > 200) {
    const e = new Error("请填写 2–200 个字符的行业或公司描述。");
    e.status = 400;
    throw e;
  }
  const r = await fetcher(CATALOG_URL, {
    signal: AbortSignal.timeout(20000),
  });
  if (!r.ok) throw new Error("公开路演目录暂时无法访问，请稍后重试。");
  const raw = await r.text();
  if (raw.length > 2_000_000) throw new Error("公开目录内容超出预期，未导入。");
  const rows = parseCsv(raw);
  if (!rows.length || !rows[0].company_name || !rows[0].google_drive_link)
    throw new Error("公开目录格式已变化，未导入未知数据。");
  const ranked = rankCatalog(rows, query),
    seen = new Set(),
    at = new Date().toISOString();
  const results = [];
  for (const { r: row, industry } of ranked) {
    if (seen.has(normalize(row.company_name))) continue;
    let url;
    try {
      url = new URL(row.google_drive_link);
      if (url.hostname !== "drive.google.com") continue;
    } catch {
      continue;
    }
    seen.add(normalize(row.company_name));
    const stage =
      {
        Seed: "种子轮",
        "Pre-Seed": "种子轮",
        "Series A": "A轮",
        "Series B": "B轮",
      }[row.round] || "待标注";
    results.push({
      id: randomUUID(),
      name: row.company_name,
      title: row.display_name,
      url: url.href,
      industry,
      stage,
      kind: "公开索引",
      year: row.year || "待标注",
      publisher: "Awesome Pitch Decks · 公开索引",
      tags: [industry, query, row.company_name],
      note: `按公司名与产品类别关键词匹配。公开索引记录：${row.display_name}。行业关联为ShowFlow编辑分类，原稿身份与业务事实仍需核对。`,
      takeaway:
        "对照原稿的问题表述、产品展示顺序和验证依据，先记录自己想借鉴的点。尚未读取完整外部PPT。",
      verified: false,
      discovered: true,
      saved: true,
      theme: "paper",
      retrievedAt: at,
      query,
      catalogSource: CATALOG_PAGE,
    });
    if (results.length >= 6) break;
  }
  return {
    results,
    summary: results.length
      ? "已从实时公开索引匹配到相近公司的路演材料。"
      : "当前公开索引未找到匹配项。可尝试公司英文名或“协作SaaS、人工智能、制造业、零售、金融”等产品类别。",
    meta: {
      provider: "公开索引",
      model: "公开路演目录实时检索",
      generatedAt: at,
      sourceCount: rows.length,
      searchCalls: 1,
      catalogUrl: CATALOG_PAGE,
      responseId: "catalog-" + randomUUID(),
      scope: "public_catalog",
      rights: "只保存来源链接和目录信息，不下载或重新发布第三方PPT。",
    },
  };
}
