import test from 'node:test';
import assert from 'node:assert/strict';
import {answerQuestion} from '../worker.js';
import {mortgageIntent,MORTGAGE_DEFINITION,MORTGAGE_GUIDANCE} from '../fixed-guidance.js';
const history=[{role:'user',content:'근저당권 설정 안내'},{role:'assistant',content:MORTGAGE_GUIDANCE}];
const ai={AI:{run:async()=>{throw Error('AI must not be called');}}};
const offline=async()=>{throw Error('search must not be called');};
test('원래 개념 질문을 표현 차이와 상관없이 AI 재해석 전에 답변',async()=>{
 for(const q of ['근저당권 설정이 뭐야','근저당권 설정은 무엇인가요?','근저당 설정이란?','근저당권이 뭐야?','근저당권 설정의 뜻을 알려줘']){
  const r=await answerQuestion(q,ai,offline,history);assert.equal(r.answer,MORTGAGE_DEFINITION);assert.equal(r.intent,'definition');assert.equal(r.interpretation,'original_intent');assert.ok(r.sources[0].url.includes('law.go.kr'));
 }
});
test('신청서류가 뭐야는 개념 질문과 구분하고 지정 문안을 그대로 표시',async()=>{
 for(const q of ['근저당권 설정 신청서류가 뭐야?','근저당권 설정 안내','근저당권 설정 절차 알려줘']){
  const r=await answerQuestion(q,ai,offline,history);assert.equal(r.answer,MORTGAGE_GUIDANCE);assert.equal(r.intent,'application');
 }
});
test('같은 주제의 생략된 질문은 해석하고 새 주제는 가로채지 않음',async()=>{
 assert.equal((await answerQuestion('그게 뭐야?',ai,offline,history)).intent,'definition');
 assert.equal((await answerQuestion('그럼 신청방법은?',ai,offline,history)).answer,MORTGAGE_GUIDANCE);
 for(const q of ['그럼 상속등기는 뭐야?','근저당권 설정 수수료는 얼마야?','서울 근저당권 설정 부동산 수는?'])assert.ok(!['definition','application'].includes(mortgageIntent(q,history).intent));
});
test('개념과 준비서류를 함께 물으면 두 안내를 제공',async()=>{
 const r=await answerQuestion('근저당권 설정의 뜻과 준비서류를 알려줘',ai,offline,history);assert.equal(r.intent,'definition_and_application');assert.ok(r.answer.includes(MORTGAGE_DEFINITION));assert.ok(r.answer.endsWith(MORTGAGE_GUIDANCE));
});
