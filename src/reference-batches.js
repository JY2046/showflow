import { referenceSeeds } from "./references.js";
const canonical = value => String(value || "").replace(/\/$/, "");
export function mergeReferenceBatch(previous, response, query) {
  let history = previous.map(reference => ({ ...reference, forRewrite: false }));
  const batchId = response.meta.responseId;
  const merge = (items, level) => items.map(item => {
    const old = history.find(reference => canonical(reference.url) === canonical(item.url));
    if (old) history = history.filter(reference => reference.id !== old.id);
    return { ...item, id: old?.id || item.id, myNote: old?.myNote || "", saved: old?.saved ?? item.saved,
      query, searchBatchId: batchId, matchLevel: level, forRewrite: false };
  });
  const current = merge(response.results || [], "all");
  const related = merge(response.relatedResults || [], "partial");
  return { references: [...current, ...related, ...history], lastSearch: {
    query, count: current.length, relatedCount: related.length, at: response.meta.generatedAt,
    model: response.meta.model, responseId: batchId, resultIds: current.map(r => r.id),
    relatedResultIds: related.map(r => r.id), queryTerms: response.meta.queryTerms || [], limitations: response.meta.limitations,
  } };
}
export function groupReferences(references, lastSearch) {
  const currentIds = new Set(lastSearch?.resultIds || []), relatedIds = new Set(lastSearch?.relatedResultIds || []);
  const seeds = new Set(referenceSeeds.map(r => r.id));
  const groups = [
    { id: "current", label: "本次结果 · 全部关键词命中", items: [] },
    { id: "partial", label: "部分匹配 · 并非同类推荐", items: [] },
    { id: "history", label: "历史参考与收藏", items: [] },
    { id: "builtin", label: "内置示例与方法模板", items: [] },
  ];
  for (const reference of references) {
    const inBatch = reference.searchBatchId && reference.searchBatchId === lastSearch?.responseId;
    const index = currentIds.has(reference.id) || inBatch && reference.matchLevel === "all" ? 0 : relatedIds.has(reference.id) || inBatch && reference.matchLevel === "partial" ? 1 : seeds.has(reference.id) && !reference.saved && !reference.myNote && !reference.discovered ? 3 : 2;
    groups[index].items.push(reference);
  }
  return groups;
}
export function externalSearchUrl(query, type = "pdf") {
  const formats = type === "pdf" ? "filetype:pdf" : "(filetype:ppt OR filetype:pptx)";
  return "https://www.google.com/search?q=" + encodeURIComponent(`${String(query).trim()} ("pitch deck" OR "investor presentation" OR "路演") ${formats}`);
}
