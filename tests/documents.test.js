import test from 'node:test';
import assert from 'node:assert/strict';
import worker, {answerDocument} from '../worker.js';
import {validateDocument,documentContext} from '../documents.js';
const doc={name:'안내.pdf',pages:[{number:1,text:'신청인은 서류를 제출합니다.'},{number:2,text:'납부 수수료는 1000원입니다.'}]};
test('PDF 질의는 공식 통계 조회 대신 문서를 근거로 답변',async()=>{
 let prompt;const result=await answerDocument('수수료는 얼마인가요?',{AI:{run:async(_,input)=>{prompt=input.messages;return {response:'1000원입니다. [PDF p.2]'};}}},doc);
 assert.equal(result.queryType,'첨부 PDF 질의');assert.equal(result.llmUsed,true);assert.match(result.answer,/PDF p.2/);assert.match(prompt[1].content,/1000원/);assert.match(prompt[0].content,/비신뢰/);
});
test('PDF 입력 검증: 빈 문서, 중복 페이지, 초과 텍스트',()=>{
 for(const bad of [{...doc,pages:[]},{...doc,pages:[doc.pages[0],doc.pages[0]]},{...doc,pages:[{number:1,text:'가'.repeat(600001)}]},{...doc,pages:[{number:1,text:' '}]}])assert.throws(()=>validateDocument(bad));
});
test('긴 문서의 마지막 페이지 근거 검색',()=>{
 const pages=Array.from({length:100},(_,i)=>({number:i+1,text:i===99?'특별기준 비용 500원':'일반 내용'}));assert.ok(documentContext('특별기준 비용',{name:'x.pdf',pages}).some(c=>c.page===100));
});
test('API의 잘못된 문서와 AI 장애 처리',async()=>{
 const res=await worker.fetch(new Request('https://bot.example/api/ask',{method:'POST',body:JSON.stringify({question:'내용은?',document:{}})}),{});assert.equal(res.status,400);
 const r=await answerDocument('내용은?',{AI:{run:async()=>{throw Error();}}},doc);assert.equal(r.llmUsed,false);assert.equal(r.aiStatus,'unavailable');
});
