import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import JSZip from "jszip";
import { importPptx } from "../src/pptx-import.js";
import { timesFor } from "../src/timing.js";
import {
  searchReferences,
  revisePresentation,
  validateRevision,
} from "../server/api.mjs";
const fixture = new URL(
  "../qa/pipeline/会议行动卡_流程测试原稿_4页.pptx",
  import.meta.url,
);
const file = async () =>
  new File([await fs.readFile(fixture)], "自带原稿.pptx");

test("Import real PPTX text, original notes, image-free slide and all embedded pictures", async () => {
  const input = await file(),
    p = await importPptx(input);
  assert.equal(p.scenes.length, 4);
  assert.equal(p.scenes[1].image, null);
  assert.match(p.scenes[0].deckBody, /计划邀请3支团队/);
  assert.doesNotMatch(p.scenes[0].deckBody, /ShowFlow|01 \/ 04/);
  assert.match(p.scenes[2].script, /流程测试备注/);
  assert.equal(
    p.scenes[2].original.elements.filter((e) => e.type === "image").length,
    1,
  );
  assert.equal(p.file.blob, input);
  assert.equal(p.file.hash.length, 64);
});
test("Import uses presentation slide ordering, not file numbering", async () => {
  const z = await JSZip.loadAsync(await fs.readFile(fixture));
  let xml = await z.file("ppt/presentation.xml").async("string");
  const ids = xml.match(/<p:sldId\b[^>]*\/>/g);
  assert.equal(ids.length, 4);
  xml = xml
    .replace(ids[0], "__FIRST__")
    .replace(ids[1], ids[0])
    .replace("__FIRST__", ids[1]);
  z.file("ppt/presentation.xml", xml);
  const p = await importPptx(
    new File([await z.generateAsync({ type: "uint8array" })], "顺序测试.pptx"),
  );
  assert.match(p.scenes[0].title, /会开完了/);
});
test("Import rejects old-format, oversized and entity-bearing files", async () => {
  await assert.rejects(importPptx(new File(["fake"], "old.ppt")), /目前支持/);
  await assert.rejects(
    importPptx({ name: "too-large.pptx", size: 31 * 1024 * 1024 }),
    /30MB/,
  );
  const z = await JSZip.loadAsync(await fs.readFile(fixture));
  z.file(
    "ppt/presentation.xml",
    '<!DOCTYPE p [<!ENTITY x "bad">]>' +
      (await z.file("ppt/presentation.xml").async("string")),
  );
  await assert.rejects(
    importPptx(
      new File([await z.generateAsync({ type: "uint8array" })], "entity.pptx"),
    ),
    /XML/,
  );
});
test("Non-six-slide rehearsal budgets total exactly 90 and 180 seconds", () => {
  for (const count of [1, 4, 8, 30])
    for (const budget of [90, 180]) {
      const t = timesFor(
        Array.from({ length: count }, (_, i) => ({
          id: String(i),
          deckBody: "文本".repeat(i * 3),
        })),
        budget,
      );
      assert.equal(t.length, count);
      assert.equal(
        t.reduce((a, b) => a + b, 0),
        budget,
      );
      assert.ok(t.every((x) => Number.isInteger(x) && x > 0));
    }
});
const pages = [
  {
    id: "one",
    title: "试用计划",
    body: "计划邀请3支团队试用，收益尚未验证。",
    script: "",
    hasImage: false,
    includeNotes: false,
  },
];
const suggestion = {
  summary: "精简表达",
  theme: "paper",
  pages: [
    {
      id: "one",
      title: "邀请团队试用",
      body: "计划邀请3支团队试用，收益仍待验证。",
      script: "",
      layout: "split",
      reason: "保留验证状态",
      referenceIds: ["r1"],
    },
  ],
};
test("AI rejects invented numbers, foreign citations and mismatched pages", () => {
  const good = validateRevision(structuredClone(suggestion), pages, [
    { id: "r1" },
  ]);
  assert.equal(good.pages[0].layout, "statement");
  const invented = structuredClone(suggestion);
  invented.pages[0].body = "已经有100家客户。";
  assert.throws(
    () => validateRevision(invented, pages, [{ id: "r1" }]),
    /原稿没有的数字/,
  );
  assert.throws(
    () => validateRevision(suggestion, pages, []),
    /格式或参考来源/,
  );
  assert.throws(
    () => validateRevision({ ...suggestion, pages: [] }, pages, [{ id: "r1" }]),
    /页数/,
  );
  assert.throws(
    () => validateRevision(suggestion, pages, [{ id: "r1", evidenceLevel: "metadata_only" }]),
    /参考来源/,
  );
  const copiedCompany = structuredClone(suggestion);
  copiedCompany.pages[0].body = "使用Front跟进全部任务。";
  assert.throws(
    () => validateRevision(copiedCompany, pages, [{ id: "r1", name: "Front" }]),
    /参考公司的名称/,
  );
});
test("Network discovery drops uncited fabricated URLs and exposes real search metadata", async () => {
  const keyBefore = process.env.OPENAI_API_KEY;
  process.env.OPENAI_API_KEY ||= "unit-test-only";
  const fake = async () =>
    Response.json({
      id: "test-search",
      status: "completed",
      output: [
        {
          type: "web_search_call",
          action: {
            sources: [
              {
                url: "https://front.com/blog/inside-fronts-series-a-slide-deck",
              },
            ],
          },
        },
        {
          type: "message",
          content: [
            {
              type: "output_text",
              text: JSON.stringify({
                summary: "两条候选",
                results: [
                  {
                    name: "Front",
                    title: "Front deck",
                    url: "https://front.com/blog/inside-fronts-series-a-slide-deck",
                    industry: "企业服务",
                    stage: "A轮",
                    kind: "真实案例",
                    year: "2016",
                    reason: "协作产品",
                    takeaway: "产品价值",
                  },
                  { name: "Fake", url: "https://invented.invalid/fake" },
                ],
              }),
            },
          ],
        },
      ],
    });
  try {
    const r = await searchReferences({ query: "协作 SaaS" }, { fetcher: fake });
    assert.equal(r.results.length, 1);
    assert.equal(r.results[0].publisher, "front.com");
    assert.equal(r.meta.searchCalls, 1);
    assert.equal(r.meta.sourceCount, 1);
  } finally {
    if (keyBefore === undefined) delete process.env.OPENAI_API_KEY;
  }
});
test("Cloud revision requires consent and surfaces provider failure without fallback advice", async () => {
  await assert.rejects(revisePresentation({ consent: false, pages }), /先确认/);
  const keyBefore = process.env.OPENAI_API_KEY;
  process.env.OPENAI_API_KEY ||= "unit-test-only";
  try {
    await assert.rejects(
      revisePresentation(
        { consent: true, pages, references: [] },
        { fetcher: async () => new Response("{}", { status: 429 }) },
      ),
      /限流/,
    );
  } finally {
    if (keyBefore === undefined) delete process.env.OPENAI_API_KEY;
  }
});

