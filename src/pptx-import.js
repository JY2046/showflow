import JSZip from "jszip";
import { XMLParser } from "fast-xml-parser";
const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  processEntities: true,
  parseTagValue: false,
  trimValues: false,
});
const list = (x) => (x == null ? [] : Array.isArray(x) ? x : [x]);
const attr = (x, k, fallback = "") => x?.["@_" + k] ?? fallback;
function text(node) {
  if (node == null) return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  return String(node["#text"] ?? "");
}
function paragraphs(tx) {
  return list(tx?.["a:p"])
    .map((p) =>
      [
        ...list(p["a:r"]).map((r) => text(r["a:t"])),
        ...list(p["a:fld"]).map((r) => text(r["a:t"])),
      ].join(""),
    )
    .filter(Boolean);
}
function resolve(base, target) {
  const out = base.split("/").slice(0, -1);
  for (const p of target.replace(/^\//, "").split("/")) {
    if (p === "..") out.pop();
    else if (p !== ".") out.push(p);
  }
  return target.startsWith("/") ? target.slice(1) : out.join("/");
}
function relPath(path) {
  const a = path.split("/"),
    name = a.pop();
  return [...a, "_rels", name + ".rels"].join("/");
}
async function readXml(zip, path, optional = false) {
  const f = zip.file(path);
  if (!f) {
    if (optional) return null;
    throw new Error("PPTX 缺少必要结构：" + path);
  }
  const raw = await f.async("string");
  if (raw.length > 8_000_000 || /<!DOCTYPE|<!ENTITY/i.test(raw))
    throw new Error("文件包含不受支持的 XML 内容。");
  return parser.parse(raw);
}
async function relationships(zip, path) {
  const doc = await readXml(zip, relPath(path), true);
  return Object.fromEntries(
    list(doc?.Relationships?.Relationship)
      .filter((r) => attr(r, "TargetMode") !== "External")
      .map((r) => [
        attr(r, "Id"),
        { path: resolve(path, attr(r, "Target")), type: attr(r, "Type") },
      ]),
  );
}
function themeColors(theme) {
  const scheme = theme?.["a:theme"]?.["a:themeElements"]?.["a:clrScheme"] || {};
  return Object.fromEntries(
    Object.entries(scheme).map(([k, v]) => [
      k.replace("a:", ""),
      attr(v?.["a:srgbClr"], "val", attr(v?.["a:sysClr"], "lastClr", "")),
    ]),
  );
}
function color(node, colors, fallback) {
  const rgb = attr(node?.["a:srgbClr"], "val");
  const scheme = attr(node?.["a:schemeClr"], "val");
  const aliases = { bg1: "lt1", bg2: "lt2", tx1: "dk1", tx2: "dk2" };
  const v =
    rgb ||
    colors[aliases[scheme] || scheme] ||
    attr(node?.["a:sysClr"], "lastClr");
  return /^[0-9a-f]{6}$/i.test(v) ? "#" + v : fallback;
}
function getTransform(sp) {
  return sp?.["p:spPr"]?.["a:xfrm"] || {};
}
function geometry(xfrm, transform, width, height) {
  const off = xfrm?.["a:off"] || {},
    ext = xfrm?.["a:ext"] || {};
  const x = Number(attr(off, "x", 0)),
    y = Number(attr(off, "y", 0)),
    w = Number(attr(ext, "cx", width * 0.7)),
    h = Number(attr(ext, "cy", height * 0.12));
  return {
    x: transform.x + x * transform.sx,
    y: transform.y + y * transform.sy,
    w: w * transform.sx,
    h: h * transform.sy,
  };
}
export async function importPptx(file) {
  if (!/\.pptx$/i.test(file.name))
    throw new Error(
      "目前支持 .pptx。请先在 PowerPoint 中把旧版 .ppt 另存为 .pptx。",
    );
  if (file.size > 30 * 1024 * 1024)
    throw new Error("请选择不超过 30MB 的 PPTX 文件。");
  const bytes = await file.arrayBuffer();
  const zip = await JSZip.loadAsync(bytes);
  const entries = Object.values(zip.files);
  if (
    entries.length > 3000 ||
    entries.reduce((n, f) => n + (f._data?.uncompressedSize || 0), 0) >
      180 * 1024 * 1024
  )
    throw new Error("展开后的内容过大，暂不支持此文件。");
  const presentation = (await readXml(zip, "ppt/presentation.xml"))?.[
    "p:presentation"
  ];
  if (!presentation) throw new Error("这不是可识别的 PowerPoint 文件。");
  const slideRefs = list(presentation["p:sldIdLst"]?.["p:sldId"]);
  if (!slideRefs.length || slideRefs.length > 30)
    throw new Error("当前支持 1–30 页的 PPTX，请先拆分较长文件。");
  const width = Number(attr(presentation["p:sldSz"], "cx", 12192000)),
    height = Number(attr(presentation["p:sldSz"], "cy", 6858000));
  if (!(width > 0 && height > 0)) throw new Error("幻灯片尺寸无效。");
  const masterRels = await relationships(zip, "ppt/presentation.xml");
  const theme = await readXml(zip, "ppt/theme/theme1.xml", true);
  const colors = themeColors(theme);
  const projectName = file.name.replace(/\.pptx$/i, "");
  const scenes = [];
  const warnings = [];
  for (const [index, ref] of slideRefs.entries()) {
    const path = masterRels[attr(ref, "r:id")]?.path;
    if (!path) throw new Error("幻灯片顺序关系不完整。");
    const doc = (await readXml(zip, path))?.["p:sld"];
    if (!doc) throw new Error("无法读取第 " + (index + 1) + " 页。");
    const rels = await relationships(zip, path),
      elements = [],
      slideWarnings = [];
    const bg = color(
      doc["p:cSld"]?.["p:bg"]?.["p:bgPr"]?.["a:solidFill"],
      colors,
      "#ffffff",
    );
    let texts = [];
    async function walk(tree, transform = { x: 0, y: 0, sx: 1, sy: 1 }) {
      for (const sp of list(tree?.["p:sp"])) {
        const ph = sp["p:nvSpPr"]?.["p:nvPr"]?.["p:ph"];
        const phType = attr(ph, "type");
        if (["sldNum", "dt", "ftr", "hdr"].includes(phType)) continue;
        const lines = paragraphs(sp["p:txBody"]),
          value = lines.join("\n"),
          runs = list(sp["p:txBody"]?.["a:p"]).flatMap((p) => list(p["a:r"]));
        const fontProps =
          runs.find((r) => r["a:rPr"])?.["a:rPr"] ||
          list(sp["p:txBody"]?.["a:p"])[0]?.["a:pPr"]?.["a:defRPr"] ||
          {};
        const size =
          Number(
            attr(
              fontProps,
              "sz",
              phType === "title" || phType === "ctrTitle" ? 3600 : 1800,
            ),
          ) / 100;
        const g = geometry(getTransform(sp), transform, width, height),
          fill = color(sp["p:spPr"]?.["a:solidFill"], colors, "transparent");
        if (value || fill !== "transparent")
          elements.push({
            type: "text",
            ...g,
            text: value,
            size,
            bold: attr(fontProps, "b") === "1",
            color: color(fontProps["a:solidFill"], colors, "#20252c"),
            fill,
            align: attr(
              list(sp["p:txBody"]?.["a:p"])[0]?.["a:pPr"],
              "algn",
              "l",
            ),
            font: attr(
              fontProps["a:ea"],
              "typeface",
              attr(fontProps["a:latin"], "typeface", "PingFang SC"),
            ),
          });
        if (value)
          texts.push({
            text: value,
            size,
            y: g.y,
            title: ["title", "ctrTitle"].includes(phType),
          });
        if (attr(getTransform(sp), "rot", 0) !== 0)
          slideWarnings.push("旋转文字在解析预览中按水平排版");
      }
      for (const pic of list(tree?.["p:pic"])) {
        const embed = attr(pic["p:blipFill"]?.["a:blip"], "r:embed");
        const imagePath = rels[embed]?.path;
        const f = imagePath && zip.file(imagePath);
        if (!f) {
          slideWarnings.push("链接图片未读取");
          continue;
        }
        const ext = imagePath.split(".").pop().toLowerCase(),
          mime = {
            png: "image/png",
            jpg: "image/jpeg",
            jpeg: "image/jpeg",
            gif: "image/gif",
            webp: "image/webp",
          }[ext];
        if (!mime) {
          slideWarnings.push("部分矢量或特殊图片仅保留在原文件");
          continue;
        }
        const image = `data:${mime};base64,${await f.async("base64")}`;
        elements.push({
          type: "image",
          ...geometry(getTransform(pic), transform, width, height),
          image,
        });
        if (pic["p:blipFill"]?.["a:srcRect"])
          slideWarnings.push("裁剪图片在解析预览中显示完整图片");
      }
      for (const group of list(tree?.["p:grpSp"])) {
        const x = group["p:grpSpPr"]?.["a:xfrm"] || {},
          off = x["a:off"] || {},
          ext = x["a:ext"] || {},
          chOff = x["a:chOff"] || {},
          chExt = x["a:chExt"] || {};
        const sx = Number(attr(ext, "cx", 1)) / Number(attr(chExt, "cx", 1)),
          sy = Number(attr(ext, "cy", 1)) / Number(attr(chExt, "cy", 1));
        await walk(group, {
          sx: transform.sx * sx,
          sy: transform.sy * sy,
          x:
            transform.x +
            (Number(attr(off, "x", 0)) - Number(attr(chOff, "x", 0)) * sx) *
              transform.sx,
          y:
            transform.y +
            (Number(attr(off, "y", 0)) - Number(attr(chOff, "y", 0)) * sy) *
              transform.sy,
        });
      }
      if (tree?.["p:graphicFrame"])
        slideWarnings.push(
          "表格、图表或SmartArt未转换为可编辑元素，请对照原文件",
        );
      if (tree?.["p:cxnSp"]) slideWarnings.push("连接线未重建");
    }
    await walk(doc["p:cSld"]?.["p:spTree"]);
    texts = texts.sort(
      (a, b) => b.title - a.title || b.size - a.size || a.y - b.y,
    );
    const heading = texts[0];
    const title = heading?.text || `第${index + 1}页`;
    const body = texts
      .filter(
        (x) =>
          x !== heading &&
          !(x.size <= 12 && (x.y > height * 0.85 || x.y < height * 0.12)),
      )
      .sort((a, b) => a.y - b.y)
      .map((x) => x.text)
      .join("\n");
    let notes = "";
    const noteRel = Object.values(rels).find((r) =>
      r.type.endsWith("/notesSlide"),
    );
    if (noteRel) {
      const n = (await readXml(zip, noteRel.path, true))?.["p:notes"];
      notes = list(n?.["p:cSld"]?.["p:spTree"]?.["p:sp"])
        .filter(
          (s) => attr(s["p:nvSpPr"]?.["p:nvPr"]?.["p:ph"], "type") === "body",
        )
        .flatMap((s) => paragraphs(s["p:txBody"]))
        .join("\n");
    }
    const image = elements.find((e) => e.type === "image")?.image || null;
    if (!texts.length)
      slideWarnings.push("未提取到可编辑文字，图片中的文字需要另行识别");
    if (doc["p:timing"] || doc["p:transition"])
      slideWarnings.push("动画和切换效果保留在原文件，不进入重排版");
    if (body.length > 10000)
      slideWarnings.push("文字较多，AI改版前请减少本页内容");
    const id = `import-${index + 1}-${crypto.randomUUID().slice(0, 8)}`;
    scenes.push({
      id,
      name: `第${index + 1}页`,
      title,
      deckBody: body,
      script: notes || body,
      goal: "讲清这一页的核心观点，并保留原稿事实。",
      action: `展示第${index + 1}页`,
      source: `${file.name} · 第${index + 1}页`,
      image,
      thumb: image,
      fallback: image,
      projectName,
      imported: true,
      original: { width, height, elements, background: bg },
      importWarnings: [...new Set(slideWarnings)],
      originalTitle: title,
      originalBody: body,
    });
    warnings.push(...slideWarnings.map((s) => `第${index + 1}页：${s}`));
  }
  const hash = Array.from(
    new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)),
  )
    .map((x) => x.toString(16).padStart(2, "0"))
    .join("");
  return {
    name: projectName,
    scenes,
    warnings: [...new Set(warnings)],
    file: {
      name: file.name,
      size: file.size,
      hash,
      blob: file,
      lastModified: file.lastModified,
    },
    importedAt: new Date().toISOString(),
  };
}
