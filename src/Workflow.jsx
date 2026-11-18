import { referenceText, referencesForRequest } from "./reference-i18n";
import { t, useLocale, uiMessage, formatDate, getLocale } from "./i18n";
import React, { useEffect, useRef, useState } from "react";
import { UploadSimple, MagnifyingGlass, Sparkle, ArrowRight, Check, DownloadSimple, ArrowCounterClockwise, FilePpt, ArrowUpRight, WarningCircle, X } from "@phosphor-icons/react";
import { FirebasePanel, safeAiError, CloudQuotaHelp } from "./FirebasePanel";
import { reviseWithFirebase } from "./firebase-ai";
import { importPptx } from "./pptx-import";
import { themes, downloadJson } from "./deck";
import { isHostedPreview } from "./release";
import { groupReferences, externalSearchUrl } from "./reference-batches";
import { ReferenceGroup, MatchDetails } from "./ReferenceGroup";
export function OriginalSlide({
  scene
}) {
  const o = scene.original;
  if (!o) return null;
  return <div className="original-slide" role="img" aria-label={t("{0} 原稿内容解析预览", [uiMessage(scene.name)])} style={{
    aspectRatio: `${o.width}/${o.height}`,
    background: o.background
  }}>
      {o.elements.map((e, i) => <div key={i} style={{
      position: "absolute",
      left: `${e.x / o.width * 100}%`,
      top: `${e.y / o.height * 100}%`,
      width: `${e.w / o.width * 100}%`,
      height: `${e.h / o.height * 100}%`,
      background: e.fill || "transparent",
      color: e.color,
      fontWeight: e.bold ? 700 : 400,
      fontSize: e.size ? `${e.size / (o.width / 12700) * 100}cqw` : undefined,
      fontFamily: `"${e.font || "PingFang SC"}",sans-serif`,
      textAlign: {
        l: "left",
        ctr: "center",
        r: "right",
        just: "justify"
      }[e.align] || "left",
      whiteSpace: "pre-wrap",
      lineHeight: 1.2,
      overflow: "hidden"
    }}>
          {e.type === "image" ? <img src={e.image} alt={t("原稿嵌入图片")} /> : e.text}
        </div>)}
    </div>;
}
export async function callApi(path, body) {
  if (path === "search" && isHostedPreview()) {
    const { searchPublicCatalog } = await import("./catalog.js");
    return searchPublicCatalog(body);
  }
  const r = await fetch("/api/showflow/" + path, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });
  let data;
  try {
    data = await r.json();
  } catch {
    throw new Error("当前服务没有返回有效结果，请检查本地服务后重试。");
  }
  if (!r.ok) throw new Error(data.error || "请求失败，请重试。");
  return data;
}
export function SearchPanel({
  onSearch,
  searching,
  searchError,
  lastSearch,
  compact = false
}) {
  const [query, setQuery] = useState(lastSearch?.query || "Front");
  useEffect(() => {
    if (lastSearch?.query) setQuery(lastSearch.query);
  }, [lastSearch?.query]);
  return <section className={"auto-search-panel " + (compact ? "compact" : "")}>
      <div className="workflow-section-heading">
        <span className="step-badge">02</span>
        <div>
          <h3>{t("按关键词搜集参考材料")}</h3>
          <p>{t("当前免费目录只提供公司名、材料标题、年份和轮次；不含行业描述或PPT/PDF正文。")}</p>
        </div>
      </div>
      <form onSubmit={e => {
      e.preventDefault();
      onSearch(query);
    }}>
        <label>{t("公司名或公开业务关键词")}<input aria-label={t("自动搜集搜索词")} maxLength={200} minLength={2} required value={query} onChange={e => setQuery(e.target.value)} placeholder={t("如 Front、2016、Series A；行业检索可用下方网上搜索")} />
        </label>
        <button className="primary" disabled={searching}>
          <MagnifyingGlass size={18} />
          {searching ? t("正在核对目录…") : t("搜索公开目录")}
        </button>
      </form>
      {searching && <p className="workflow-status" role="status">{t("正在读取公开目录，逐项核对关键词与材料元信息…")}</p>}
      {searchError && <p className="workflow-error" role="alert">
          {uiMessage(searchError)}
        </p>}
      {lastSearch && !searching && <div className="search-receipt"><p className="scope-note">{t("上次成功查询：")}{lastSearch.query} · {t("全部关键词命中 {0} 条", [lastSearch.count])} · {t("部分匹配 {0} 条", [lastSearch.relatedCount || 0])} · {formatDate(lastSearch.at)}</p>
        {lastSearch.queryTerms?.length > 0 && <p className="scope-note">{t("本次匹配条件：")}{lastSearch.queryTerms.join(" · ")}</p>}
      </div>}
      <div className="external-reference-search"><p>{t("精确行业搜索：保留你的完整关键词，在新页查找PDF或PPT，再收藏合适的来源。")}</p><a className="text-link" href={externalSearchUrl(query, "pdf")} target="_blank" rel="noreferrer">{t("到网上找PDF")} <ArrowUpRight size={14} /></a><a className="text-link" href={externalSearchUrl(query, "ppt")} target="_blank" rel="noreferrer">{t("到网上找PPT/PPTX")} <ArrowUpRight size={14} /></a><small>{t("外部搜索不会自动回填；只传搜索框文字，原稿留在本机。")}</small></div>
    </section>;
}
export function Workflow({
  scenes,
  projectName,
  importMeta,
  onImport,
  downloadOriginal,
  onNavigate,
  references,
  setReferences,
  onSearch,
  searching,
  searchError,
  lastSearch,
  plan,
  setPlan,
  onApplyRevision,
  aiBackup,
  onUndoAi,
  notify
}) {
  const input = useRef();
  const [runtime, setRuntime] = useState(null),
    [mode, setMode] = useState("device"),
    [language, setLanguage] = useState("en"),
    [aiProgress, setAiProgress] = useState(null);
  const [pending, setPending] = useState(null),
    [importing, setImporting] = useState(false),
    [importError, setImportError] = useState(""),
    [status, setStatus] = useState(null),
    [purpose, setPurpose] = useState("Make the pitch concise. Lead with user value and preserve all qualifications and unverified claims."),
    [consent, setConsent] = useState(false),
    [includeNotes, setIncludeNotes] = useState(false),
    [selected, setSelected] = useState(() => scenes.slice(0, 6).map(s => s.id)),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [chosen, setChosen] = useState(() => plan?.appliedIds || plan?.pages?.map(p => p.id) || []);
  const cloud = mode === "hybrid" || mode === "cloud" || mode === "legacy" && status?.cloud;
  useEffect(() => setConsent(false), [mode, language, includeNotes, selected.join("|"), purpose]);
  useEffect(() => {
    if (isHostedPreview()) { setStatus({ configured: false, cloud: false }); return; }
    const check = () => fetch("/api/showflow/status").then(r => r.json()).then(setStatus).catch(() => setStatus({
      configured: false,
      cloud: false
    }));
    check();
    const id = setInterval(check, 5000);
    return () => clearInterval(id);
  }, []);
  const maxPages = mode === "legacy" ? status?.maxPages || 6 : mode === "device" ? 6 : 20;
  useEffect(() => setSelected(scenes.slice(0, maxPages).map(s => s.id)), [scenes.map(s => s.id).join("|"), maxPages]);
  useEffect(() => setChosen(plan?.appliedIds || plan?.pages?.map(p => p.id) || []), [plan?.meta?.responseId]);
  const selectedRefs = references.filter(r => r.forRewrite).slice(0, 6),
    availableRefs = references.filter(r => r.saved || r.discovered),
    referenceGroups = groupReferences(availableRefs, lastSearch);
  useEffect(() => setConsent(false), [JSON.stringify(selectedRefs)]);
  async function read(file) {
    if (!file) return;
    setImporting(true);
    setImportError("");
    try {
      setPending(await importPptx(file));
    } catch (e) {
      setImportError(e.message);
    } finally {
      setImporting(false);
      input.current.value = "";
    }
  }
  async function revise() {
    setBusy(true);
    setError("");
    const before = scenes.filter(s => selected.includes(s.id));
    try {
      const input = {
        mode,
        language,
        consent,
        includeNotes,
        purpose,
        pages: before.map(s => ({
          id: s.id,
          title: s.title,
          body: s.deckBody ?? s.goal,
          script: includeNotes ? s.script : "",
          hasImage: !!s.image,
          includeNotes
        })),
        references: referencesForRequest(selectedRefs, language)
      };
      const result = mode === "legacy" ? await callApi("revise", input) : await reviseWithFirebase(runtime, input, setAiProgress);
      setPlan({
        ...result,
        before: before.map(s => ({
          id: s.id,
          title: s.title,
          body: s.deckBody ?? s.goal,
          script: s.script
        })),
        includeNotes,
        referenceSnapshot: selectedRefs.map(r => ({
          id: r.id,
          name: r.name,
          url: r.url,
          note: r.myNote?.trim() || r.note || "",
          evidenceLevel: r.myNote?.trim() ? "user_notes" : r.catalogSource ? "metadata_only" : "editorial_notes"
        })),
        applied: false
      });
      notify(t("AI建议已生成，先对照原稿，再选择采用哪些页面。"));
    } catch (e) {
      setError(safeAiError(e));
    } finally {
      setBusy(false);
      setConsent(false);
    }
  }
  return <section className="workflow-workspace">
      <div className="workspace-intro">
        <div>
          <div className="eyebrow">PITCH WORKSPACE</div>
          <h2>{t("从自己的 PPT，走到下一次好路演。")}</h2>
          <p>{t("导入原稿，找到同类案例，让 AI 给出有依据的改版，再进入彩排。")}</p>
        </div>
        <span className={"provider-badge " + (runtime ? "ready" : "")}>
          {runtime ? t("Firebase AI Logic 已连接") : t("Firebase 待连接，可先导入与搜集")}
        </span>
      </div>
      <div className="workflow-grid">
        <div>
          <section className="import-panel">
            <div className="workflow-section-heading">
              <span className="step-badge">01</span>
              <div>
                <h3>{t("导入自己的路演 PPT")}</h3>
                <p>{t("在本机提取文字与图片，原文件独立保留。")}</p>
              </div>
            </div>
            <button className="import-dropzone" disabled={importing} onClick={() => input.current.click()}>
              <FilePpt size={34} />
              <strong>{importing ? t("正在本机解析…") : t("选择 PPTX 文件")}</strong>
              <span>{t("1–30 页 · 最大 30MB · 文件不会上传到模型")}</span>
            </button>
            <input hidden ref={input} type="file" accept=".pptx,application/vnd.openxmlformats-officedocument.presentationml.presentation" aria-label={t("导入自己的PPTX")} onChange={e => read(e.target.files[0])} />
            {importError && <p className="workflow-error" role="alert">
                {uiMessage(importError)}
              </p>}
            {pending && <div className="import-confirm">
                <div className="detail-heading">
                  <h4>
                    {pending.name} · {pending.scenes.length}{t(" 页 ")}</h4>
                  <button className="icon-button" aria-label={t("取消本次导入")} onClick={() => setPending(null)}>
                    <X size={18} />
                  </button>
                </div>
                <div className="import-thumbnails">
                  {pending.scenes.slice(0, 4).map(s => <div key={s.id}>
                      <OriginalSlide scene={s} />
                      <span>
                        {uiMessage(s.name)} · {s.title}
                      </span>
                    </div>)}
                </div>
                <p className="scope-note">{t("这是原稿内容的解析预览；字体、母版、复杂图形可能与 PowerPoint 不同。重排版使用可编辑文字和每页主图，其他图片与动画保留在原文件。 ")}</p>
                {pending.warnings.length > 0 && <details className="import-warning">
                    <summary>
                      {pending.warnings.length}{t(" 项需对照原文件检查 ")}</summary>
                    <ul>
                      {pending.warnings.slice(0, 30).map((w, i) => <li key={i}>{uiMessage(w)}</li>)}
                    </ul>
                  </details>}
                <button className="primary" disabled={importing} onClick={async () => {
              setImporting(true);
              try {
                await onImport(pending);
                setPending(null);
              } catch (e) {
                setImportError(t("保存原文件失败，未替换当前项目：") + e.message);
              } finally {
                setImporting(false);
              }
            }}>
                  <Check size={17} />{t("使用这份 PPT，保留当前版本 ")}</button>
              </div>}
            <div className="current-project">
              <div>
                <small>{t("当前项目")}</small>
                <strong>{projectName}</strong>
                <span>
                  {scenes.length}{t(" 页 ")}{importMeta ? t(" · 原文件 {0}KB", [Math.round(importMeta.size / 1024)]) : t(" · 合成示例")}
                </span>
              </div>
              {importMeta && <button className="quiet-button" onClick={downloadOriginal}>
                  <DownloadSimple size={16} />{t("下载原文件 ")}</button>}
              <button className="quiet-button" onClick={() => onNavigate("director")}>{t("查看导演台 ")}<ArrowRight size={16} />
              </button>
            </div>
          </section>
          <SearchPanel onSearch={onSearch} searching={searching} searchError={uiMessage(searchError)} lastSearch={lastSearch} />
          <section className="rewrite-references">
              <div className="detail-heading">
                <h3>{t("选择改版参考 ")}<small>{t("已选{0}条 / 最多6条", [selectedRefs.length])}</small>
                </h3>
                <button className="text-link" onClick={() => onNavigate("references")}>{t("打开参考库 ")}<ArrowRight size={15} />
                </button>
              </div>
              <p className="scope-note">{t("AI 使用来源摘要与自己的借鉴笔记。仅有目录信息的案例，先补充借鉴点，再用于改版归因。 ")}</p>
              {referenceGroups.map(group => <ReferenceGroup key={group.id} group={group} lastSearch={lastSearch}>{group.items.map(r => <div key={r.id} className="reference-candidate"><label className="reference-checkbox">
                  <input type="checkbox" checked={!!r.forRewrite} disabled={!r.forRewrite && selectedRefs.length >= 6} onChange={e => setReferences(p => p.map(x => x.id === r.id ? {
              ...x,
              forRewrite: e.target.checked
            } : x))} />
                  <span>
                    <strong>{r.name}</strong>
                    <small>
                      {r.discovered ? t("联网搜集 · ") : ""}
                      {referenceText(r, "kind")} · {referenceText(r, "publisher")}
                      {r.myNote?.trim() ? t(" · 已写借鉴笔记") : r.catalogSource ? t(" · 可补充借鉴笔记") : ""}
                    </small>
                  </span>
                </label><a className="candidate-source" href={r.url} target="_blank" rel="noreferrer">{t("来源 ")}<ArrowUpRight size={12} /></a><MatchDetails reference={r} />
                {group.id === "history" && r.query && <p className="reference-history-query">{t("历史查询：")}{r.query}</p>}
                </div>)}</ReferenceGroup>)}
            </section>
        </div>
        <section className="ai-panel">
          <div className="workflow-section-heading">
            <span className="step-badge">03</span>
            <div>
              <h3>
                {cloud ? t("端云 AI，先看建议") : t("设备内 AI，先看建议")}
              </h3>
              <p>{t("精简表达、选择版式，说明参考了什么。")}</p>
            </div>
          </div>
          <FirebasePanel runtime={runtime} setRuntime={setRuntime} mode={mode} setMode={setMode} language={language} setLanguage={setLanguage} busy={busy} />
          <label className="workflow-field">{t("这次想怎样调整 ")}<textarea aria-label={t("AI改版要求")} rows={3} maxLength={600} value={purpose} onChange={e => setPurpose(e.target.value)} />
          </label>
          <div className="page-select-heading">
            <span>{t("改版页面 · 已选 ")}{selected.length}/{maxPages}
            </span>
            <button className="text-link" onClick={() => setSelected(selected.length ? [] : scenes.slice(0, maxPages).map(s => s.id))}>
              {selected.length ? t("取消全选") : t("选择前{0}页", [maxPages])}
            </button>
          </div>
          <div className="rewrite-page-select">
            {scenes.map((s, i) => <label key={s.id}>
                <input type="checkbox" checked={selected.includes(s.id)} disabled={!selected.includes(s.id) && selected.length >= maxPages} onChange={e => setSelected(p => e.target.checked ? [...p, s.id] : p.filter(id => id !== s.id))} />
                <span>
                  {i + 1}. {s.title}
                </span>
              </label>)}
          </div>
          <label className="note-consent">
            <input type="checkbox" checked={includeNotes} onChange={e => setIncludeNotes(e.target.checked)} />{t("同时优化所选页的演讲备注 ")}</label>
          <details className="send-preview">
            <summary>{t("查看将用于 AI 的文字（")}{selected.length}{t("页）")}</summary>
            {scenes.filter(s => selected.includes(s.id)).map(s => <article key={s.id}>
                  <strong>{s.title}</strong>
                  <p>{s.deckBody ?? s.goal}</p>
                  {includeNotes && <p>{t("备注：")}{s.script}</p>}
                </article>)}
          </details>
          <label className="cloud-consent">
            <input type="checkbox" checked={consent} onChange={e => setConsent(e.target.checked)} />
            <span>
              {cloud ? t("我确认本次可将所选页的标题、正文{0}、改版要求及参考摘要发送给 {1}。原始文件与图片留在本机。", [includeNotes ? t("和备注") : "", mode === "legacy" ? "OpenAI" : t("Google Gemini（通过 Firebase）")]) : t("使用本机 AI 处理所选页的标题、正文{0}及参考摘要；这些内容不会发送到外部模型服务。", [includeNotes ? t("和备注") : ""])}
            </span>
          </label>
          <button className="primary generate-revision" disabled={busy || !consent || !selected.length || (mode === "legacy" ? !status?.configured : !runtime)} onClick={revise}>
            <Sparkle size={20} />
            {busy ? t("AI 正在逐页生成建议…") : t("生成 AI 改版建议")}
          </button>
          {busy && <p className="workflow-status" role="status">{t("正在生成第 ")}{aiProgress?.page || 1}/{aiProgress?.total || selected.length}{t(" 页建议，完成前不改变你的页面。 ")}</p>}
          {error && <p className="workflow-error" role="alert">
              {uiMessage(error)}
            </p>}
          <CloudQuotaHelp error={error} />
          <p className="scope-note">{t("自动检查新增数字和引用来源；业务事实仍需你核对。先看逐页对比，确认后再采用。 ")}</p>
        </section>
      </div>
      {plan && <section className="revision-result">
          <div className="revision-heading">
            <div>
              <div className="eyebrow">REVIEW CHANGES</div>
              <h3>{error ? t("上一次成功建议（本次未生成新建议）") : t("逐页看过，再决定怎么改。")}</h3>
              <p>{plan.summary}</p>
              <small data-testid="inference-source">
                {plan.meta.provider} · {plan.meta.model} · {plan.meta.inferenceSources?.join(" + ")} ·{" "}
                {formatDate(plan.meta.generatedAt)} ·{" "}
                {plan.pages.length}{t(" 页 · 建议主题： ")}{t(themes.find(themeItem => themeItem.id === plan.theme)?.name)}
              </small>
              {plan.meta.appCheck?.verified && <p className="scope-note">{t("App Check 已验证 · 推理来源由 Firebase SDK 报告")}</p>}
            </div>
            <div>
              <button className="primary" disabled={busy || !chosen.length || plan.applied} onClick={() => onApplyRevision(plan, chosen)}>
                <Check size={18} />
                {plan.applied ? t("已应用 {0} 页建议", [plan.appliedIds?.length || chosen.length]) : t("采用 {0} 页建议", [chosen.length])}
              </button>
              <button className="secondary" onClick={() => downloadJson({ ...plan, interfaceLanguage: getLocale(), pages: plan.pages.map(page => ({...page, review: uiMessage(page.review)})) }, `${projectName}_AI_revision.json`)}>
                <DownloadSimple size={17} />{t("导出改版记录 ")}</button>
              {aiBackup && <button className="secondary" onClick={onUndoAi}>
                  <ArrowCounterClockwise size={18} />{t("撤回上次 AI 改版 ")}</button>}
            </div>
          </div>
          <div className="revision-list">
            {plan.pages.map(p => {
          const b = plan.before.find(x => x.id === p.id);
          return <article key={p.id} className="revision-page">
                  <label className="revision-page-title">
                    <input type="checkbox" disabled={plan.applied} checked={chosen.includes(p.id)} onChange={e => setChosen(ids => e.target.checked ? [...ids, p.id] : ids.filter(id => id !== p.id))} />
                    <strong>
                      {scenes.findIndex(s => s.id === p.id) + 1}. {b?.title}
                    </strong>
                    <span>
                      {{
                  split: t("左文右图"),
                  top: t("标题在上"),
                  image: t("画面优先"),
                  statement: t("观点大字")
                }[p.layout]}
                    </span>
                  </label>
                  <div className="revision-comparison">
                    <div>
                      <small>{t("原稿")}</small>
                      <h4>{b?.title}</h4>
                      <p>{b?.body}</p>
                    </div>
                    <div>
                      <small>{t("AI 建议")}</small>
                      <h4>{p.title}</h4>
                      <p>{p.body}</p>
                    </div>
                  </div>
                  <div className="revision-reason">
                    <Sparkle size={16} />
                    <p>
                      {p.reason}
                      <span>{uiMessage(p.review)}</span>
                    </p>
                  </div>
                  {p.referenceIds.length > 0 && <div className="revision-citations">{t("借鉴来源： ")}{p.referenceIds.map(id => {
                const ref = plan.referenceSnapshot?.find(r => r.id === id);
                return ref && <a key={id} href={ref.url} target="_blank" rel="noreferrer">
                              {ref.name} <ArrowUpRight size={12} />
                            </a>;
              })}
                    </div>}
                  {plan.includeNotes && <details>
                      <summary>{t("演讲备注改动")}</summary>
                      <div className="revision-comparison">
                        <p>{b?.script}</p>
                        <p>{p.script}</p>
                      </div>
                    </details>}
                </article>;
        })}
          </div>
          {plan.applied && <div className="revision-next">
              <Check size={20} />
              <span>{t("改版已更新到当前项目，原稿与旧版本保留。")}</span>
              <button className="primary" onClick={() => onNavigate("styles")}>{t("查看样式与导出 ")}<ArrowRight size={18} />
              </button>
              <button className="secondary" onClick={() => onNavigate("rehearsal")}>{t("开始彩排 ")}</button>
            </div>}
        </section>}
    </section>;
}
