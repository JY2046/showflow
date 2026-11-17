export const AI_MODES = { device: "only_on_device", hybrid: "prefer_on_device", cloud: "only_in_cloud" };
export function assertPolicy({ mode, consent, language, pages }) {
  if (!Object.hasOwn(AI_MODES, mode)) throw new Error("请选择有效的处理方式。");
  if (!consent) throw new Error("请先确认本次处理范围。");
  if (!pages.length || pages.length > (mode === "device" ? 6 : 20)) throw new Error("请选择支持范围内的页面。");
  if (new Set(pages.map(p => p.id)).size !== pages.length || pages.some(p => typeof p.id !== "string" || [p.title,p.body,p.script].some(v => typeof v !== "string") || (p.title+p.body+p.script).length > 12000)) throw new Error("页面文字超出支持范围。");
  // Chrome currently supports English, Japanese, Spanish, German and French.
  if (mode !== "cloud" && (language !== "en" || pages.some(p => /[\u3400-\u9fff]/u.test(p.title+p.body+p.script)))) throw new Error("当前设备模型支持英文改版。中文原稿请明确选择云端处理，或导入英文演示稿。");
}
export function sourceFromSdk(source, mode) {
  if (!["on_device", "in_cloud"].includes(source)) throw new Error("服务未报告推理来源，本次结果未采用。");
  if (mode === "device" && source !== "on_device") throw new Error("设备内处理返回了非设备结果，已拦截。");
  if (mode === "cloud" && source !== "in_cloud") throw new Error("云端处理来源不匹配，已拦截。");
  return source === "on_device" ? "ON_DEVICE" : "IN_CLOUD";
}
export function referenceNotes(references = []) {
  return references.slice(0, 6).map(r => ({ id: String(r.id), name: String(r.name).slice(0,100), note: String(r.myNote?.trim() || r.note || "").slice(0,700), evidenceLevel: r.myNote?.trim() ? "user_notes" : r.catalogSource ? "metadata_only" : "editorial_notes" }));
}
export function lockStatusFacts(body) {
  const sentences = String(body).split(/(?<=[。！？])\s*|(?<=[.!?])\s+/u).filter(s => s.trim());
  const protectedStatus = /\b(?:prototype|plan(?:ned|ning|s)?|unverified|unvalidated|not (?:yet )?(?:been )?(?:validated|verified|proven)|hasn.t been validated|intend|aim to)\b|计划|拟邀请|尚未|待验证|原型|未经验证/iu;
  const locked = sentences.filter(s => protectedStatus.test(s)).map(s => s.trim());
  return { locked, editable: sentences.filter(s => !protectedStatus.test(s)).join(" ").trim() };
}
