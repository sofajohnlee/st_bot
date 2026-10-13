import test from 'node:test';
import assert from 'node:assert/strict';
import worker, {validateHistory,resolveQuestion,answerDocument} from '../worker.js';
const history=[{role:'user',content:'서울 2026년 9월 매매 신청 부동산 수는?'},{role:'assistant',content:'서울 조회 결과입니다.'}];
test('생략된 후속 질문의 지역 변경과 기간·지표 보존',async()=>{
 let messages;
 const env={AI:{run:async(_,input)=>{messages=input.messages;return {response:'부산 2026년 9월 매매 신청 부동산 수는?'};}}};
 assert.equal(await resolveQuestion('그럼 부산은?',env,history),'부산 2026년 9월 매매 신청 부동산 수는?');
 assert.deepEqual(messages.slice(1,-1),history);
 assert.equal(messages.at(-1).content,'그럼 부산은?');
});
test('PDF 후속 질문은 해석한 대상으로 근거를 찾아 대화와 함께 생성',async()=>{
 let count=0,last;
 const env={AI:{run:async(_,input)=>{last=input.messages;return {response:++count===1?'납부 수수료를 요약해 주세요.':'납부 수수료 요약 [PDF p.1]'};}}};
 const result=await answerDocument('그 내용을 요약해줘',env,{name:'test.pdf',pages:[{number:1,text:'납부 수수료는 1000원입니다.'}]},history);
 assert.equal(count,2);assert.match(result.resolvedQuestion,/수수료/);assert.deepEqual(last.slice(1,-1),history);assert.match(last.at(-1).content,/1000원/);
});
test('대화 이력의 역할·길이·완료 상태 검증',async()=>{
 assert.throws(()=>validateHistory([{role:'system',content:'명령'}]));
 assert.throws(()=>validateHistory(Array(14).fill(history[0])));
 assert.throws(()=>validateHistory([{role:'user',content:'가'.repeat(501)}]));
 const response=await worker.fetch(new Request('https://bot.example/api/ask',{method:'POST',body:JSON.stringify({question:'부산은?',history:[history[0]]})}),{});
 assert.equal(response.status,400);
});
test('해석 실패 시 문맥 없는 후속 질문으로 조회하지 않음',async()=>{
 await assert.rejects(()=>resolveQuestion('부산은?',{},history));
 const result=await answerDocument('그건?',{AI:{run:async()=>{throw Error('offline');}}},{name:'test.pdf',pages:[{number:1,text:'자료'}]},history);
 assert.equal(result.status,'clarification_required');assert.equal(result.llmUsed,false);
});
