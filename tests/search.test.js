import test from 'node:test';
import assert from 'node:assert/strict';
import worker, {clean, officialUrl, search} from '../worker.js';
test('외부 URL 및 변경 경로 차단',()=>{assert.equal(officialUrl('https://evil.example/a'),null);assert.equal(officialUrl('/delete.do'),null);assert.equal(officialUrl('/iu/no/openNotic.do'),'https://data.iros.go.kr/iu/no/openNotic.do');});
test('스크립트 제거',()=>assert.equal(clean('<p>공지&nbsp;안내</p><script>evil()</script>'),'공지 안내'));
test('질문과 관련된 링크를 조회하고 출처 제공',async()=>{const loaded=[];const r=await search('공황 안내',async url=>{loaded.push(url);return {url,title:'자료실',text:url.endsWith('detail.do')?'공황 안내에 관한 자료입니다.':'공개자료 목록입니다.',links:[{title:'공황 안내',url:'https://data.iros.go.kr/detail.do'}]};});assert.ok(loaded.includes('https://data.iros.go.kr/detail.do'));assert.equal(r.status,'found');assert.ok(r.sources[0].excerpt.includes('공황'));});
test('조회 실패를 성공으로 표시하지 않음',async()=>{const r=await search('매매 건수',async()=>{throw Error();});assert.equal(r.status,'unavailable');assert.equal(r.sources.length,0);});
test('통계에 확정 수치 대신 한계 안내',async()=>{const r=await search('매매 건수',async url=>({url,title:'등기현황',text:'매매 건수는 조건별 조회가 필요합니다.',links:[]}));assert.ok(r.answer.includes('확정할 수 없습니다'));});
test('질문 길이 검증',async()=>{const r=await worker.fetch(new Request('https://bot.example/api/ask',{method:'POST',body:JSON.stringify({question:'가'.repeat(501)})}),{});assert.equal(r.status,400);});

const fixture=async url=>({url,title:'등기정보광장',text:'등기정보광장은 등기현황과 데이터셋을 제공합니다.',links:[]});
const {answerQuestion,MODEL}=await import('../worker.js');
test('LLM으로 질의 해석 및 출처 기반 답변 생성',async()=>{
 const calls=[];
 const r=await answerQuestion('등기정보광장은 무엇인가요?',{AI:{run:async(model,input)=>{calls.push({model,input});return {response:calls.length===1?'등기정보광장 등기현황 데이터셋':'등기현황과 데이터셋을 제공하는 서비스입니다. [1]'};}}},fixture);
 assert.equal(calls.length,2);assert.equal(r.model,MODEL);assert.equal(r.llmUsed,true);assert.equal(r.interpretation,'llm');assert.ok(calls[1].input.messages[1].content.includes('officialExcerpts'));assert.ok(r.answer.includes('[1]'));
});
test('AI 장애 시 원문 검색으로 전환하고 미사용 표시',async()=>{
 const r=await answerQuestion('등기정보광장 안내',{AI:{run:async()=>{throw Error('quota');}}},fixture);
 assert.equal(r.llmUsed,false);assert.equal(r.model,null);assert.equal(r.aiStatus,'unavailable');assert.ok(r.sources.length);
});
test('근거가 없을 때 생성 답변 미사용',async()=>{
 let calls=0;const r=await answerQuestion('등기정보광장',{AI:{run:async()=>{calls++;return {response:'등기정보광장'};}}},async()=>{throw Error();});
 assert.equal(calls,1);assert.equal(r.aiStatus,'no_sources');assert.equal(r.llmUsed,false);
});
test('AI 바인딩 미설정 시 검색 기능 유지',async()=>{
 const r=await answerQuestion('등기정보광장',{},fixture);assert.equal(r.aiStatus,'not_configured');assert.equal(r.model,null);
});
test('통계 질문은 생성 답변에도 통계 API 미조회 고지',async()=>{
 const r=await answerQuestion('등기정보광장 통계 건수',{AI:{run:async()=>({response:'등기정보광장 통계 안내'})}},fixture);assert.ok(r.answer.includes('통계 API 조회가 아닙니다'));
});
