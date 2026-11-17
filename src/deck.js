import { t, getLocale, uiMessage } from "./i18n.js";
export const themes = [
  {
    id: "stage",
    name: "舞台紫",
    background: "#1f1e2b",
    color: "#f7f4fc",
    accent: "#cfb3fb",
    font: "PingFang SC",
    titleSize: 40,
    bodySize: 18,
    margin: 50,
    layout: "split",
    align: "left",
  },
  {
    id: "paper",
    name: "极简白",
    background: "#faf9f5",
    color: "#20252c",
    accent: "#385cda",
    font: "PingFang SC",
    titleSize: 40,
    bodySize: 18,
    margin: 50,
    layout: "split",
    align: "left",
  },
  {
    id: "ink",
    name: "商务蓝",
    background: "#10263f",
    color: "#f4f8fc",
    accent: "#7fd5dc",
    font: "Microsoft YaHei",
    titleSize: 38,
    bodySize: 17,
    margin: 50,
    layout: "top",
    align: "left",
  },
  {
    id: "warm",
    name: "暖调叙事",
    background: "#f3e9dc",
    color: "#3f3028",
    accent: "#a34028",
    font: "Songti SC",
    titleSize: 40,
    bodySize: 18,
    margin: 58,
    layout: "statement",
    align: "left",
  },
];
export const defaultDeck = { global: themes[0], overrides: {}, enabled: false };
export const effectiveStyle = (deck, id) => ({
  ...deck.global,
  ...(deck.overrides[id] || {}),
});
export function slideLayout(style) {
  const m = Number(style.margin),
    w = 960 - m * 2;
  const base = {
    label: { x: m, y: 30, w, h: 22 },
    footer: { x: m, y: 508, w, h: 15 },
  };
  if (style.layout === "statement")
    return {
      ...base,
      title: { x: m, y: 135, w, h: 150 },
      body: { x: m, y: 305, w, h: 120 },
    };
  if (style.layout === "top")
    return {
      ...base,
      title: { x: m, y: 85, w, h: 98 },
      body: { x: m, y: 195, w: w * 0.35, h: 255 },
      image: { x: m + w * 0.4, y: 195, w: w * 0.6, h: 265 },
    };
  if (style.layout === "image")
    return {
      ...base,
      title: { x: m, y: 80, w, h: 95 },
      body: { x: m, y: 183, w, h: 64 },
      image: { x: m, y: 266, w, h: 219 },
    };
  return {
    ...base,
    title: { x: m, y: 140, w: w * 0.46, h: 140 },
    body: { x: m, y: 300, w: w * 0.46, h: 150 },
    image: { x: m + w * 0.51, y: 115, w: w * 0.49, h: 340 },
  };
}
export function downloadJson(value, name) {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(value, null, 2)], { type: "application/json" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}
// The same 960×540 point geometry drives the DOM preview and editable PPTX.
export async function createDeck(scenes, deck, getImage, projectName) {
  const { default: PptxGenJS } = await import("pptxgenjs");
  const pptx = new PptxGenJS();
  pptx.layout = "LAYOUT_WIDE";
  pptx.author = "ShowFlow";
  pptx.subject = t("用户可编辑的路演样式");
  pptx.title = projectName || scenes[0]?.projectName || t("会议行动卡 · 示例项目");
  pptx.lang = getLocale() === "en" ? "en-US" : "zh-CN";
  for (const [index, scene] of scenes.entries()) {
    const st = effectiveStyle(deck, scene.id),
      pos = slideLayout(st),
      slide = pptx.addSlide();
    slide.background = { color: st.background.slice(1) };
    const text = (value, box, size, color = st.color, bold = false) =>
      slide.addText(value, {
        x: box.x / 72,
        y: box.y / 72,
        w: box.w / 72,
        h: box.h / 72,
        fontFace: st.font,
        fontSize: size,
        color: color.slice(1),
        bold,
        margin: 0,
        breakLine: false,
        valign: "top",
        align: st.align,
        fit: "shrink",
        paraSpaceAfter: 0,
      });
    text(
      `${projectName || scene.projectName || t("会议行动卡")} / ${uiMessage(scene.name)}`,
      pos.label,
      11,
      st.accent,
      true,
    );
    text(scene.title, pos.title, st.titleSize, st.color, true);
    text(scene.deckBody ?? scene.goal, pos.body, st.bodySize);
    text(
      "ShowFlow · " + (scene.imported ? t("用户导入材料") : t("合成示例材料")),
      { ...pos.footer, w: pos.footer.w * 0.75 },
      9,
      st.accent,
    );
    slide.addText(
      `${String(index + 1).padStart(2, "0")} / ${String(scenes.length).padStart(2, "0")}`,
      {
        x: (pos.footer.x + pos.footer.w * 0.8) / 72,
        y: pos.footer.y / 72,
        w: (pos.footer.w * 0.2) / 72,
        h: pos.footer.h / 72,
        fontFace: st.font,
        fontSize: 9,
        color: st.accent.slice(1),
        margin: 0,
        align: "right",
        valign: "top",
      },
    );
    if (pos.image && scene.image) {
      const data = await getImage(scene.image);
      const img =
        typeof Image !== "undefined"
          ? await new Promise((resolve, reject) => {
              const i = new Image();
              i.onload = () => resolve(i);
              i.onerror = reject;
              i.src = data;
            })
          : null;
      const iw = img?.naturalWidth || 1600,
        ih = img?.naturalHeight || 900;
      const scale = Math.min(pos.image.w / iw, pos.image.h / ih);
      slide.addImage({
        data,
        x: (pos.image.x + (pos.image.w - iw * scale) / 2) / 72,
        y: (pos.image.y + (pos.image.h - ih * scale) / 2) / 72,
        w: (iw * scale) / 72,
        h: (ih * scale) / 72,
        altText: scene.source,
      });
    }
    slide.addNotes(
      `${scene.script}\n${t("画面来源：")}${scene.imported ? uiMessage(scene.source) : scene.source}. ${scene.imported ? t("用户导入材料，事实需自行核对。") : t("合成示例，不代表已验证的产品收益。")}${scene.aiRevision ? "\n" + t("AI改版理由：") + scene.aiRevision.reason + "\n" + t("参考来源：") + (scene.aiRevision.references || []).map((r) => r.url || r).join("\n") : ""}`,
    );
  }
  return pptx;
}
export async function exportDeck(scenes, deck, projectName) {
  const read = async (path) => {
    const r = await fetch(path);
    if (!r.ok) throw new Error("图片读取失败");
    return await new Promise((resolve, reject) => {
      r.blob()
        .then((blob) => {
          const fr = new FileReader();
          fr.onload = () => resolve(fr.result);
          fr.onerror = reject;
          fr.readAsDataURL(blob);
        })
        .catch(reject);
    });
  };
  const pptx = await createDeck(scenes, deck, read, projectName);
  await pptx.writeFile({ fileName: getLocale() === "en" ? "ShowFlow_pitch_deck.pptx" : "ShowFlow_路演PPT.pptx" });
}
