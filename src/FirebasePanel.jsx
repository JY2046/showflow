import { t, useLocale, uiMessage, formatDate } from "./i18n";
import React, { useEffect, useState } from "react";
import { loadFirebase, deviceAvailability, prepareDevice, verifyAppCheck } from "./firebase-ai";
import { isHostedPreview, releaseLinks } from "./release";
export function safeAiError(e) {
  const message = String(e?.message || "连接失败，请重试。");
  if (/free tier is not available for this project/i.test(message)) return t("Google 暂未向此项目开放 Gemini 免费调用（403）。项目仍保留免费 Spark；本次未生成建议。英文稿可选择仅设备内处理。");
  return uiMessage(message.replace(/AIza[\w-]+/g, "[配置已隐藏]").replace(/eyJ[\w.-]{30,}/g, "[credential hidden]"));
}
export function FirebasePanel({
  runtime,
  setRuntime,
  mode,
  setMode,
  language,
  setLanguage,
  busy
}) {
  const locale = useLocale();
  const hosted = isHostedPreview();
  const [availability, setAvailability] = useState("checking"),
    [error, setError] = useState(""),
    [preparing, setPreparing] = useState(false),
    [progress, setProgress] = useState(null),
    [appCheck, setAppCheck] = useState(false),
    [checking, setChecking] = useState(false);
  async function connect() {
    if (hosted) { setAvailability(await deviceAvailability()); return; }
    setError("");
    try {
      setRuntime(await loadFirebase());
    } catch (e) {
      setError(safeAiError(e));
    }
    setAvailability(await deviceAvailability());
  }
  useEffect(() => {
    connect();
  }, []);
  function prepare() {
    setPreparing(true);
    setError("");
    prepareDevice(runtime, value => setProgress(value)).then(async () => {
      setAvailability(await deviceAvailability());
      setProgress(1);
    }).catch(e => setError(safeAiError(e))).finally(() => setPreparing(false));
  }
  async function attest() {
    setChecking(true);
    setError("");
    try {
      await verifyAppCheck(runtime);
      setAppCheck(true);
    } catch (e) {
      setAppCheck(false);
      setError(safeAiError(e));
    } finally {
      setChecking(false);
    }
  }
  const names = {
    checking: "检查中",
    api_missing: "当前浏览器未开放设备模型",
    unavailable: "当前设备不可用",
    downloadable: "需要首次下载",
    downloading: "正在下载",
    available: "已就绪"
  };
  if (hosted) return <section className="firebase-panel" aria-label="Hosted AI status">
    <div className="firebase-panel-heading"><strong>Firebase AI Logic</strong><span>{locale === "en" ? "Setup pending" : "配置待完成"}</span></div>
    <p className="scope-note">{locale === "en" ? "Live AI is not active in this hosted preview. Cloud quota and production attestation are pending. You can import, discover references, style, export and rehearse now." : "此线上预览暂未启用实时 AI，等待云端额度及正式验证配置。可先体验导入、参考搜集、样式、导出和彩排。"}</p>
    <a className="text-link" href={releaseLinks.guide} target="_blank" rel="noreferrer">{locale === "en" ? "Test real device AI locally →" : "在本机测试真实设备内 AI →"}</a>
  </section>;
  return <section className="firebase-panel" aria-label={t("Firebase 端云连接")}>
    <div className="firebase-panel-heading"><strong>{t("Firebase · 端云协作")}</strong><span className={runtime ? "connection-ready" : ""}>{runtime ? t("已连接项目") : t("待连接")}</span></div>
    <p className="scope-note">{t("设备内处理英文路演；云端支持中文改版。原始文件和图片始终保留在本机。")}</p>
    <div className="firebase-health" role="status"><span>{t("设备模型：")}{t(names[availability] || availability)}</span><span>App Check: {appCheck || runtime?.attestation?.verified ? t("验证通过") : t("待验证")}</span></div>
    <div className="firebase-actions">
      {!runtime && <button className="secondary" onClick={connect}>{t("重新连接")}</button>}
      <button className="secondary" disabled={!runtime || preparing || busy} onClick={prepare}>{preparing ? t("准备中 {0}", [progress === null ? "" : Math.round(progress * 100) + "%"]) : t("准备设备模型")}</button>
      <button className="secondary" disabled={!runtime || checking || busy} onClick={attest}>{checking ? t("正在验证…") : t("验证 App Check")}</button>
    </div>
    {preparing && <progress aria-label={t("设备模型下载进度")} value={progress ?? undefined} max="1" />}
    <label className="workflow-field">{t("处理方式")}<select aria-label={t("AI处理方式")} value={mode} disabled={busy} onChange={e => setMode(e.target.value)}><option value="device">{t("仅设备内 · 内容不传云端")}</option><option value="hybrid">{t("设备优先 · 允许云端接力")}</option><option value="cloud">{t("仅云端 · Gemini")}</option><option value="legacy">{t("原有本机模型 · Ollama")}</option></select></label>
    <label className="workflow-field">{t("改版语言")}<select aria-label={t("AI改版语言")} value={language} disabled={busy} onChange={e => setLanguage(e.target.value)}><option value="en">{t("English · 设备与云端")}</option><option value="zh">{t("中文 · 仅云端或原有本机模型")}</option></select></label>
    {mode === "hybrid" && <p className="scope-note">{t("设备未就绪或无法处理时，所选文字会经 Firebase 发送给 Google Gemini。下方确认仅对本次处理生效。")}</p>}
    {availability === "api_missing" && mode !== "cloud" && mode !== "legacy" && <p className="scope-note">{t("请使用支持 Prompt API 的桌面 Chrome。模型首次下载可能需要数分钟。")}</p>}
    {error && <p className="workflow-error" role="alert">{uiMessage(error)}</p>}
    <CloudQuotaHelp error={error} />
  </section>;
}

export function CloudQuotaHelp({ error }) {
  if (!error || !/free.*tier|free Gemini access|免费调用/i.test(error)) return null;
  return <div className="cloud-help" data-testid="cloud-quota-help"><p className="scope-note">{t("赛事账户约可用4天，无需绑卡；需项目链接与身份核验。")}</p><a className="text-link" href="https://forms.gle/uPcDhaYW3iVo2AYw5" target="_blank" rel="noreferrer">{t("申请赛事临时账户")}</a> · <a className="text-link" href="https://aistudio.google.com/docs/troubleshooting#free-tier-unavailable" target="_blank" rel="noreferrer">{t("查看官方排障说明")}</a></div>;
}
