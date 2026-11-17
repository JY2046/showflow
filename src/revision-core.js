export class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}
export function numericTokens(text) {
  return new Set(
    String(text).match(
      /\d+(?:[.,]\d+)*(?:%|％|亿|万|千|元|人|家|个|年|月|天|小时|分钟|秒)?/g,
    ) || [],
  );
}
export function validateRevision(data, pages, references) {
  const allowed = new Map(pages.map((p) => [p.id, p]));
  const refIds = new Set(references.map((r) => r.id));
  const seen = new Set();
  if (!data || !["stage", "paper", "ink", "warm"].includes(data.theme) || typeof data.summary !== "string" || !Array.isArray(data.pages) || data.pages.length !== pages.length)
    throw new ApiError(502, "建议页数与选择不一致，请重试。");
  return {
    ...data,
    pages: data.pages.map((p) => {
      const original = allowed.get(p.id);
      if (!original || seen.has(p.id))
        throw new ApiError(502, "模型返回了不属于当前项目的页面，已拦截。");
      seen.add(p.id);
      if (
        typeof p.title !== "string" ||
        !p.title.trim() ||
        typeof p.body !== "string" ||
        typeof p.script !== "string" ||
        typeof p.reason !== "string" ||
        !Array.isArray(p.referenceIds) ||
        p.title.length > 42 ||
        p.body.length > 140 ||
        !["split", "top", "image", "statement"].includes(p.layout) ||
        p.referenceIds.some((id) => !refIds.has(id) || references.find((r) => r.id === id)?.evidenceLevel === "metadata_only")
      )
        throw new ApiError(502, "建议格式或参考来源不匹配，已拦截，请重试。");
      const oldNumbers = numericTokens(
          [original.title, original.body, original.script].join("\n"),
        ),
        newNumbers = numericTokens(
          [p.title, p.body, original.includeNotes ? p.script : ""].join("\n"),
        );
      const invented = [...newNumbers].filter((n) => !oldNumbers.has(n));
      if (invented.length)
        throw new ApiError(
          502,
          "建议出现原稿没有的数字，已拦截。请重试或缩小修改范围。",
        );
      const contentBefore = [original.title, original.body, original.includeNotes ? original.script : ""].join("\n");
      const contentAfter = [p.title, p.body, original.includeNotes ? p.script : ""].join("\n");
      for (const ref of references) {
        if (!ref.name || ref.name.length < 3) continue;
        const escaped = ref.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const name = new RegExp((/^[a-z0-9 .-]+$/i.test(ref.name) ? "\\b" + escaped + "\\b" : escaped), "i");
        if (name.test(contentAfter) && !name.test(contentBefore))
          throw new ApiError(502, "建议将参考公司的名称写入了你的正文，已拦截。请缩小修改范围后重试。");
      }
      const omitted = [
        ...numericTokens([original.title, original.body].join("\n")),
      ].filter((n) => !newNumbers.has(n));
      return {
        ...p,
        script: original.includeNotes ? p.script : original.script,
        layout: original.hasImage ? p.layout : "statement",
        review: omitted.length
          ? `需复核：精简后未出现原稿数字 ${omitted.join("、")}`
          : "仍需由你确认业务表述与原稿一致。",
      };
    }),
  };
}
