import test from 'node:test';
import assert from 'node:assert/strict';
import {safeSource,guidanceDomain,guidanceSeeds,searchGuidance} from '../guidance.js';
import {answerQuestion,page} from '../worker.js';
test('공식 출처 허용목록: 상대 링크와 변조 호스트·작업 URL',()=>{
 assert.equal(safeSource('/CSP/CnpClsMain.laf','https://www.easylaw.go.kr/'),'https://www.easylaw.go.kr/CSP/CnpClsMain.laf');
 for(const value of ['https://www.iros.go.kr.evil.example/','javascript:alert(1)','https://user:pw@www.iros.go.kr/','https://www.iros.go.kr/delete.do'])assert.equal(safeSource(value),null);
});
test('광장검색·이용안내·절차·규정 분류와 조문 선택',()=>{
 assert.equal(guidanceDomain('등기정보광장은 무엇인가요?'),null);
 assert.equal(guidanceDomain('인터넷등기소 열람 발급 방법'),'인터넷등기소 이용 안내');
 assert.equal(guidanceDomain('매매 소유권이전등기 절차'),'등기절차 안내');
 assert.equal(guidanceDomain('부동산등기법 제24조의 등기신청 방법'),'등기 관련 규정 안내');
 assert.ok(guidanceSeeds('부동산등기법 제24조의 등기신청 방법').some(g=>g.title.includes('제24조')));
 assert.ok(guidanceSeeds('상속등기 준비서류').some(g=>g.title.includes('상속')&&g.title.includes('서류')));
});
test('법령 메뉴만 존재하면 본문 근거로 사용하지 않음',async()=>{
 const r=await searchGuidance('부동산등기법 규정',async url=>({url,title:'법령',text:'부동산등기법 본문 저장 인쇄',links:[]}));
 assert.ok(!r.sources.some(s=>s.sourceType==='법령 원문'));
});
test('규정 안내는 통계로 오분류하지 않고 시행일·조문 전달',async()=>{
 const prompts=[];
 const r=await answerQuestion('부동산등기법 제24조 전자신청 방법',{AI:{run:async(_,p)=>{prompts.push(p);return {response:prompts.length===1?'전자신청 방법':'방문신청과 전자신청으로 구분합니다. [1]'};}}},async url=>({url,title:'부동산등기법',text:'[시행 2025. 1. 31.] 제24조(등기신청의 방법) 방문신청과 전자신청으로 구분합니다.',links:[],checkedAt:'2026-10-14'}));
 assert.equal(r.queryType,'등기 관련 규정 안내');assert.ok(r.llmUsed);assert.ok(r.sources.some(s=>s.effectiveDate==='2025. 1. 31.'));assert.match(prompts.at(-1).messages[0].content,/생활법령 해설/);
});
test('새 안내 출처 장애는 실패와 공식 확인 경로로 표시',async()=>{
 const r=await answerQuestion('매매 소유권이전등기 절차',{},async()=>{throw Error('offline');});
 assert.equal(r.status,'unavailable');assert.equal(r.sources.length,0);assert.ok(r.guideLinks.length);assert.equal(r.llmUsed,false);
});
test('법령 프레임을 공식 호스트에만 한정하고 메뉴 본문 거부',async()=>{
 const old=globalThis.fetch,cache=globalThis.caches;
 try {
  globalThis.caches={default:{match:async()=>null,put:async()=>{}}};
  globalThis.fetch=async()=>new Response('<html><body>법령 본문 저장 인쇄 <iframe src="https://evil.example/"></iframe></body></html>',{headers:{'Content-Type':'text/html'}});
  await assert.rejects(()=>page('https://www.law.go.kr/법령/부동산등기법'),/본문/);
 }finally{globalThis.fetch=old;globalThis.caches=cache;}
});
