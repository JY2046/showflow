import React, { useState } from "react";
import { ArrowUpRight, DownloadSimple, Info, X } from "@phosphor-icons/react";
import { useLocale } from "./i18n";
import { isHostedPreview, releaseLinks } from "./release";

export function ReviewGuide({ onLoadSample, disabled }) {
  const zh = useLocale() === "zh";
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const hosted = isHostedPreview();
  const copy = (en, cn) => zh ? cn : en;
  async function load() {
    setLoading(true);
    try { await onLoadSample(); } finally { setLoading(false); }
  }
  return <aside className="reviewer-strip" aria-label={copy("Reviewer entry", "评审入口")}>
    <div><span className="reviewer-dot" /><strong>{copy("BUILDHYBRIDAI · REVIEW PREVIEW", "BUILDHYBRIDAI · 评审预览")}</strong><span>{copy("Cloud activation pending", "云端启用待完成")}</span></div>
    <div className="reviewer-actions">
      <button className="quiet-button" disabled={disabled || loading} onClick={load}>{loading ? copy("Loading sample…", "正在载入示例…") : copy("Try English sample", "试用英文示例")}</button>
      <button className="quiet-button" aria-expanded={open} onClick={() => setOpen(!open)}><Info size={17} />{copy("Reviewer guide", "评审指引")}</button>
    </div>
    {open && <div className="reviewer-guide">
      <div className="reviewer-guide-heading"><div><div className="eyebrow">FROM DECK TO DELIVERY</div><h2>{copy("A pitch you can revise, own and rehearse.", "可改版、可保留、可彩排的路演。")}</h2></div><button className="icon-button" aria-label={copy("Close reviewer guide", "关闭评审指引")} onClick={() => setOpen(false)}><X size={20} /></button></div>
      <div className="reviewer-cards">
        <section><span>01 / TRY IT</span><h3>{copy("Follow a real workflow", "体验完整流程")}</h3><p>{copy("Load the English synthetic PPTX, collect SaaS references, style one slide, export editable PowerPoint, then rehearse and review your timings.", "载入英文合成 PPTX，搜集 SaaS 参考，修改单页样式并导出可编辑 PPT，再彩排和复盘。")}</p><p>{copy("The sample replaces the active project; your previous version and original file are kept in this browser.", "示例会成为当前项目；旧项目版本与原文件保留在本浏览器。")}</p><a href={releaseLinks.sample} download><DownloadSimple size={16} />{copy("Download English sample", "下载英文示例")}</a></section>
        <section><span>02 / VERIFIED LOCALLY</span><h3>{copy("Real device AI, reviewed by you", "真实设备内 AI，由你审阅")}</h3><p>{copy("Firebase AI Logic returned ON_DEVICE output for two English slides with App Check verified. Changes require selective adoption. View the dated, sanitized run record.", "Firebase AI Logic 对两页英文稿返回 ON_DEVICE，App Check 已验证；需逐页选择后采用。可查看带日期的脱敏记录。")}</p><a href="/evidence/on-device-run.json" target="_blank" rel="noreferrer">{copy("Open previous run record", "查看历史运行记录")}<ArrowUpRight size={16} /></a></section>
        <section><span>03 / CURRENT LIMITS</span><h3>{copy(hosted ? "Hosted AI is not active yet" : "Cloud validation is pending", hosted ? "线上 AI 暂未启用" : "云端验证待完成")}</h3><p>{copy("Live cloud generation and fallback await quota. Exact Nano 4 identity is unconfirmed. The hosted preview supports import, live catalog search, styles, export and rehearsal without AI setup.", "实时云端生成和接力等待额度；Nano 4 具体版本尚未确认。线上预览可使用导入、实时目录检索、样式、导出和彩排。")}</p><a href={releaseLinks.guide} target="_blank" rel="noreferrer">{copy("Full testing instructions", "完整测试说明")}<ArrowUpRight size={16} /></a> · <a href={releaseLinks.repository} target="_blank" rel="noreferrer">GitHub<ArrowUpRight size={16} /></a></section>
      </div>
    </div>}
  </aside>;
}
