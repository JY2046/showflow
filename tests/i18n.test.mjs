import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {translate,uiMessage,setLocale,getLocale} from '../src/i18n.js';
import {referenceText,referencesForRequest} from '../src/reference-i18n.js';
import {referenceSeeds} from '../src/references.js';

test('English is the default; switching UI language keeps dynamic values verbatim',()=>{
  assert.equal(getLocale(),'en');
  const title='自己的PPT / ${not executable}';
  assert.equal(translate('编辑第{0}页 {1}',[2,title],'en'),`Edit slide 2: ${title}`);
  setLocale('zh');assert.equal(translate('编辑第{0}页 {1}',[2,title]),`编辑第2页 ${title}`);
  setLocale('en');
  assert.equal(translate(title),title);
  setLocale('invalid');assert.equal(getLocale(),'en');
});
test('Parser and validation messages, including nested errors, are readable in English',()=>{
  assert.equal(uiMessage('第2页：连接线未重建'),'Slide 2: Connectors were not rebuilt.');
  const error='建议出现原稿没有的数字，已拦截。请重试或缩小修改范围。';
  const trace=uiMessage(`${error}（第 2 页 · ON_DEVICE · {"bodyLength":180}）`);
  assert.match(trace,/original.*blocked/i);assert.match(trace,/slide 2 · ON_DEVICE/);assert.doesNotMatch(trace,/[\u3400-\u9fff]/);
});
test('Only editorial reference metadata is localized; user notes and manual titles remain untouched',()=>{
  const source={...referenceSeeds[0],myNote:'待验证 · 我的笔记'};
  const before=JSON.stringify(source);const prepared=referencesForRequest([source],'en')[0];
  assert.equal(prepared.myNote,source.myNote);assert.match(prepared.note,/collaboration/);assert.equal(JSON.stringify(source),before);
  assert.equal(prepared.industry,source.industry);assert.equal(prepared.stage,source.stage);assert.equal(prepared.url,source.url);
  assert.equal(referenceText({id:'manual',title:'企业服务',note:'请保留中文笔记'},'title','en'),'企业服务');
  assert.equal(referenceText({id:'manual',title:'企业服务',note:'请保留中文笔记'},'note','en'),'请保留中文笔记');
});
test('Translated catalog entries remain metadata-only until the user adds borrowing notes',async()=>{
  const {referenceNotes}=await import('../src/firebase-policy.js');
  const entry={id:'catalog',catalogSource:'https://example.org',name:'Example',note:'按公司名与产品类别关键词匹配。公开索引记录：Example Series A。行业关联为ShowFlow编辑分类，原稿身份与业务事实仍需核对。'};
  const prepared=referencesForRequest([entry],'en');assert.doesNotMatch(prepared[0].note,/[\u3400-\u9fff]/);
  assert.equal(referenceNotes(prepared)[0].evidenceLevel,'metadata_only');
});
test('All statically marked Chinese UI messages have English translations',()=>{
  const messages=JSON.parse(fs.readFileSync(new URL('../src/messages.en.json',import.meta.url),'utf8'));
  for(const file of ['App.jsx','Workflow.jsx','Workspaces.jsx','FirebasePanel.jsx','ReferenceGroup.jsx','deck.js']){
    const source=fs.readFileSync(new URL('../src/'+file,import.meta.url),'utf8');
    for(const match of source.matchAll(/\bt\(("(?:[^"\\]|\\.)*")/g)){
      const key=JSON.parse(match[1]).trim();
      if(!/[\u3400-\u9fff]/.test(key))continue;
      assert.ok(Object.hasOwn(messages,key),`${file}: missing ${key}`);
      assert.doesNotMatch(messages[key],/[\u3400-\u9fff]/,`${file}: untranslated ${key}`);
    }
  }
});
test('English PPTX export localizes generated labels while preserving original content and notes',async()=>{
  const {createDeck,defaultDeck}=await import('../src/deck.js');const {default:JSZip}=await import('jszip');
  const projectName='原文件项目名';const title='自己的PPT标题';const body='A prototype. We plan a pilot with 3 teams. Impact has not been validated.';const script='原始中文备注 must stay verbatim.';
  const scene={id:'s1',imported:true,name:'第1页',projectName,title,deckBody:body,script,source:'Source.pptx · 第1页'};
  const pptx=await createDeck([scene],{...defaultDeck,global:{...defaultDeck.global,layout:'statement'}},async()=>'',projectName);
  const zip=await JSZip.loadAsync(await pptx.write({outputType:'nodebuffer'}));const slide=await zip.file('ppt/slides/slide1.xml').async('string');const notes=await zip.file('ppt/notesSlides/notesSlide1.xml').async('string');
  assert.ok(slide.includes(projectName+' / Slide 1'));assert.ok(slide.includes(title));assert.ok(slide.includes(body));assert.ok(slide.includes('Imported material'));assert.ok(notes.includes(script));assert.ok(notes.includes('Source.pptx · Slide 1'));
});
