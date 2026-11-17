import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import JSZip from "jszip";
import { createDeck, themes } from "../src/deck.js";
import { scenes } from "../src/data.js";

test("PPTX preserves six editable slides, custom single-page colors, text and notes", async () => {
  const deck = {
    global: themes[1],
    overrides: { demo: { ...themes[2], titleSize: 44 } },
    enabled: true,
  };
  const edited = scenes.map((s) =>
    s.id === "demo"
      ? { ...s, title: "验证后的标题", deckBody: "自定义正文" }
      : s,
  );
  const pptx = await createDeck(
    edited,
    deck,
    async (url) =>
      "data:image/png;base64," +
      (await fs.readFile(new URL("../public" + url, import.meta.url))).toString(
        "base64",
      ),
  );
  const zip = await JSZip.loadAsync(
    await pptx.write({ outputType: "nodebuffer" }),
  );
  const slideFiles = Object.keys(zip.files).filter((s) =>
    /^ppt\/slides\/slide\d+\.xml$/.test(s),
  );
  assert.equal(slideFiles.length, 6);
  const first = await zip.file("ppt/slides/slide1.xml").async("string");
  const third = await zip.file("ppt/slides/slide3.xml").async("string");
  assert.match(first, /faf9f5/i);
  assert.match(third, /10263f/i);
  assert.match(third, /<a:t>验证后的标题<\/a:t>/);
  assert.match(third, /<a:t>自定义正文<\/a:t>/);
  assert.match(third, /sz="4400"/);
  assert.match(third, /<p:pic>/);
  const notes = await zip
    .file("ppt/notesSlides/notesSlide3.xml")
    .async("string");
  assert.match(notes, /产品截图 02/);
});
test("Statement layout omits images while retaining editable text", async () => {
  const pptx = await createDeck(
    [scenes[0]],
    { global: { ...themes[3], layout: "statement" }, overrides: {} },
    () => {
      throw new Error("statement should not fetch an image");
    },
  );
  const zip = await JSZip.loadAsync(
    await pptx.write({ outputType: "nodebuffer" }),
  );
  const xml = await zip.file("ppt/slides/slide1.xml").async("string");
  assert.doesNotMatch(xml, /<p:pic>/);
  assert.match(xml, /让每场讨论，都有下一步/);
});
