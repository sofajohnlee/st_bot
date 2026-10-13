import test from 'node:test';
import assert from 'node:assert/strict';
import {fixedGuidance,MORTGAGE_GUIDANCE} from '../fixed-guidance.js';
import {answerQuestion} from '../worker.js';
test('근저당권 설정 일반 안내·절차·서류 질문에 지정 문안 전체 반환',async()=>{
 for(const q of ['근저당권설정 안내','근저당권 설정 신청방법을 알려줘','근저당 설정등기 준비서류는?','근저당권설정']){
  const r=await answerQuestion(q,{AI:{run:async()=>{throw Error('must not generate');}}},async()=>{throw Error('must not search');});
  assert.equal(r.answer,MORTGAGE_GUIDANCE);assert.equal(r.answerMode,'fixed');assert.equal(r.llmUsed,false);
 }
 assert.match(MORTGAGE_GUIDANCE,/1000분의 10/);assert.match(MORTGAGE_GUIDANCE,/제52조의2 제1항/);assert.match(MORTGAGE_GUIDANCE,/1544-0773/);
});
test('말소·통계·구체적 후속 질문은 지정 문안으로 덮어쓰지 않음',()=>{
 for(const q of ['근저당권 말소 안내','서울 2026년 9월 근저당권설정 신청 부동산 수는?','근저당권 설정 수수료 얼마인가요?','근저당권 설정 시 주소가 다른데 왜 표시변경을 하나요?','근저당권 설정 인감증명서 대체 가능?'])assert.equal(fixedGuidance(q),null);
});
