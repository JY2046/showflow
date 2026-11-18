import React from "react";
import { t } from "./i18n";
export function ReferenceGroup({ group, children, lastSearch, filtered = false }) {
  const selected = group.items.filter(r => r.forRewrite).length;
  const heading = <><strong>{t(group.label)}</strong><span>{group.items.length}{t(" 条")}{selected ? t(" · 已勾选{0}条", [selected]) : ""}</span></>;
  if (group.id !== "current" && !group.items.length) return null;
  const content = <>
    {group.id === "current" && <p className="scope-note">{lastSearch?.resultIds ? t("目录元信息匹配，不代表已核对完整PPT/PDF；请自行选择用于改版的材料。") : lastSearch ? t("旧版搜索记录已归入历史参考，请重新搜集以生成本次结果。") : t("还未执行本次搜索。历史收藏与示例保留在下方。")}</p>}
    {group.id === "current" && !group.items.length && lastSearch?.resultIds && <p className="reference-no-match" role="status">{filtered && lastSearch.count ? t("当前筛选下没有本次结果，可清除参考库筛选后查看。") : t("未找到命中全部关键词的材料。没有自动加入宽泛的行业案例。")}</p>}
    {group.id === "partial" && <p className="scope-note">{t("这些材料只命中部分词；缺少的条件列在每条下面，不会自动勾选。")}</p>}
    {children}
  </>;
  if (group.id === "current") return <section className="reference-batch" data-reference-group="current"><div className="reference-batch-heading">{heading}</div>{content}</section>;
  return <details className="reference-batch" data-reference-group={group.id}><summary className="reference-batch-heading">{heading}</summary>{content}</details>;
}
export function MatchDetails({ reference }) {
  const matching = reference.matching;
  if (!matching) return null;
  const fields = { company_name: "公司名", display_name: "材料标题", year: "年份", round: "融资轮次" };
  return <span className="reference-match-details">
    <span>{t("命中：")}{matching.matched.map(hit => `${hit.keyword} (${t(fields[hit.field] || hit.field)})`).join(" · ")}</span>
    {matching.missing.length > 0 && <span className="reference-missing">{t("未命中：")}{matching.missing.join(" · ")}</span>}
  </span>;
}
