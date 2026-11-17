import { t, useLocale, uiMessage, formatDate, setLocale } from "./i18n";
import React, { useState, useEffect, useRef } from "react";
import { Play, Pause, ArrowRight, ArrowLeft, Check, X, Microphone, Link, Cursor, Target, WarningCircle, FilmStrip, CaretDown, UploadSimple, Clock, DownloadSimple, BookmarkSimple, ArrowCounterClockwise, CheckCircle, PencilSimple, ArrowsOutSimple, Files, Info, Flag } from "@phosphor-icons/react";
import { scenes as initialScenes, questions as sampleQuestions } from "./data";
import { ReferenceLibrary, StyleStudio, DeckCanvas } from "./Workspaces";
import { defaultDeck, themes } from "./deck";
import { referenceSeeds, isDeckCandidate } from "./references";
import { Workflow, OriginalSlide, callApi } from "./Workflow";
import { get as getStored, set as setStored } from "idb-keyval";
import { timesFor } from "./timing";
import { importPptx } from "./pptx-import";
import { ReviewGuide } from "./ReviewGuide";
import { releaseLinks } from "./release";
function readLocal(key, fallback) {
  try {
    const x = JSON.parse(localStorage.getItem(key));
    return x ?? fallback;
  } catch {
    return fallback;
  }
}
const clone = x => JSON.parse(JSON.stringify(x));
function makeSampleScenes() {
  return initialScenes.map(scene => ({...scene, ...Object.fromEntries(
    ["name", "title", "goal", "action", "script", "source"].map(field => [field, t(scene[field])])
  )}));
}
const fmt = x => `${String(Math.floor(x / 60)).padStart(2, "0")}:${String(Math.floor(x % 60)).padStart(2, "0")}`;
const sec = x => t("{0}秒", [Math.round(x * 10) / 10]);
function Picture({
  scene,
  ...props
}) {
  if (scene.imported && scene.original) return <OriginalSlide scene={scene} />;
  if (!scene.image) return <div className="missing-image-note">{t("本页没有独立图片，可在样式工作台使用文字版式。 ")}</div>;
  return <img src={scene.image} onError={e => {
    if (!e.currentTarget.src.endsWith(scene.fallback)) e.currentTarget.src = scene.fallback;
  }} alt={t("{0}，合成示例画面", [scene.source])} {...props} />;
}
function Modal({
  title,
  onClose,
  children,
  wide
}) {
  const ref = useRef();
  useEffect(() => {
    const prev = document.activeElement;
    const el = ref.current;
    el.querySelector("button,input,textarea")?.focus();
    const handler = e => {
      if (e.key === "Escape") onClose();
      if (e.key === "Tab") {
        const all = [...el.querySelectorAll("button,input,textarea,select")].filter(x => !x.disabled);
        if (e.shiftKey && document.activeElement === all[0]) {
          e.preventDefault();
          all.at(-1)?.focus();
        } else if (!e.shiftKey && document.activeElement === all.at(-1)) {
          e.preventDefault();
          all[0]?.focus();
        }
      }
    };
    document.addEventListener("keydown", handler);
    return () => {
      document.removeEventListener("keydown", handler);
      prev?.focus();
    };
  }, []);
  return <div className="scrim" onMouseDown={e => e.target === e.currentTarget && onClose()}>
      <section className={"modal " + (wide ? "wide" : "")} ref={ref} role="dialog" aria-modal="true" aria-label={title}>
        <div className="modal-heading">
          <h2>{title}</h2>
          <button className="icon-button" aria-label={t("关闭弹窗")} onClick={onClose}>
            <X size={22} />
          </button>
        </div>
        {children}
      </section>
    </div>;
}
export function App() {
  const locale = useLocale();
  const [projectName, setProjectName] = useState(() => t("会议行动卡 · 示例项目")),
    [importMeta, setImportMeta] = useState(null),
    [hydrated, setHydrated] = useState(false),
    [saveState, setSaveState] = useState("读取中");
  const [searching, setSearching] = useState(false),
    [searchError, setSearchError] = useState(""),
    [lastSearch, setLastSearch] = useState(null),
    [aiPlan, setAiPlan] = useState(null),
    [aiBackup, setAiBackup] = useState(null);
  const [references, setReferences] = useState(() => readLocal("showflow-references-v1", referenceSeeds));
  const [deck, setDeck] = useState(() => readLocal("showflow-style-v1", defaultDeck));
  const [appliedDeck, setAppliedDeck] = useState(() => readLocal("showflow-applied-style-v1", null));
  useEffect(() => {
    try {
      localStorage.setItem("showflow-references-v1", JSON.stringify(references));
      localStorage.setItem("showflow-style-v1", JSON.stringify(deck));
      localStorage.setItem("showflow-applied-style-v1", JSON.stringify(appliedDeck));
    } catch {
      setToast(t("浏览器存储不可用，本轮仍可编辑，请及时导出。"));
    }
  }, [references, deck, appliedDeck]);
  const [tab, setTab] = useState("project"),
    [scenes, setScenes] = useState(makeSampleScenes),
    [selected, setSelected] = useState(2),
    [budget, setBudget] = useState(180);
  useEffect(() => { window.scrollTo({top: 0, left: 0, behavior: "instant"}); }, [tab]);
  const [versions, setVersions] = useState([{
      name: "v1.0",
      budget: 180,
      scenes: makeSampleScenes()
    }]),
    [version, setVersion] = useState("v1.0"),
    [versionOpen, setVersionOpen] = useState(false);
  const [modal, setModal] = useState(null),
    [materials, setMaterials] = useState([]),
    [claimStatus, setClaimStatus] = useState("pending"),
    [session, setSession] = useState(null),
    [running, setRunning] = useState(false),
    [backup, setBackup] = useState(false);
  const [question, setQuestion] = useState(0),
    [answer, setAnswer] = useState(""),
    [savedAnswers, setSavedAnswers] = useState({}),
    [outline, setOutline] = useState(false),
    [toast, setToast] = useState(""),
    [editing, setEditing] = useState(null);
  const fileRef = useRef();
  const times = timesFor(scenes, budget);
  const questions = scenes[0]?.imported ? [{
    title: "原稿中的关键数字有哪些可核验的依据？",
    note: "针对当前原稿的练习题。",
    outline: "逐项说明来源、时间范围和验证状态，未验证的数字明确标注。"
  }, {
    title: "如果只能留下一个产品价值，你会怎么讲？",
    note: "针对当前项目的练习题。",
    outline: "说明服务谁、解决什么问题，并给出当前能展示的依据。"
  }, {
    title: "下一步希望听众采取什么行动？",
    note: "针对当前项目的练习题。",
    outline: "用明确的试用、反馈或后续沟通来收尾。"
  }] : sampleQuestions;
  useEffect(() => {
    let mounted = true;
    getStored("showflow-project-v2").then(data => {
      if (!mounted || !data?.scenes?.length) return;
      setScenes(data.scenes);
      setProjectName(data.projectName);
      setImportMeta(data.importMeta || null);
      setVersions(data.versions?.length ? data.versions : [{
        name: "v1.0",
        budget: 180,
        scenes: data.scenes
      }]);
      setVersion(data.version || "v1.0");
      setBudget(data.budget || 180);
      setDeck(data.deck || defaultDeck);
      setAppliedDeck(data.appliedDeck || null);
      setAiPlan(data.aiPlan || null);
      setAiBackup(data.aiBackup || null);
      setLastSearch(data.lastSearch || null);
      setSelected(0);
    }).catch(() => {
      setToast(t("本机项目读取失败，当前先显示示例；请不要覆盖重要文件。"));
    }).finally(() => {
      if (mounted) {
        setHydrated(true);
        setSaveState("已保存");
      }
    });
    return () => {
      mounted = false;
    };
  }, []);
  useEffect(() => {
    if (!hydrated) return;
    setSaveState("保存中");
    const themeItem = setTimeout(() => setStored("showflow-project-v2", {
      scenes,
      projectName,
      importMeta,
      versions,
      version,
      budget,
      deck,
      appliedDeck,
      aiPlan,
      aiBackup,
      lastSearch,
      updatedAt: new Date().toISOString()
    }).then(() => setSaveState("已保存")).catch(() => {
      setSaveState("保存失败");
      notify(t("本机保存失败，请导出PPTX保留当前编辑。"));
    }), 700);
    return () => clearTimeout(themeItem);
  }, [hydrated, scenes, projectName, importMeta, versions, version, budget, deck, appliedDeck, aiPlan, aiBackup, lastSearch]);
  const rehearsing = tab === "rehearsal" && session;
  const activeIndex = rehearsing ? session.index : selected;
  const active = rehearsing ? session.plan.scenes[session.index] : scenes[selected];
  const activeTimes = rehearsing ? session.plan.times : times;
  const total = session ? session.elapsed.reduce((a, b) => a + b, 0) : 0;
  useEffect(() => {
    if (!toast) return;
    const themeItem = setTimeout(() => setToast(""), 3300);
    return () => clearTimeout(themeItem);
  }, [toast]);
  useEffect(() => {
    if (!running) return;
    let last = performance.now();
    const id = setInterval(() => {
      const now = performance.now(),
        delta = (now - last) / 1000;
      last = now;
      setSession(p => {
        if (!p || p.ended) return p;
        const elapsed = [...p.elapsed];
        elapsed[p.index] += delta;
        return {
          ...p,
          elapsed
        };
      });
    }, 200);
    return () => clearInterval(id);
  }, [running]);
  useEffect(() => {
    function key(e) {
      if (tab !== "rehearsal" || modal || ["INPUT", "TEXTAREA", "SELECT"].includes(e.target.tagName)) return;
      if (e.code === "Space") {
        e.preventDefault();
        setRunning(x => !x);
      }
      if (e.key === "ArrowRight") move(1);
      if (e.key === "ArrowLeft") move(-1);
    }
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [tab, modal]);
  function notify(x) {
    setToast(x);
  }
  function navigate(next) {
    if (next !== "rehearsal") setRunning(false);
    if (next === "rehearsal" && (!session || session.ended)) {
      start();
      return;
    }
    setBackup(false);
    setTab(next);
    setVersionOpen(false);
  }
  function saveVersion(nextScenes, nextBudget, extra = {}) {
    const name = `v1.${versions.length}`;
    setVersions(p => [...p, {
      name,
      budget: nextBudget,
      scenes: clone(nextScenes),
      projectName,
      importMeta,
      deck: clone(appliedDeck),
      ...extra
    }]);
    setVersion(name);
  }
  function applyBudget(next) {
    setBudget(next);
    saveVersion(scenes, next);
    setModal(null);
    notify(t("已应用{0}秒方案，原版保留在版本记录中", [next]));
  }
  function start() {
    setSession({
      id: Date.now(),
      index: 0,
      elapsed: Array(scenes.length).fill(0),
      marks: [],
      ended: false,
      plan: {
        version,
        budget,
        times: [...times],
        scenes: clone(scenes),
        deck: clone(appliedDeck)
      }
    });
    setRunning(true);
    setTab("rehearsal");
    setBackup(false);
    setSavedAnswers({});
    setAnswer("");
  }
  function move(delta) {
    setBackup(false);
    setSession(p => ({
      ...p,
      index: Math.max(0, Math.min(p.plan.scenes.length - 1, p.index + delta))
    }));
  }
  function finish() {
    setRunning(false);
    setSession(p => ({
      ...p,
      ended: true
    }));
    setTab("review");
    setBackup(false);
    notify(t("彩排已结束，时间与标记已整理到本轮复盘"));
  }
  function mark() {
    setSession(p => ({
      ...p,
      marks: p.marks.includes(p.index) ? p.marks.filter(x => x !== p.index) : [...p.marks, p.index]
    }));
    notify(session.marks.includes(session.index) ? t("已取消本段标记") : t("已标记这一段，复盘时可直接定位"));
  }
  function restore(v) {
    setScenes(clone(v.scenes));
    setSelected(0);
    setProjectName(v.projectName || "会议行动卡 · 示例项目");
    setImportMeta(v.importMeta || null);
    setAppliedDeck(v.deck || null);
    if (v.styleDraft) setDeck(v.styleDraft);
    setSession(null);
    setRunning(false);
    setAiPlan(null);
    setAiBackup(null);
    setBudget(v.budget);
    setVersion(v.name);
    setVersionOpen(false);
    notify(t("已切换至 {0} · {1}秒方案", [v.name, v.budget]));
  }
  function updateScript(text) {
    setScenes(p => p.map((s, i) => i === selected ? {
      ...s,
      script: text
    } : s));
  }
  function addFiles(event) {
    Array.from(event.target.files || []).forEach(file => {
      if (file.size > 10 * 1024 * 1024) {
        notify(t("请添加小于10MB的图片"));
        return;
      }
      if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
        notify(t("请使用PNG、JPEG或WebP图片"));
        return;
      }
      const reader = new FileReader();
      reader.onload = () => setMaterials(p => [...p, {
        id: crypto.randomUUID(),
        name: file.name,
        url: reader.result
      }]);
      reader.onerror = () => notify(t("图片读取失败，请重试。"));
      reader.readAsDataURL(file);
    });
    event.target.value = "";
  }
  function exportCard() {
    const plan = tab === "review" && session ? session.plan : {
      scenes,
      times,
      budget,
      version
    };
    const text = [`ShowFlow｜${projectName}`, t("方案 {0} / 目标 {1}秒", [plan.version, plan.budget]), scenes[0]?.imported ? t("用户导入材料；来源关联不等于独立核验。") : t("合成示例；来源关联不等于独立核验。"), "", ...plan.scenes.flatMap((s, i) => [t("{0}. {1} / {2}秒", [i + 1, uiMessage(s.name), plan.times[i]]), s.title, t("操作：{0}", [uiMessage(s.action)]), t("讲述：{0}", [s.script]), t("来源：{0}", [s.imported ? uiMessage(s.source) : s.source]), ...(tab === "review" && session ? [t("实际停留：{0}", [sec(session.elapsed[i])])] : []), ""]), scenes[0]?.imported ? t("原稿中的业务事实与效果主张需按实际材料核对。") : t("待验证主张：每周节省10小时 / 尚无测试记录"), ...Object.entries(savedAnswers).flatMap(([i, a]) => ["", t("练习问题：") + t(questions[i].title), t("回答：") + a])].join("\n");
    const url = URL.createObjectURL(new Blob([text], {
      type: "text/plain;charset=utf-8"
    }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `ShowFlow_cue_cards_${plan.budget}s_${plan.version}.txt`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    notify(t("演示手卡已导出"));
  }
  async function collectReferences(query) {
    setSearching(true);
    setSearchError("");
    try {
      const r = await callApi("search", {
        query
      });
      setReferences(previous => {
        let existing = previous.map(r => ({
          ...r,
          forRewrite: false
        })).filter(r => !(r.discovered && !isDeckCandidate(r.url)));
        const collected = r.results.map((x, i) => {
          const old = existing.find(y => y.url.replace(/\/$/, "") === x.url.replace(/\/$/, ""));
          if (old) {
            existing = existing.filter(y => y.id !== old.id);
            return {
              ...x,
              ...old,
              discovered: true,
              retrievedAt: r.meta.generatedAt,
              forRewrite: i < 3
            };
          }
          return {
            ...x,
            forRewrite: i < 3
          };
        });
        return [...collected, ...existing];
      });
      setLastSearch({
        query,
        count: r.results.length,
        at: r.meta.generatedAt,
        model: r.meta.model,
        responseId: r.meta.responseId
      });
      notify(r.results.length ? t("已自动搜集 {0} 条可追溯参考，可选择用于改版", [r.results.length]) : t("没有找到匹配的可追溯来源，请调整描述。"));
    } catch (e) {
      setSearchError(e.message);
    } finally {
      setSearching(false);
    }
  }
  async function importProject(result) {
    const {
      blob,
      ...meta
    } = result.file;
    await setStored("showflow-original-" + meta.hash, blob);
    await setStored("showflow-backup-" + Date.now(), {
      projectName,
      scenes,
      deck,
      appliedDeck,
      importMeta,
      versions,
      version,
      budget
    });
    const newStyle = {
      global: {
        ...themes[1]
      },
      overrides: Object.fromEntries(result.scenes.filter(x => !x.image).map(x => [x.id, {
        layout: "statement"
      }]))
    };
    const oldVersion = {
      name: `v1.${versions.length}`,
      budget,
      scenes: clone(scenes),
      projectName,
      importMeta,
      deck: clone(appliedDeck),
      styleDraft: clone(deck)
    };
    const newVersion = {
      name: `v1.${versions.length + 1}`,
      budget,
      scenes: clone(result.scenes),
      projectName: result.name,
      importMeta: meta,
      deck: null,
      styleDraft: newStyle
    };
    setVersions(p => [...p, oldVersion, newVersion]);
    setVersion(newVersion.name);
    setScenes(result.scenes);
    setProjectName(result.name);
    setImportMeta(meta);
    setSelected(0);
    setAppliedDeck(null);
    setDeck(newStyle);
    setSession(null);
    setRunning(false);
    setAiPlan(null);
    setAiBackup(null);
    notify(t("已导入 {0} 页；原文件和原项目版本均已保留", [result.scenes.length]));
  }
  async function loadEnglishSample() {
    try {
      const response = await fetch(releaseLinks.sample);
      if (!response.ok) throw new Error("Sample unavailable");
      const file = new File([await response.blob()], "ShowFlow_English_Sample.pptx", { type: "application/vnd.openxmlformats-officedocument.presentationml.presentation" });
      await importProject(await importPptx(file));
      navigate("project");
    } catch {
      notify(locale === "en" ? "The sample could not be loaded. Your project was not replaced." : "示例载入失败，未替换当前项目。");
    }
  }
  async function downloadOriginal() {
    try {
      const blob = await getStored("showflow-original-" + importMeta.hash);
      if (!blob) throw new Error("missing");
      const url = URL.createObjectURL(blob),
        a = document.createElement("a");
      a.href = url;
      a.download = importMeta.name;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1500);
    } catch {
      notify(t("本机未找到原文件，请重新选择原PPTX导入。"));
    }
  }
  function applyAiRevision(plan, chosen) {
    if (plan.meta.validationVersion !== 2) {
      notify(t("这份建议来自旧版检查规则，请重新生成后采用。"));
      return;
    }
    const changed = plan.before.filter(b => chosen.includes(b.id)).some(b => {
      const now = scenes.find(x => x.id === b.id);
      return !now || now.title !== b.title || (now.deckBody ?? now.goal) !== b.body || plan.includeNotes && now.script !== b.script;
    });
    if (changed) {
      notify(t("生成建议后原稿已有变化，请重新生成，避免覆盖你的编辑。"));
      return;
    }
    setAiBackup({
      scenes: clone(scenes),
      deck: clone(deck),
      appliedDeck: clone(appliedDeck)
    });
    const next = scenes.map(s => {
      const p = plan.pages.find(p => p.id === s.id && chosen.includes(p.id));
      return p ? {
        ...s,
        title: p.title,
        deckBody: p.body,
        script: plan.includeNotes ? p.script : s.script,
        aiRevision: {
          reason: p.reason,
          references: p.referenceIds.map(id => plan.referenceSnapshot.find(r => r.id === id)).filter(Boolean),
          responseId: plan.meta.responseId
        }
      } : s;
    });
    const proposedTheme = themes.find(themeItem => themeItem.id === plan.theme) || themes[0];
    const wholeDeck = chosen.length === scenes.length;
    const nextDeck = {
      global: {
        ...(wholeDeck ? proposedTheme : deck.global)
      },
      overrides: {
        ...deck.overrides,
        ...Object.fromEntries(plan.pages.filter(p => chosen.includes(p.id)).map(p => [p.id, {
          ...(wholeDeck ? {} : proposedTheme),
          layout: p.layout
        }]))
      }
    };
    setScenes(next);
    setDeck(nextDeck);
    setAppliedDeck(clone(nextDeck));
    saveVersion(next, budget, {
      deck: clone(nextDeck),
      styleDraft: clone(nextDeck)
    });
    setAiPlan({
      ...plan,
      applied: true,
      appliedIds: chosen
    });
    notify(t("已采用 {0} 页建议，可查看样式、导出或开始彩排", [chosen.length]));
  }
  function undoAi() {
    if (!aiBackup) return;
    setScenes(aiBackup.scenes);
    setDeck(aiBackup.deck);
    setAppliedDeck(aiBackup.appliedDeck);
    saveVersion(aiBackup.scenes, budget, {
      deck: aiBackup.appliedDeck,
      styleDraft: aiBackup.deck
    });
    setAiBackup(null);
    setAiPlan(null);
    notify(t("已恢复 AI 改版前的内容与样式"));
  }
  const overrun = session ? session.elapsed.findIndex((v, i) => v > session.plan.times[i]) : -1;
  const pic = backup ? {
    ...session.plan.scenes[session.index],
    image: session.plan.scenes[session.index].fallback
  } : active;
  const visibleDeck = rehearsing ? session.plan.deck : appliedDeck;
  return <div className="app-shell">
      <header className="app-header">
        <button className="wordmark" aria-label={t("ShowFlow 返回导演台")} onClick={() => navigate("director")}>
          ShowFlow
        </button>
        <nav aria-label={t("主要页面")}>
          {[["project", t("作品")], ["references", t("参考库")], ["styles", t("样式")], ["director", t("导演台")], ["rehearsal", t("彩排")], ["review", t("复盘")]].map(([id, label]) => <button key={id} className={"nav-item " + (tab === id ? "active" : "")} aria-current={tab === id ? "page" : undefined} onClick={() => navigate(id)}>
              {label}
            </button>)}
        </nav>
        <div className="header-actions">
          <label className="language-switch"><span className="sr-only">{locale === "en" ? "Interface language" : "界面语言"}</span><select aria-label={locale === "en" ? "Interface language" : "界面语言"} value={locale} onChange={e => setLocale(e.target.value)}><option value="en">English</option><option value="zh">简体中文</option></select></label>
          {tab === "director" && <>
              <div className="duration-switch" aria-label={t("演示目标时长")}>
                {[180, 90].map(n => <button key={n} className={budget === n ? "selected" : ""} aria-pressed={budget === n} onClick={() => n !== budget && setModal({
              type: "duration",
              next: n
            })}>
                    {n}{t("秒 ")}</button>)}
              </div>
              <div className="version-wrap">
                <button className="secondary version-button" aria-expanded={versionOpen} onClick={() => setVersionOpen(!versionOpen)}>{t("版本 ")}{version}
                  <CaretDown size={17} />
                </button>
                {versionOpen && <div className="version-menu" role="menu">
                    {versions.map(v => <button role="menuitem" key={v.name} onClick={() => restore(v)}>
                        <span>
                          {v.name} · {v.budget}{t("秒 ")}</span>
                        {v.name === version && <Check size={16} />}
                      </button>)}
                  </div>}
              </div>
            </>}
          {tab === "director" && <button className="primary" onClick={start}>
              <Play size={20} weight="fill" />{t("开始彩排 ")}</button>}
          {tab === "rehearsal" && <button className="primary" onClick={finish}>
              <Check size={20} />{t("结束并复盘 ")}</button>}
          {tab === "review" && <button className="primary" onClick={exportCard}>
              <DownloadSimple size={20} />{t("导出演示手卡 ")}</button>}
        </div>
      </header>
      <main>
        <ReviewGuide onLoadSample={loadEnglishSample} disabled={!hydrated} />
        <div className="project-heading">
          <h1>{projectName}</h1>
          <div className="project-tools">
            <span className="save-state">{t("本机")}{uiMessage(saveState)}</span>
            {tab !== "project" && <button className="quiet-button" onClick={() => navigate("project")}>
                <UploadSimple size={18} />{t("导入 / AI 改版 ")}</button>}
            {appliedDeck && tab === "director" && <button className="quiet-button" onClick={() => {
            setAppliedDeck(null);
            notify(t("已恢复原始分镜画面，样式草稿仍保留在工作台"));
          }}>{t("恢复原始画面 ")}</button>}
            <button className="quiet-button" onClick={() => setModal({
            type: "materials"
          })}>
              <Files size={18} />{t("材料 ")}</button>
            <button className="icon-button" aria-label={t("交互预览说明")} onClick={() => setModal({
            type: "help"
          })}>
              <Info size={19} />
            </button>
          </div>
        </div>
        {tab === "project" && <Workflow scenes={scenes} projectName={projectName} importMeta={importMeta} onImport={importProject} downloadOriginal={downloadOriginal} onNavigate={navigate} references={references} setReferences={setReferences} onSearch={collectReferences} searching={searching} searchError={uiMessage(searchError)} lastSearch={lastSearch} plan={aiPlan} setPlan={setAiPlan} onApplyRevision={applyAiRevision} aiBackup={aiBackup} onUndoAi={undoAi} notify={notify} />}
        {tab === "references" && <ReferenceLibrary projectName={projectName} references={references} setReferences={setReferences} onSearch={collectReferences} searching={searching} searchError={uiMessage(searchError)} lastSearch={lastSearch} notify={notify} onTheme={id => {
        setDeck(p => ({
          ...p,
          global: {
            ...(themes.find(themeItem => themeItem.id === id) || themes[0])
          }
        }));
        navigate("styles");
        notify(t("已载入 ShowFlow 自有搭配样式，可继续自定义"));
      }} />}
        {tab === "styles" && <StyleStudio scenes={scenes} projectName={projectName} selected={selected} setSelected={setSelected} deck={deck} setDeck={setDeck} notify={notify} onSceneEdit={patch => setScenes(p => p.map((s, i) => i === selected ? {
        ...s,
        ...patch
      } : s))} onApply={value => {
        setAppliedDeck(clone(value));
        navigate("director");
        notify(t("新样式已用于导演台，下次彩排会固定当前样式"));
      }} />}
        {(tab === "director" || tab === "rehearsal") && <>
            <div className="director-grid">
              <section className="stage-column" aria-label={t("演示画面与讲稿")}>
                <button className={"stage-frame " + (backup ? "backup" : "") + (visibleDeck && !backup ? " styled-stage" : "") + (pic.imported && (!visibleDeck || backup) ? " imported-stage" : "")} onClick={() => setModal({
              type: "preview",
              scene: pic,
              deck: !backup && visibleDeck,
              index: activeIndex,
              total: rehearsing ? session.plan.scenes.length : scenes.length
            })} style={{
              "--original-aspect": `${pic.original?.width || 16}/${pic.original?.height || 9}`
            }} aria-label={t("放大当前演示画面")}>
                  {visibleDeck && !backup ? <DeckCanvas scene={pic} deck={visibleDeck} index={activeIndex} total={rehearsing ? session.plan.scenes.length : scenes.length} /> : <Picture scene={pic} />}
                  <span className="expand-label">
                    <ArrowsOutSimple size={18} />{t("放大画面 ")}</span>
                  {backup && <span className="backup-label">{t("备用画面")}</span>}
                </button>
                <div className="script-label">
                  <Microphone size={23} />
                  <label htmlFor="speaking-note">{t("演讲稿")}{tab === "director" ? t("（可编辑）") : t(" · 本轮提示")}
                  </label>
                  {rehearsing && <span className="frozen-label">
                      {session.plan.version}{t(" · 方案已固定 ")}</span>}
                </div>
                <div className="script-input-wrap">
                  <textarea id="speaking-note" aria-label={t("当前分镜演讲稿")} rows={2} value={active.script} readOnly={!!rehearsing} onChange={e => updateScript(e.target.value)} onBlur={() => {
                if (tab === "director" && active.script !== versions.find(v => v.name === version)?.scenes[selected]?.script) saveVersion(scenes, budget);
              }} />
                  {tab === "director" && <PencilSimple className="input-pencil" size={20} />}
                </div>
                {rehearsing && <div className="transport">
                    <button className="secondary" disabled={session.index === 0} onClick={() => move(-1)}>
                      <ArrowLeft size={18} />{t("上一段 ")}</button>
                    <button className="play-control" onClick={() => setRunning(!running)}>
                      {running ? <Pause size={22} weight="fill" /> : <Play size={22} weight="fill" />}
                      {running ? t("暂停") : t("继续")}
                    </button>
                    <button className="secondary" disabled={session.index === session.plan.scenes.length - 1} onClick={() => move(1)}>{t("下一段 ")}<ArrowRight size={18} />
                    </button>
                    <span className="key-hint">{t("← → 切段 · 空格 暂停")}</span>
                  </div>}
              </section>
              <aside className="cue-column">
                {rehearsing ? <div className="rehearsal-clock">
                    <div className="eyebrow">
                      <span className={"status-dot " + (running ? "live" : "")} />
                      {running ? t("彩排进行中") : t("已暂停")}
                    </div>
                    <div className={"big-clock " + (total > session.plan.budget ? "overtime" : "")}>
                      {fmt(total)}
                      <span> / {fmt(session.plan.budget)}</span>
                    </div>
                    <div className="scene-clock">{t("本段 ")}{fmt(session.elapsed[session.index])}
                      <span>/ {activeTimes[activeIndex]}{t("秒")}</span>
                    </div>
                  </div> : <div className="cue-title">
                    <div className="eyebrow">{t("当前场景")}</div>
                    <h2>{active.title}</h2>
                    <span className="time-tag">{times[selected]}{t(" 秒")}</span>
                    <button className="icon-button edit-scene" aria-label={t("编辑当前分镜")} onClick={() => {
                setEditing({
                  ...active
                });
                setModal({
                  type: "edit"
                });
              }}>
                      <PencilSimple size={18} />
                    </button>
                  </div>}
                <div className="cue-section purpose">
                  <Target size={23} />
                  <div>
                    <h3>{t("场景目的")}</h3>
                    <p>{uiMessage(active.goal)}</p>
                  </div>
                </div>
                <div className="cue-section">
                  <Cursor size={23} />
                  <p>{t("操作：")}{uiMessage(active.action)}</p>
                </div>
                <button className="cue-section source-link" onClick={() => setModal({
              type: "source",
              scene: active
            })}>
                  <Link size={23} />
                  <span>{t("来源：")}{uiMessage(active.source)}</span>
                </button>
                {!rehearsing ? active.imported ? <div className="imported-source-note">
                      <WarningCircle size={20} />
                      <span>
                        {active.importWarnings?.length ? t("{0}项内容需要对照原文件", [active.importWarnings.length]) : t("用户原稿 · 业务事实需自行核对")}
                      </span>
                    </div> : <button className="claim-note" onClick={() => setModal({
              type: "claim"
            })}>
                      <WarningCircle size={23} />
                      <span>
                        <strong>{t("每周节省10小时 ·")}{" "}
                          {claimStatus === "pending" ? t("待验证") : t("待测假设")}
                        </strong>
                        <small>
                          {claimStatus === "pending" ? t("尚无测试记录") : t("尚未作为已实现结果")}
                        </small>
                      </span>
                    </button> : <div className="rehearsal-tools">
                    <button className={"secondary " + (session.marks.includes(session.index) ? "marked" : "")} onClick={mark}>
                      <Flag size={19} />
                      {session.marks.includes(session.index) ? t("本段已标记") : t("标记本段问题")}
                    </button>
                    <button className="quiet-button" onClick={() => setBackup(!backup)}>
                      <BookmarkSimple size={19} />
                      {backup ? t("返回演示画面") : t("演示卡住？切备用画面")}
                    </button>
                    <p>{t("备用画面已预先准备，切换时会明确标记。")}</p>
                  </div>}
              </aside>
            </div>
            <section className="timeline" aria-label={t("演示分镜时间轴")}>
              <div className="timeline-heading">
                <h2>
                  <FilmStrip size={23} />{t("演示结构（")}{rehearsing ? session.plan.budget : budget}{t(" 秒） ")}</h2>
                <span>
                  {rehearsing ? t("第 {0} 段 / 共{1}段", [session.index + 1, session.plan.scenes.length]) : t("总时长：{0} 秒", [budget])}
                </span>
              </div>
              <div className="timeline-scroll">
                <div className="ruler" style={scenes[0]?.imported ? {
              gridTemplateColumns: `repeat(${activeTimes.length},minmax(120px,1fr))`
            } : undefined}>
                  {activeTimes.map((_, i) => <span key={i}>
                      {activeTimes.slice(0, i).reduce((a, b) => a + b, 0)}{t(" 秒 ")}</span>)}
                  <span className="ruler-end">
                    {activeTimes.reduce((a, b) => a + b, 0)}{t(" 秒 ")}</span>
                </div>
                <div className="filmstrip" style={scenes[0]?.imported ? {
              gridTemplateColumns: `repeat(${activeTimes.length},minmax(120px,1fr))`
            } : undefined}>
                  {(rehearsing ? session.plan.scenes : scenes).map((s, i) => <button className={"scene-thumb " + (activeIndex === i ? "selected" : "")} key={s.id} aria-label={t("分镜 {0} {1} {2}秒", [i + 1, uiMessage(s.name), activeTimes[i]])} aria-pressed={activeIndex === i} onClick={() => {
                if (rehearsing) {
                  setSession(p => ({
                    ...p,
                    index: i
                  }));
                  setBackup(false);
                } else setSelected(i);
              }}>
                      {s.thumb ? <img src={s.thumb} alt="" /> : <div className="text-slide-thumb">{s.title}</div>}
                      <span>
                        {uiMessage(s.name)} <small>{activeTimes[i]}{t(" 秒")}</small>
                      </span>
                      {rehearsing && session.marks.includes(i) && <Flag className="thumb-flag" size={16} weight="fill" />}
                    </button>)}
                </div>
              </div>
            </section>
          </>}
        {tab === "review" && <section className="review-page">
            <div className="review-intro">
              <div>
                <div className="eyebrow">REHEARSAL REVIEW</div>
                <h2>
                  {session ? t("把这一轮，变成下一轮的进步。") : t("准备好，再开始一轮。")}
                </h2>
                <p>
                  {session ? t("本轮基于 {0} · {1}秒方案，时间来自实际操作记录。", [session.plan.version, session.plan.budget]) : t("先完成一次计时彩排，这里就会留下每段用时和你标记的问题。")}
                </p>
              </div>
              <button className="secondary" onClick={start}>
                <ArrowCounterClockwise size={19} />
                {session ? t("再练一轮") : t("开始第一次彩排")}
              </button>
            </div>
            {session ? <>
                <div className="review-summary">
                  <div>
                    <span>{t("本轮实际用时")}</span>
                    <strong>{fmt(total)}</strong>
                  </div>
                  <div>
                    <span>{t("计划用时")}</span>
                    <strong>{fmt(session.plan.budget)}</strong>
                  </div>
                  <div>
                    <span>{t("标记的问题")}</span>
                    <strong>
                      {session.marks.length}
                      <small>{t(" 处")}</small>
                    </strong>
                  </div>
                  <div className="summary-note">
                    <Clock size={25} />
                    <p>{t("记录的是每段停留时间， ")}<br />{t("暂停时间不计入。 ")}</p>
                  </div>
                </div>
                <div className="review-grid">
                  <section className="timing-table">
                    <h3>{t("每一段，时间花在哪里")}</h3>
                    <div className="table-head">
                      <span>{t("演示段落")}</span>
                      <span>{t("计划")}</span>
                      <span>{t("实际")}</span>
                    </div>
                    {session.plan.scenes.map((s, i) => <button className="timing-row" key={s.id} onClick={() => {
                setSelected(i);
                setTab("director");
              }}>
                        <span>
                          {i + 1}
                          <b>{uiMessage(s.name)}</b>
                          {session.marks.includes(i) && <Flag size={14} />}
                        </span>
                        <span>{session.plan.times[i]}{t("秒")}</span>
                        <span className={session.elapsed[i] > session.plan.times[i] ? "overtime" : ""}>
                          {sec(session.elapsed[i])}
                        </span>
                        <progress aria-hidden="true" max={Math.max(session.plan.times[i], session.elapsed[i], 1)} value={session.elapsed[i]} />
                      </button>)}
                  </section>
                  <section className="next-steps">
                    <div className="eyebrow">{t("下一轮，优先改这三件事")}</div>
                    <article>
                      <span className="step-number">01</span>
                      <div>
                        <h3>
                          {overrun >= 0 ? t("压缩“{0}”这一段", [session.plan.scenes[overrun].name]) : t("检查核心操作的讲述节奏")}
                        </h3>
                        <p>
                          {overrun >= 0 ? t("本轮实际用时超出计划，先删重复说明，再练一次。") : t("围绕一个完整操作讲清楚输入和结果，给点击与停顿留余量。")}
                        </p>
                        <button className="text-link" onClick={() => {
                    setSelected(overrun >= 0 ? overrun : Math.min(2, scenes.length - 1));
                    setTab("director");
                  }}>{t("回到分镜修改 ")}<ArrowRight size={16} />
                        </button>
                      </div>
                    </article>
                    <article>
                      <span className="step-number">02</span>
                      <div>
                        <h3>{t("补齐效果主张的依据")}</h3>
                        <p>
                          {session.plan.scenes[0]?.imported ? t("逐项检查原稿中的数字与效果主张，确认来源、适用范围和验证状态。") : t("“每周节省10小时”尚无测试记录。先作为待验证假设，再说明测试计划。")}
                        </p>
                        <button className="text-link" onClick={() => setModal(session.plan.scenes[0]?.imported ? {
                    type: "materials"
                  } : {
                    type: "claim"
                  })}>{t("查看材料缺口 ")}<ArrowRight size={16} />
                        </button>
                      </div>
                    </article>
                    <article>
                      <span className="step-number">03</span>
                      <div>
                        <h3>
                          {session.marks.length ? t("重练你标记的段落") : t("准备一条有依据的回答")}
                        </h3>
                        <p>
                          {session.marks.length ? t("本轮标记了{0}处。先解决一个具体问题，再重新计时。", [session.marks.length]) : t("从下面的示例问题开始，检查自己是否能清楚交代当前进展。")}
                        </p>
                      </div>
                    </article>
                    <small className="review-disclosure">{t("这些提示依据计时和预设检查规则整理。 ")}</small>
                  </section>
                </div>
              </> : <div className="empty-review">
                <FilmStrip size={52} />
                <p>{t("你的第一份复盘，从一次真实练习开始。")}</p>
                <button className="primary" onClick={start}>
                  <Play size={19} weight="fill" />{t("开始彩排 ")}</button>
              </div>}
            <section className="questions-section">
              <div className="section-title">
                <div>
                  <div className="eyebrow">{t("示例评委问题")}</div>
                  <h3>{t("把还没想清楚的，先问出来。")}</h3>
                </div>
                <button className="quiet-button" onClick={() => {
              const n = (question + 1) % questions.length;
              setQuestion(n);
              setAnswer(savedAnswers[n] || "");
              setOutline(false);
            }}>{t("换一个问题 ")}<ArrowRight size={18} />
                </button>
              </div>
              <div className="question-content">
                <div>
                  <h4>{t(questions[question].title)}</h4>
                  <p>{t(questions[question].note)}</p>
                  <button className="text-link" onClick={() => setOutline(!outline)}>
                    {outline ? t("收起参考结构") : t("看看回答结构")}
                    <CaretDown size={16} />
                  </button>
                  {outline && <p className="outline">{t(questions[question].outline)}</p>}
                </div>
                <div className="answer-box">
                  <textarea aria-label={t("练习回答")} placeholder={t("试着用几句话回答，先说明当前进展，再给出依据……")} value={answer} onChange={e => setAnswer(e.target.value)} rows={4} />
                  <div>
                    {savedAnswers[question] && <small>
                        <CheckCircle size={15} />{t("回答已记录 ")}</small>}
                    <button className="secondary" disabled={!answer.trim()} onClick={() => {
                  setSavedAnswers(p => ({
                    ...p,
                    [question]: answer
                  }));
                  notify(t("回答已记入本轮练习记录"));
                }}>
                      <Check size={17} />{t("保存回答 ")}</button>
                  </div>
                </div>
              </div>
            </section>
          </section>}
      </main>
      <input className="visually-hidden" ref={fileRef} type="file" multiple accept="image/png,image/jpeg,image/webp" onChange={addFiles} aria-label={t("上传产品截图")} />
      {toast && <div className="toast" role="status">
          <CheckCircle size={20} />
          {uiMessage(toast)}
        </div>}
      {modal && <Modal title={{
      duration: t("把重点留在更短的时间里"),
      preview: uiMessage(modal.scene?.source),
      source: t("查看材料来源"),
      claim: t("这条主张，还缺什么依据？"),
      materials: t("项目材料"),
      edit: t("编辑当前分镜"),
      help: t("欢迎体验 ShowFlow")
    }[modal.type]} wide={["duration", "preview", "materials"].includes(modal.type)} onClose={() => setModal(null)}>
          {modal.type === "duration" && <>
              <p className="modal-description">
                {modal.next === 90 ? t("保留完整操作和关键依据，压缩背景与重复讲述。") : t("恢复完整讲述节奏，为产品操作和必要说明留出更多时间。")}{t("原方案保留在版本记录中。 ")}</p>
              <table className="duration-table">
                <thead>
                  <tr>
                    <th>{t("演示段落")}</th>
                    <th>{t("当前 ")}{budget}{t("秒")}</th>
                    <th>{t("新方案 ")}{modal.next}{t("秒")}</th>
                  </tr>
                </thead>
                <tbody>
                  {scenes.map((s, i) => <tr key={s.id}>
                      <td>{uiMessage(s.name)}</td>
                      <td>{times[i]}{t("秒")}</td>
                      <td>{timesFor(scenes, modal.next)[i]}{t("秒")}</td>
                    </tr>)}
                </tbody>
                <tfoot>
                  <tr>
                    <th>{t("合计")}</th>
                    <th>{budget}{t("秒")}</th>
                    <th>{modal.next}{t("秒")}</th>
                  </tr>
                </tfoot>
              </table>
              <p className="small-muted">{t("时长来自预设编排模板；实际表达仍需彩排。 ")}</p>
              <div className="modal-actions">
                <button className="secondary" onClick={() => setModal(null)}>{t("保留当前方案 ")}</button>
                <button className="primary" onClick={() => applyBudget(modal.next)}>{t("应用")}{modal.next}{t("秒方案 ")}<ArrowRight size={18} />
                </button>
              </div>
            </>}
          {modal.type === "preview" && (modal.deck ? <DeckCanvas scene={modal.scene} deck={modal.deck} index={modal.index} total={modal.total || scenes.length} /> : <Picture scene={modal.scene} className="full-preview" />)}
          {modal.type === "source" && <>
              <Picture scene={modal.scene} className="full-preview" />
              <div className="source-description">
                <Link size={21} />
                <div>
                  <h3>{uiMessage(modal.scene.source)}</h3>
                  <p>{t("来源关联内容可以支撑画面中可见的功能，不代表独立验证了收益或用户效果。 ")}</p>
                </div>
              </div>
              <button className="secondary" onClick={() => setModal({
          type: "materials"
        })}>
                <Files size={18} />{t("查看全部材料 ")}</button>
            </>}
          {modal.type === "claim" && <>
              <div className="claim-callout">
                <WarningCircle size={26} />
                <div>
                  <h3>{t("每周节省10小时")}</h3>
                  <span>{t("待验证 · 尚无测试记录")}</span>
                </div>
              </div>
              <p className="modal-description">{t("产品截图展示了行动清单，但没有证明具体节省多少时间。建议补上测试对象、对比方法和实际记录，再判断这句话是否可以用于路演。 ")}</p>
              <label className="check-row">
                <input type="checkbox" checked={claimStatus === "hypothesis"} onChange={e => setClaimStatus(e.target.checked ? "hypothesis" : "pending")} />
                <span>{t("将这句话标为“待测假设”，保留在练习清单中")}</span>
              </label>
              <div className="modal-actions">
                <button className="secondary" onClick={() => setModal({
            type: "materials"
          })}>{t("补充材料 ")}</button>
                <button className="primary" onClick={() => {
            setModal(null);
            notify(t("主张状态已更新，尚未被标记为已验证"));
          }}>{t("完成 ")}<Check size={18} />
                </button>
              </div>
            </>}
          {modal.type === "materials" && <>
              <p className="modal-description">{t("添加自己的截图，作为当前分镜的画面。图片保存在本机；用于分镜后会随项目保存。 ")}</p>
              <div className="material-grid">
                {[{
            id: "sample",
            name: t("产品截图 02 · 合成示例"),
            url: "/assets/meeting-actions.png"
          }, ...materials].map(m => <button key={m.id} onClick={() => {
            if (m.id === "sample") {
              setSelected(Math.min(2, scenes.length - 1));
              setTab("director");
            } else {
              setScenes(p => p.map((s, i) => i === selected ? {
                ...s,
                image: m.url,
                fallback: m.url,
                thumb: m.url,
                source: m.name
              } : s));
              notify(t("已将图片用于当前分镜"));
            }
            setModal(null);
          }}>
                    <img src={m.url} onError={e => {
              e.currentTarget.src = "/assets/meeting-reference.png";
            }} alt={m.name} />
                    <span>{m.name}</span>
                    <small>
                      {m.id === "sample" ? t("查看核心演示") : t("用作当前分镜画面")}
                    </small>
                  </button>)}
              </div>
              <button className="secondary" onClick={() => fileRef.current?.click()}>
                <UploadSimple size={19} />{t("添加产品截图 ")}</button>
            </>}
          {modal.type === "edit" && <>
              <div className="edit-fields">
                <label>{t("场景标题 ")}<input value={editing.title} onChange={e => setEditing({
              ...editing,
              title: e.target.value
            })} />
                </label>
                <label>{t("场景目的 ")}<textarea rows={3} value={editing.goal} onChange={e => setEditing({
              ...editing,
              goal: e.target.value
            })} />
                </label>
                <label>{t("演示操作 ")}<input value={editing.action} onChange={e => setEditing({
              ...editing,
              action: e.target.value
            })} />
                </label>
              </div>
              <div className="modal-actions">
                <button className="secondary" onClick={() => setModal(null)}>{t("取消 ")}</button>
                <button className="primary" disabled={!editing.title.trim()} onClick={() => {
            const next = scenes.map((s, i) => i === selected ? editing : s);
            setScenes(next);
            saveVersion(next, budget);
            setModal(null);
            notify(t("分镜已更新，旧版已保留"));
          }}>{t("保存修改 ")}<Check size={18} />
                </button>
              </div>
            </>}
          {modal.type === "help" && <>
              <p className="modal-description">{t("这是基于你选定方向制作的交互原型。你可以切换分镜、编辑讲稿、应用90秒方案，完成真实计时彩排，再查看复盘和导出手卡。 ")}</p>
              <p className="modal-description">{t("PPTX在本机解析并保留原文件，项目在本浏览器保存。默认从公开目录搜集参考，通过 Firebase AI Logic 在设备内处理英文路演。明确选择云端协作并确认发送范围后，才发送所选文字给 Google Gemini。中文改版可选择云端或原有本机模型。推理来源随改版记录保存。 ")}</p>
              <button className="primary" onClick={() => setModal(null)}>{t("开始体验 ")}<ArrowRight size={18} />
              </button>
            </>}
        </Modal>}
    </div>;
}
