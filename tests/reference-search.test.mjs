import test from "node:test";
import assert from "node:assert/strict";
import { queryTerms, rankCatalog, searchPublicCatalog } from "../src/catalog.js";
import { mergeReferenceBatch, groupReferences, externalSearchUrl } from "../src/reference-batches.js";

const rows = [
  { company_name:"Replit", display_name:"Replit - 2022 - Series B", year:"2022", round:"Series B" },
  { company_name:"Deepgram", display_name:"Deepgram - 2020 - Series A", year:"2020", round:"Series A" },
  { company_name:"Front", display_name:"Front - 2016 - Series A", year:"2016", round:"Series A" },
  { company_name:"Frontier", display_name:"Frontier - 2024", year:"2024", round:"" },
  { company_name:"Airtable", display_name:"Airtable - 2018", year:"2018", round:"" },
];
const csv = "company_name,display_name,year,round,google_drive_link\n"+rows.map((r,i)=>[r.company_name,r.display_name,r.year,r.round,`https://drive.google.com/file/d/example${i}/view`].join(",")).join("\n");

test("Specific FDE/agent/foreign-trade query never becomes a generic AI company shortlist", () => {
  const query="FDE企业服务，AI agent构建，出海外贸";
  const terms=queryTerms(query).map(t=>t.label);
  assert.ok(terms.includes("FDE"));
  assert.ok(terms.includes("企业服务"));
  assert.ok(terms.includes("AI agent"));
  assert.ok(terms.includes("出海外贸"));
  assert.deepEqual(rankCatalog(rows,query),[]);
  assert.deepEqual(rankCatalog(rows,"AI"),[]); // Airtable is not the token AI.
  assert.deepEqual(rankCatalog(rows,"协作 SaaS"),[]); // No invented industry metadata.
});

test("Matches are supported by actual fields, with every missing term retained", () => {
  const ranked=rankCatalog(rows,"Front A轮 2016");
  assert.equal(ranked[0].r.company_name,"Front");
  assert.equal(ranked[0].complete,true);
  assert.deepEqual(ranked[0].hits.map(h=>h.field),["round","company_name","year"]);
  assert.ok(!rankCatalog(rows,"Front").some(x=>x.r.company_name==="Frontier"));
  const partial=rankCatalog(rows,"Front 外贸")[0];
  assert.equal(partial.complete,false);
  assert.deepEqual(partial.missing,["外贸"]);
});

test("Live catalog result separates strict and partial matches; failure is not empty success", async () => {
  let fetchOptions;
  const fetcher=async (_url, options)=>{fetchOptions=options;return new Response(csv);};
  const good=await searchPublicCatalog({query:"Front 2016"},{fetcher});
  assert.equal(good.results.length,1);
  assert.equal(good.results[0].forRewrite,false);
  assert.equal(good.results[0].matching.level,"all");
  assert.equal(fetchOptions.cache,"no-store");
  const partial=await searchPublicCatalog({query:"Front 外贸"},{fetcher});
  assert.equal(partial.results.length,0);
  assert.equal(partial.relatedResults.length,1);
  assert.equal(partial.relatedResults[0].matching.level,"partial");
  const none=await searchPublicCatalog({query:"FDE企业服务，AI agent构建，出海外贸"},{fetcher});
  assert.equal(none.results.length,0);assert.equal(none.relatedResults.length,0);
  assert.equal(none.meta.scope,"catalog_metadata_exact_terms");
  await assert.rejects(searchPublicCatalog({query:"Front"},{fetcher:async()=>new Response("failure",{status:503})}),/暂时无法访问/);
});

test("A new batch preserves history, IDs and personal notes without stale query data or automatic AI selection", () => {
  const previous=[{id:"old-front",url:"https://example.test/front/",title:"old title",myNote:"我的私有借鉴笔记",saved:true,forRewrite:true,query:"old query"},{id:"past",url:"https://example.test/past",saved:true,forRewrite:true}];
  const response={results:[{id:"new-front",url:"https://example.test/front",title:"fresh title",saved:true}],relatedResults:[{id:"partial",url:"https://example.test/partial",saved:true}],meta:{responseId:"batch-2",generatedAt:"2026-11-18T00:00:00Z",model:"catalog",queryTerms:["Front"]}};
  const result=mergeReferenceBatch(previous,response,"Front new query");
  assert.equal(result.references[0].id,"old-front");
  assert.equal(result.references[0].title,"fresh title");
  assert.equal(result.references[0].myNote,"我的私有借鉴笔记");
  assert.equal(result.references[0].query,"Front new query");
  assert.ok(result.references.every(r=>!r.forRewrite));
  const grouped=groupReferences(result.references,result.lastSearch);
  assert.deepEqual(grouped.map(g=>g.items.length),[1,1,1,0]);
  // React may calculate receipt IDs before a pre-existing URL's ID is retained.
  const rawReceipt=mergeReferenceBatch([],response,"Front new query").lastSearch;
  assert.equal(groupReferences(result.references,rawReceipt)[0].items[0].id,"old-front");
  const empty=mergeReferenceBatch(result.references,{results:[],meta:{...response.meta,responseId:"batch-3"}},"Unknown");
  assert.equal(groupReferences(empty.references,empty.lastSearch)[0].items.length,0);
  assert.equal(groupReferences(empty.references,empty.lastSearch)[2].items.length,3);
  assert.equal(groupReferences(result.references,{query:"legacy",count:2})[2].items.length,3);
});

test("External PDF/PPT searches preserve the complete query and stay on a fixed public search host", () => {
  const query='FDE企业服务，AI agent构建，出海外贸';
  for (const type of ["pdf","ppt"]) {
    const url=new URL(externalSearchUrl(query,type));
    assert.equal(url.hostname,"www.google.com");
    assert.ok(url.searchParams.get("q").startsWith(query));
    assert.match(url.searchParams.get("q"),type==="pdf"?/filetype:pdf/:/filetype:pptx/);
  }
});
