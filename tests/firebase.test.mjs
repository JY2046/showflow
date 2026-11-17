import test from "node:test";
import assert from "node:assert/strict";
import { assertPolicy, sourceFromSdk, referenceNotes, lockStatusFacts } from "../src/firebase-policy.js";
import { createFirebaseConfigMiddleware } from "../server/firebase-config.mjs";
const page = { id: "one", title: "Meeting actions", body: "Plan a pilot. Impact unverified.", script: "" };
test("Cloud and hybrid always require consent; Chinese stays out of unsupported local models", () => {
  for (const mode of ["device", "hybrid", "cloud"]) assert.throws(() => assertPolicy({ mode, consent: false, pages: [page], language: "en" }));
  assert.doesNotThrow(() => assertPolicy({ mode: "hybrid", consent: true, pages: [page], language: "en" }));
  assert.throws(() => assertPolicy({ mode: "device", consent: true, pages: [{...page, title:"中文"}], language: "en" }), /英文/);
  assert.throws(() => assertPolicy({ mode: "hybrid", consent: true, pages: [page], language: "zh" }));
  assert.doesNotThrow(() => assertPolicy({ mode: "cloud", consent: true, pages: [{...page, title:"中文"}], language: "zh" }));
});
test("Inference origin must come from SDK; privacy modes reject wrong or missing source", () => {
  assert.equal(sourceFromSdk("on_device", "hybrid"), "ON_DEVICE");
  assert.equal(sourceFromSdk("in_cloud", "hybrid"), "IN_CLOUD");
  for (const v of [undefined, "ON_DEVICE", "unknown"]) assert.throws(() => sourceFromSdk(v,"hybrid"));
  assert.throws(() => sourceFromSdk("in_cloud", "device"));
  assert.throws(() => sourceFromSdk("on_device", "cloud"));
});
test("Unread catalog entries do not become cited deck evidence", () => {
  assert.equal(referenceNotes([{id:"a",name:"A",catalogSource:true,note:"catalog summary"}])[0].evidenceLevel,"metadata_only");
  assert.equal(referenceNotes([{id:"a",name:"A",catalogSource:true,myNote:"my analysis"}])[0].evidenceLevel,"user_notes");
});
test("Planned pilots, prototypes and unvalidated impact are held verbatim outside the rewrite", () => {
  const original = "A prototype turns notes into actions. We plan a pilot with 3 teams. Impact has not been validated.";
  assert.deepEqual(lockStatusFacts(original), { editable: "", locked: ["A prototype turns notes into actions.", "We plan a pilot with 3 teams.", "Impact has not been validated."] });
  const zh = lockStatusFacts("讨论记录分散。计划邀请3支团队试用。效果尚未验证。");
  assert.equal(zh.editable, "讨论记录分散。");
  assert.deepEqual(zh.locked, ["计划邀请3支团队试用。", "效果尚未验证。"]);
  assert.deepEqual(lockStatusFacts("We plan a 3.5 month pilot. Impact is unverified.").locked, ["We plan a 3.5 month pilot.", "Impact is unverified."]);
});
const fake = { firebase: { apiKey:"public-web-config",appId:"app",projectId:"project" }, appCheck:{provider:"debug",debugToken:"private-test-credential"}, privateServerKey:"never return" };
async function configRequest(url, headers = {}, remoteAddress="127.0.0.1") {
  const m = createFirebaseConfigMiddleware({readConfig: async () => JSON.stringify(fake)});
  let status, data;
  await m({ url, method:"GET",headers:{host:"localhost:4173",...headers},socket:{remoteAddress}}, { writeHead: s => {status=s}, end: s => {data=JSON.parse(s)} }, () => {throw Error("wrong route")});
  return {status,data};
}
test("Public config cannot expose debug or server credentials; debug setup is local and same-origin", async () => {
  const c = await configRequest("/firebase/config");
  assert.equal(c.status,200);
  assert.doesNotMatch(JSON.stringify(c),/private-test-credential|never return/);
  assert.equal((await configRequest("/firebase/debug-token")).status,403);
  assert.equal((await configRequest("/firebase/debug-token",{"x-showflow-local-setup":"1","sec-fetch-site":"cross-site"})).status,403);
  assert.equal((await configRequest("/firebase/debug-token",{"x-showflow-local-setup":"1",host:"public.example"})).status,403);
  assert.equal((await configRequest("/firebase/debug-token",{"x-showflow-local-setup":"1"},"10.0.0.2")).status,403);
  assert.equal((await configRequest("/firebase/debug-token",{"x-showflow-local-setup":"1"})).data.debugToken,"private-test-credential");
});