test("Live-catalog parser handles commas/quotes and industry ranking returns source records only", async () => {
  const { parseCsv, rankCatalog } = await import("../server/catalog.mjs");
  const rows = parseCsv(
    'company_name,display_name,year,round,google_drive_link\r\nFront,"Front, Series A",2016,Series A,https://drive.google.com/file/d/front/view\r\nShopify,Shopify,2016,,https://drive.google.com/file/d/shopify/view\r\nIntercom,Intercom,2011,Seed,https://drive.google.com/file/d/intercom/view',
  );
  assert.equal(rows[0].display_name, "Front, Series A");
  assert.deepEqual(
    rankCatalog(rows, "Front").map((x) => x.r.company_name),
    ["Front"],
  );
  assert.deepEqual(
    rankCatalog(rows, "电商").map((x) => x.r.company_name),
    [],
  );
  assert.equal(rankCatalog(rows, "完全未知领域 xyz").length, 0);
});


test("Revision forwards user borrowing notes rather than catalog metadata", async () => {
  const keyBefore = process.env.OPENAI_API_KEY;
  process.env.OPENAI_API_KEY ||= "unit-test-only";
  let sent;
  try {
    const result = await revisePresentation({ consent: true, pages, references: [{ id: "r1", name: "Front", url: "https://front.com/", note: "目录元信息", myNote: "封面只保留一个价值主张", catalogSource: "https://github.com/example/catalog" }] }, { fetcher: async (_url, request) => {
      sent = JSON.parse(JSON.parse(request.body).input[1].content);
      return Response.json({ id: "test-note", status: "completed", output: [{ type: "message", content: [{ type: "output_text", text: JSON.stringify(suggestion) }] }] });
    } });
    assert.equal(sent.references[0].note, "封面只保留一个价值主张");
    assert.equal(sent.references[0].evidenceLevel, "user_notes");
    assert.equal(result.meta.validationVersion, 2);
  } finally { if (keyBefore === undefined) delete process.env.OPENAI_API_KEY; }
});
