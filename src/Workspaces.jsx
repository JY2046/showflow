import { referenceText, referencesForRequest } from "./reference-i18n";
import { t, useLocale, uiMessage, formatDate } from "./i18n";
import React, { useState, useEffect, useRef } from "react";
import { MagnifyingGlass, ArrowUpRight, BookmarkSimple, Plus, Check, Palette, ArrowCounterClockwise, DownloadSimple, ArrowRight, X } from "@phosphor-icons/react";
import { themes, effectiveStyle, slideLayout, downloadJson, exportDeck } from "./deck";
import { validPublicUrl } from "./references";
import { SearchPanel, OriginalSlide } from "./Workflow";
import { groupReferences } from "./reference-batches";
import { ReferenceGroup, MatchDetails } from "./ReferenceGroup";
export function DeckCanvas({
  scene,
  deck,
  index = 0,
  total = 6,
  onOverflow
}) {
  const ref = useRef();
  useEffect(() => {
    if (!onOverflow) return;
    const check = () => onOverflow([...ref.current.querySelectorAll(".deck-title,.deck-body")].some(el => el.scrollHeight > el.clientHeight + 2));
    const observer = new ResizeObserver(check);
    observer.observe(ref.current);
    check();
    return () => observer.disconnect();
  }, [scene.title, scene.deckBody, deck, onOverflow]);
  const st = effectiveStyle(deck, scene.id),
    boxes = slideLayout(st);
  const position = (b, size) => ({
    left: `${b.x / 9.6}%`,
    top: `${b.y / 5.4}%`,
    width: `${b.w / 9.6}%`,
    height: `${b.h / 5.4}%`,
    fontSize: `${size / 9.6}cqw`
  });
  return <div className="deck-canvas" ref={ref} role="img" aria-label={t("{0}：{1}，{2}版式", [uiMessage(scene.name), t(st.name), st.layout])} style={{
    background: st.background,
    color: st.color,
    fontFamily: `"${st.font}",sans-serif`,
    textAlign: st.align
  }}>
      <div className="deck-label" style={{
      ...position(boxes.label, 11),
      color: st.accent
    }}>
        {scene.projectName || t("会议行动卡")} / {uiMessage(scene.name)}
      </div>
      <div className="deck-title" style={position(boxes.title, st.titleSize)}>
        {scene.title}
      </div>
      <div className="deck-body" style={position(boxes.body, st.bodySize)}>
        {scene.deckBody ?? scene.goal}
      </div>
      {boxes.image && scene.image && <div className="deck-image" style={position(boxes.image, 0)}>
          <img src={scene.image} alt={uiMessage(scene.source)} />
        </div>}
      <div className="deck-footer" style={{
      ...position(boxes.footer, 9),
      color: st.accent
    }}>
        <span>
          ShowFlow · {scene.imported ? t("用户导入材料") : t("合成示例材料")}
        </span>
        <span>
          {String(index + 1).padStart(2, "0")} /{" "}
          {String(total).padStart(2, "0")}
        </span>
      </div>
    </div>;
}
function ColorField({
  label,
  value,
  onChange
}) {
  const [hex, setHex] = useState(value);
  useEffect(() => setHex(value), [value]);
  return <label>
      {label}
      <input type="color" aria-label={t("{0}颜色", [label])} value={value} onChange={e => onChange(e.target.value)} />
      <input className="hex-input" aria-label={t("{0}十六进制色值", [label])} value={hex} maxLength={7} onChange={e => {
      setHex(e.target.value);
      if (/^#[0-9a-f]{6}$/i.test(e.target.value)) onChange(e.target.value);
    }} onBlur={() => setHex(value)} />
    </label>;
}
export function ReferenceLibrary({
  references,
  setReferences,
  onTheme,
  notify,
  onSearch,
  searching,
  searchError,
  lastSearch,
  projectName
}) {
  const [query, setQuery] = useState(""),
    [industry, setIndustry] = useState("全部"),
    [stage, setStage] = useState("全部"),
    [onlySaved, setOnlySaved] = useState(false),
    [detail, setDetail] = useState(null),
    [adding, setAdding] = useState(false),
    [draft, setDraft] = useState({
      title: "",
      url: "",
      industry: "企业服务",
      note: ""
    }),
    [error, setError] = useState("");
  const tokens = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const results = references.filter(r => (industry === "全部" || r.industry === industry) && (stage === "全部" || r.stage === stage) && (!onlySaved || r.saved) && tokens.every(q => [r.name, r.title, r.note, r.industry, r.stage, ...r.tags].join(" ").toLowerCase().includes(q)));
  const selected = references.find(r => r.id === detail);
  function update(id, change) {
    setReferences(p => p.map(r => r.id === id ? {
      ...r,
      ...change
    } : r));
  }
  function add(e) {
    e.preventDefault();
    const url = validPublicUrl(draft.url);
    if (!url) {
      setError(t("请输入完整的 http 或 https 网址。"));
      return;
    }
    if (references.some(r => validPublicUrl(r.url) === url)) {
      setError(t("这条来源已在参考库中。"));
      return;
    }
    setReferences(p => [{
      ...draft,
      id: crypto.randomUUID(),
      name: draft.title,
      title: draft.title,
      url,
      stage: "待标注",
      kind: "自收集",
      publisher: new URL(url).hostname,
      year: "待标注",
      tags: [draft.industry],
      takeaway: "待记录",
      verified: false,
      saved: true,
      theme: "paper"
    }, ...p]);
    setAdding(false);
    setDraft({
      title: "",
      url: "",
      industry: "企业服务",
      note: ""
    });
    setError("");
    notify(t("参考链接已收藏；来源内容尚未核验"));
  }
  return <section className="reference-workspace">
      <div className="workspace-intro">
        <div>
          <div className="eyebrow">REFERENCE LIBRARY</div>
          <h2>{t("先看同类，找到自己的讲法。")}</h2>
          <p>{t("本次搜索、部分匹配和历史收藏分开保留；打开来源，核对相关性，再记录借鉴点。")}</p>
        </div>
        <button className="secondary" onClick={() => setAdding(!adding)}>
          <Plus size={18} />{t("收藏新链接 ")}</button>
      </div>
      <SearchPanel onSearch={onSearch} searching={searching} searchError={uiMessage(searchError)} lastSearch={lastSearch} compact />
      <div className="research-bar">
        <label className="search-field">
          <MagnifyingGlass size={21} />
          <input aria-label={t("搜索参考库")} placeholder={t("搜索公司、行业、关键词，如 SaaS、协作")} value={query} onChange={e => setQuery(e.target.value)} />
          {query && <button aria-label={t("清空搜索")} onClick={() => setQuery("")}>
              <X size={17} />
            </button>}
        </label>
        <a className="secondary" href={`https://www.google.com/search?q=${encodeURIComponent(`${query.trim() || "collaboration SaaS"} pitch deck`)}`} target="_blank" rel="noreferrer">{t("到网上继续搜 ")}<ArrowUpRight size={18} />
        </a>
      </div>
      <p className="scope-note">{t("当前搜索本页已收集的 ")}{references.length}{" "}{t("条来源；网上搜索会在新页打开，找到后可粘贴链接收藏。公开原稿 3 份，方法模板 2 份 · 核验于 2026.11.15 ")}</p>
      {adding && <form className="reference-add" onSubmit={add}>
          <h3>{t("收藏参考来源")}</h3>
          <label>{t("材料名称 ")}<input required maxLength={80} value={draft.title} onChange={e => setDraft({
          ...draft,
          title: e.target.value
        })} />
          </label>
          <label>{t("原始网址 ")}<input type="url" required placeholder="https://…" value={draft.url} onChange={e => setDraft({
          ...draft,
          url: e.target.value
        })} />
          </label>
          <label>{t("所属行业 ")}<select value={draft.industry} onChange={e => setDraft({
          ...draft,
          industry: e.target.value
        })}>
              {["企业服务", "平台产品", "人工智能", "消费产品", "通用"].map(x => <option key={x} value={x}>{t(x)}</option>)}
            </select>
          </label>
          <label>{t("为什么值得参考 ")}<textarea maxLength={300} value={draft.note} onChange={e => setDraft({
          ...draft,
          note: e.target.value
        })} />
          </label>
          {error && <p role="alert">{uiMessage(error)}</p>}
          <div className="form-actions">
            <button type="button" className="secondary" onClick={() => {
          setAdding(false);
          setError("");
        }}>{t("取消 ")}</button>
            <button className="primary" type="submit">{t("保存参考 ")}</button>
          </div>
        </form>}
      <div className="reference-layout">
        <aside className="reference-filters">
          <div className="eyebrow">{t("筛选来源")}</div>
          <label>{t("产品行业 ")}<select aria-label={t("筛选产品行业")} value={industry} onChange={e => setIndustry(e.target.value)}>
              {["全部", "企业服务", "平台产品", "人工智能", "消费产品", "通用"].map(x => <option key={x} value={x}>{t(x)}</option>)}
            </select>
          </label>
          <label>{t("融资阶段 ")}<select aria-label={t("筛选融资阶段")} value={stage} onChange={e => setStage(e.target.value)}>
              {["全部", "种子轮", "A轮", "B轮", "通用", "待标注"].map(x => <option key={x} value={x}>{t(x)}</option>)}
            </select>
          </label>
          <button className={"saved-filter " + (onlySaved ? "selected" : "")} aria-pressed={onlySaved} onClick={() => setOnlySaved(!onlySaved)}>
            <BookmarkSimple weight={onlySaved ? "fill" : "regular"} size={19} />{t("只看收藏 ")}<span>{references.filter(r => r.saved).length}</span>
          </button>
          <div className="reference-guidance">
            <span>{t("当前项目")}</span>
            <strong>{projectName || t("当前路演项目")}</strong>
            <p>{t("先找同类产品，再记录想用于自己哪一页的借鉴点。")}</p>
          </div>
          <button className="quiet-button" onClick={() => downloadJson(references.filter(r => r.saved), "ShowFlow_saved_references.json")}>
            <DownloadSimple size={17} />{t("导出收藏清单 ")}</button>
          <small>{t("收藏与笔记保存在此浏览器。")}</small>
        </aside>
        <div className="reference-results">
          <div className="results-heading">
            <span>{results.length}{t(" 条参考")}</span>
            <span>{t("保留来源，记录借鉴点")}</span>
          </div>
          {!results.length && <div className="reference-empty">
              <MagnifyingGlass size={32} />
              <h3>{t("还没有匹配的参考")}</h3>
              <p>{t("可以清除筛选，或到网上寻找并收藏新的来源。")}</p>
              <button className="secondary" onClick={() => {
            setQuery("");
            setIndustry("全部");
            setStage("全部");
            setOnlySaved(false);
          }}>{t("清除全部筛选 ")}</button>
            </div>}
          <div className="reference-list">
            {groupReferences(results, lastSearch).map(group => <ReferenceGroup key={group.id} group={group} lastSearch={lastSearch} filtered>{group.items.map(r => <article key={r.id} className={"reference-entry " + (detail === r.id ? "current" : "")}>
                <div className="reference-number">
                  {r.name.slice(0, 2).toUpperCase()}
                </div>
                <div className="reference-main">
                  <div className="reference-meta">
                    <span>{referenceText(r, "kind")}</span>
                    <span>{referenceText(r, "stage")}</span>
                    <span>{referenceText(r, "year")}</span>
                  </div>
                  <button className="reference-title" onClick={() => setDetail(detail === r.id ? null : r.id)}>
                    {r.name}
                    <span>{referenceText(r, "title")}</span>
                  </button>
                  <p>{referenceText(r, "note") || t("还没有记录借鉴点。")}</p>
                  <MatchDetails reference={r} />
                  {group.id === "history" && r.query && <p className="reference-history-query">{t("历史查询：")}{r.query}</p>}
                  <div className="reference-bottom">
                    <a href={r.url} target="_blank" rel="noreferrer">
                      {referenceText(r, "publisher")}
                      <ArrowUpRight size={14} />
                    </a>
                    <span>
                      {r.catalogSource ? t("目录元信息 · 未读取全文") : r.discovered ? t("网络来源 · 待核对") : r.verified ? t("已核验来源链接") : t("自收集 · 待核验")}
                    </span>
                    <button className="text-link" onClick={() => setDetail(detail === r.id ? null : r.id)}>{t("查看借鉴点 ")}<ArrowRight size={16} />
                    </button>
                  </div>
                </div>
                <button className="icon-button save-reference" aria-label={`${r.saved ? t("取消收藏") : t("收藏")} ${r.name}`} aria-pressed={!!r.saved} onClick={() => update(r.id, {
              saved: !r.saved
            })}>
                  <BookmarkSimple size={23} weight={r.saved ? "fill" : "regular"} />
                </button>
              </article>)}</ReferenceGroup>)}
          </div>
        </div>
        {selected && <aside className="reference-detail">
            <div className="detail-heading">
              <span className="eyebrow">{t("我的借鉴卡")}</span>
              <button className="icon-button" aria-label={t("关闭借鉴卡")} onClick={() => setDetail(null)}>
                <X size={18} />
              </button>
            </div>
            <h3>{selected.name}</h3>
            <p className="takeaway">{referenceText(selected, "takeaway")}</p>
            <small>{t("以上为 ShowFlow 编辑提示，不是原文摘录。")}</small>
            <label>{t("自己的借鉴笔记 ")}<textarea rows={5} placeholder={t("记录想用于自己哪一页，以及为什么…")} value={selected.myNote || ""} onChange={e => update(selected.id, {
            myNote: e.target.value,
            saved: true
          })} />
            </label>
            <button className="primary" onClick={() => onTheme(selected.theme)}>
              <Palette size={19} />{t("试用搭配样式 ")}</button>
            <p className="scope-note">{t("应用 ShowFlow 自有样式预设，可继续调整；不复制原稿或自动提取原稿样式。 ")}</p>
            <a className="text-link" href={selected.url} target="_blank" rel="noreferrer">{t("打开完整来源 ")}<ArrowUpRight size={17} />
            </a>
          </aside>}
      </div>
    </section>;
}
export function StyleStudio({
  scenes,
  projectName,
  selected,
  setSelected,
  deck,
  setDeck,
  onApply,
  onSceneEdit,
  notify
}) {
  const [scope, setScope] = useState("all"),
    [before, setBefore] = useState(false),
    [history, setHistory] = useState([]),
    [busy, setBusy] = useState(false),
    [overflow, setOverflow] = useState(false);
  const scene = scenes[selected],
    st = scope === "all" ? deck.global : effectiveStyle(deck, scene.id),
    count = Object.keys(deck.overrides).length;
  function commit(next) {
    setHistory(p => [...p.slice(-19), deck]);
    setDeck(next);
    setBefore(false);
  }
  function change(patch) {
    commit(scope === "all" ? {
      ...deck,
      global: {
        ...deck.global,
        ...patch
      }
    } : {
      ...deck,
      overrides: {
        ...deck.overrides,
        [scene.id]: {
          ...deck.overrides[scene.id],
          ...patch
        }
      }
    });
  }
  function preset(theme) {
    commit(scope === "all" ? {
      ...deck,
      global: {
        ...theme
      }
    } : {
      ...deck,
      overrides: {
        ...deck.overrides,
        [scene.id]: {
          ...theme
        }
      }
    });
  }
  const contrast = hex => {
    const c = hex.slice(1).match(/../g).map(x => {
      const n = parseInt(x, 16) / 255;
      return n <= 0.04045 ? n / 12.92 : ((n + 0.055) / 1.055) ** 2.4;
    });
    return c[0] * 0.2126 + c[1] * 0.7152 + c[2] * 0.0722;
  };
  const ratio = (Math.max(contrast(st.color), contrast(st.background)) + 0.05) / (Math.min(contrast(st.color), contrast(st.background)) + 0.05);
  return <section className="style-workspace">
      <div className="workspace-intro">
        <div>
          <div className="eyebrow">STYLE STUDIO</div>
          <h2>{t("同一个故事，换一种呈现。")}</h2>
          <p>{t("先选基调，再调整细节。文字和截图保持独立，导出后可继续编辑。")}</p>
        </div>
        <div className="studio-top-actions">
          <button className="secondary" disabled={!history.length} onClick={() => {
          setDeck(history.at(-1));
          setHistory(p => p.slice(0, -1));
        }}>
            {" "}
            <ArrowCounterClockwise size={18} />{t("撤销 ")}</button>
          <button className="primary" disabled={busy} onClick={async () => {
          setBusy(true);
          try {
            await exportDeck(scenes, deck, projectName);
            notify(t("PPTX 已导出：标题和正文可编辑，截图保持图片。"));
          } catch (e) {
            notify(/dynamically imported|module script|fetch.*module/i.test(e?.message || "") ? t("导出组件已更新，请刷新页面后重试；项目已在本机保留。") : t("导出未完成，请检查本页截图是否仍可读取后重试。"));
          } finally {
            setBusy(false);
          }
        }}>
            <DownloadSimple size={19} />
            {busy ? t("正在导出…") : t("导出 PPTX")}
          </button>
        </div>
      </div>
      <div className="studio-layout">
        <section className="style-stage">
          <div className="canvas-toolbar">
            <span>{t("第 ")}{selected + 1}{t(" 页 · ")}{uiMessage(scene.name)}
            </span>
            <button className="quiet-button" aria-pressed={before} onClick={() => setBefore(!before)}>
              {before ? t("返回样式预览") : t("查看原始画面")}
            </button>
            <span>{t("16:9 · 当前为")}{before ? t("原始图片") : t("可编辑排版")}</span>
          </div>
          <div className="studio-canvas">
            {before && scene.imported ? <OriginalSlide scene={scene} /> : before ? <img className="before-image" src={scene.image} alt={t("原始分镜画面")} /> : <DeckCanvas scene={scene} deck={deck} index={selected} total={scenes.length} onOverflow={setOverflow} />}
          </div>
          {overflow && !before && <p className="contrast-note" role="status">{t("本页文字超出版面，请减小字号、缩短内容或更换版式。PPTX 导出会在文本框内自动缩小文字。 ")}</p>}
          <div className="style-filmstrip" aria-label={t("选择样式编辑页面")}>
            {scenes.map((s, i) => <button key={s.id} aria-label={t("编辑第{0}页 {1}", [i + 1, uiMessage(s.name)])} aria-pressed={i === selected} className={i === selected ? "selected" : ""} onClick={() => {
            setSelected(i);
            setBefore(false);
          }}>
                <DeckCanvas scene={s} deck={deck} index={i} total={scenes.length} />
                <span>
                  {i + 1} · {uiMessage(s.name)}
                  {deck.overrides[s.id] && <b title={t("单页样式")}> ·</b>}
                </span>
              </button>)}
          </div>
          <div className="deck-content-fields">
            <label>{t("本页标题 ")}<input maxLength={42} value={scene.title} onChange={e => onSceneEdit({
              title: e.target.value
            })} />
            </label>
            <label>{t("本页正文 ")}<textarea rows={2} maxLength={12000} value={scene.deckBody ?? scene.goal} onChange={e => onSceneEdit({
              deckBody: e.target.value
            })} />
            </label>
          </div>
          <p className="scope-note">{t("项目、原文件与样式在本浏览器保存，图片内的文字保持原样。PPTX按标题、正文和每页主图重新排版；复杂图表、动画和逐元素编辑需对照保留的原文件。 ")}</p>
        </section>
        <aside className="style-controls">
          <div className="control-heading">
            <h3>{t("样式工作台")}</h3>
            <span>{t("实时预览")}</span>
          </div>
          <div className="scope-switch" aria-label={t("样式修改范围")}>
            {[["all", t("整套基调")], ["page", t("仅当前页")]].map(([id, label]) => <button key={id} aria-pressed={scope === id} className={scope === id ? "selected" : ""} onClick={() => setScope(id)}>
                {label}
              </button>)}
          </div>
          <p className="scope-note">
            {scope === "all" ? t("修改全局基调；{0}", [count ? t("{0} 页有独立样式，会优先保留。", [count]) : t("所有页面跟随统一样式。")]) : t("为这一页保留独立调整，其余页面不变。")}
          </p>
          <div className="theme-grid">
            {themes.map(themeItem => <button key={themeItem.id} className={st.id === themeItem.id ? "selected" : ""} aria-label={t("使用{0}", [t(themeItem.name)])} onClick={() => preset(themeItem)}>
                <span className="theme-swatch" style={{
              background: themeItem.background,
              color: themeItem.accent
            }}>
                  Aa <i style={{
                background: themeItem.accent
              }} />
                </span>
                <span>{t(themeItem.name)}</span>
              </button>)}
          </div>
          <label className="control-field">{t("页面版式 ")}<select value={st.layout} onChange={e => change({
            layout: e.target.value
          })}>
              <option value="split">{t("左文右图")}</option>
              <option value="top">{t("标题在上")}</option>
              <option value="image">{t("画面优先")}</option>
              <option value="statement">{t("观点大字")}</option>
            </select>
          </label>
          <label className="control-field">{t("字体 ")}<select value={st.font} onChange={e => change({
            font: e.target.value
          })}>
              {["PingFang SC", "Microsoft YaHei", "Songti SC", "Arial", "Georgia"].map(x => <option key={x} value={x}>{t(x)}</option>)}
            </select>
          </label>
          <p className="font-note">{t("使用设备已安装的字体；导出文件不嵌入字体。 ")}</p>
          <div className="color-controls">
            {[["background", t("背景")], ["color", t("文字")], ["accent", t("强调色")]].map(([key, label]) => <ColorField key={key} label={label} value={st[key]} onChange={value => change({
            [key]: value
          })} />)}
          </div>
          {[["titleSize", t("标题字号"), 24, 54], ["bodySize", t("正文字号"), 12, 22], ["margin", t("左右留白"), 26, 80]].map(([key, label, min, max]) => <label className="slider-field" key={key}>
              <span>
                {label}
                <output>
                  {st[key]} {key === "margin" ? "pt" : "pt"}
                </output>
              </span>
              <input aria-label={label} type="range" min={min} max={max} value={st[key]} onChange={e => change({
            [key]: Number(e.target.value)
          })} />
            </label>)}
          <label className="control-field">{t("文字对齐 ")}<select value={st.align} onChange={e => change({
            align: e.target.value
          })}>
              <option value="left">{t("左对齐")}</option>
              <option value="center">{t("居中")}</option>
              <option value="right">{t("右对齐")}</option>
            </select>
          </label>
          {ratio < 4.5 && <p className="contrast-note" role="status">{t("文字与背景对比度较低（")}{ratio.toFixed(1)}{t(":1），建议调整颜色。 ")}</p>}
          <div className="style-apply">
            <button className="primary" onClick={() => onApply(deck)}>
              <Check size={18} />{t("应用到导演台与彩排 ")}</button>
            <button className="quiet-button" disabled={!count} onClick={() => commit({
            ...deck,
            overrides: {}
          })}>{t("清除单页样式，统一整套 ")}</button>
          </div>
        </aside>
      </div>
    </section>;
}
