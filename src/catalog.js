const CATALOG_URL = "https://raw.githubusercontent.com/midovislam/awesome-pitch-decks/main/deck_index.csv";
const CATALOG_PAGE = "https://github.com/midovislam/awesome-pitch-decks";
const randomUUID = () => globalThis.crypto.randomUUID();

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

const normalize = s => String(s || "").normalize("NFKC").toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");
const aliases = [
  { pattern: /forward[-\s]+deployed|\bfde\b/ig, aliases: ["forward deployed", "forward-deployed", "FDE"] },
  { pattern: /ai\s*agents?|agent\s*builder|智能体|agent构建/ig, aliases: ["AI agent", "AI agents", "agent builder", "智能体"] },
  { pattern: /出海外贸|跨境(?:贸易|电商)?|外贸|cross[-\s]border|foreign trade/ig, aliases: ["出海外贸", "跨境", "外贸", "cross-border", "cross border", "foreign trade"] },
  { pattern: /企业服务|enterprise services?/ig, aliases: ["企业服务", "enterprise services", "enterprise service"] },
  { pattern: /协作|collaboration/ig, aliases: ["协作", "collaboration"] },
  { pattern: /种子轮|\bseed\b/ig, aliases: ["Seed", "Pre-Seed", "种子轮"] },
  { pattern: /a轮|series\s*a\b/ig, aliases: ["Series A", "A轮"] },
  { pattern: /b轮|series\s*b\b/ig, aliases: ["Series B", "B轮"] },
];
export function queryTerms(query) {
  // Extract actual terms and explicit synonyms, never map an industry to companies.
  let remaining = String(query).normalize("NFKC").replace(/pitch\s*decks?|investor\s*presentation|\bpptx?\b|\bpdf\b|路演(?:材料|文稿)?|商业计划书/ig, " ");
  const terms = [];
  for (const entry of aliases) {
    remaining = remaining.replace(entry.pattern, value => {
      terms.push({ label: value.trim(), aliases: entry.aliases });
      return " ";
    });
  }
  for (const value of remaining.split(/[\s,，、;；|/]+/u).map(x => x.replace(/^["“”'()（）]+|["“”'()（）]+$/g, "")).filter(Boolean)) {
    if (["and", "or", "的", "与", "和"].includes(value.toLowerCase())) continue;
    terms.push({ label: value, aliases: [value] });
  }
  return terms.filter((term, i) => terms.findIndex(x => normalize(x.label) === normalize(term.label)) === i).slice(0, 16);
}
const escape = s => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
function includesTerm(value, term) {
  const text = String(value || "").normalize("NFKC").toLowerCase();
  return term.aliases.some(alias => {
    const n = alias.toLowerCase();
    if (/[\u3400-\u9fff]/u.test(n)) return text.includes(n);
    return new RegExp(`(^|[^\\p{L}\\p{N}])${escape(n).replace(/[ -]+/g, "[ -]+")}(?=$|[^\\p{L}\\p{N}])`, "u").test(text);
  });
}
export function rankCatalog(rows, query) {
  const terms = queryTerms(query);
  if (!terms.length) return [];
  return rows.map(r => {
    const fields = ["company_name", "year", "round", "display_name"];
    const hits = terms.flatMap(term => {
      const field = fields.find(field => includesTerm(r[field], term));
      return field ? [{ keyword: term.label, field, value: r[field] }] : [];
    });
    const missing = terms.filter(term => !hits.some(hit => hit.keyword === term.label)).map(term => term.label);
    return { r, score: hits.length / terms.length, industry: "通用", hits, missing, complete: missing.length === 0 };
  }).filter(x => x.hits.length).sort((a,b) => Number(b.complete)-Number(a.complete) || b.score-a.score || Number(b.r.year)-Number(a.r.year));
}
export async function searchPublicCatalog(body, { fetcher = fetch } = {}) {
  const query = String(body.query || "").trim();
  if (query.length < 2 || query.length > 200) {
    const e = new Error("请填写 2–200 个字符的行业或公司描述。"); e.status = 400; throw e;
  }
  const terms = queryTerms(query);
  if (!terms.length) { const e = new Error("请加入具体公司名或业务关键词，不能只搜索PPT/PDF。 "); e.status=400; throw e; }
  const r = await fetcher(CATALOG_URL, { cache: "no-store", signal: AbortSignal.timeout(20000) });
  if (!r.ok) throw new Error("公开路演目录暂时无法访问，请稍后重试。");
  const raw = await r.text();
  if (raw.length > 2_000_000) throw new Error("公开目录内容超出预期，未导入。");
  const rows = parseCsv(raw);
  if (!rows.length || !rows[0].company_name || !rows[0].google_drive_link) throw new Error("公开目录格式已变化，未导入未知数据。");
  const ranked = rankCatalog(rows, query), seen = new Set(), at = new Date().toISOString();
  const results=[], relatedResults=[];
  for (const match of ranked) {
    const row = match.r;
    if (seen.has(normalize(row.company_name))) continue;
    let url;
    try { url=new URL(row.google_drive_link); if (url.protocol!=="https:" || url.hostname!=="drive.google.com" || url.username || url.password) continue; } catch { continue; }
    const target=match.complete?results:relatedResults;
    if (target.length>=6) continue;
    seen.add(normalize(row.company_name));
    target.push({
      id:randomUUID(), name:row.company_name, title:row.display_name, url:url.href,
      industry:"通用", stage:({Seed:"种子轮","Pre-Seed":"种子轮","Series A":"A轮","Series B":"B轮"})[row.round]||"待标注",
      kind:"公开索引", year:row.year||"待标注", publisher:"Awesome Pitch Decks · 公开索引",
      tags:[row.company_name,row.round,row.year].filter(Boolean),
      note:`公开索引记录：${row.display_name}；仅核对目录元信息，未读取完整文件。`,
      takeaway:"先打开来源确认相关性，再记录借鉴点；本条不构成全文阅读或行业证明。",
      verified:false, discovered:true, saved:true, forRewrite:false, theme:"paper", retrievedAt:at, query, catalogSource:CATALOG_PAGE,
      matching:{ version:2, level:match.complete?"all":"partial", matched:match.hits, missing:match.missing, total:terms.length, basis:"company_title_year_round" },
    });
  }
  return { results, relatedResults,
    summary:results.length?"已找到目录元信息命中全部关键词的材料。":"当前目录没有命中全部关键词的材料。未用宽泛行业案例补齐。",
    meta:{provider:"公开索引",model:"公开目录严格关键词匹配",generatedAt:at,sourceCount:rows.length,searchCalls:1,catalogUrl:CATALOG_PAGE,
      responseId:"catalog-"+randomUUID(),scope:"catalog_metadata_exact_terms",queryTerms:terms.map(t=>t.label),relatedCount:relatedResults.length,
      searchableFields:["company_name","display_name","year","round"],
      limitations:"目录不含行业或业务描述，未读取PPT/PDF正文；不等于全网检索。",
      rights:"只保存来源链接和目录信息，不下载或重新发布第三方PPT。" }
  };
}
