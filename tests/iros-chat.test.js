import test from 'node:test';
import assert from 'node:assert/strict';
import {CHAT_URL,chatAsset,extractPairs,discoverAssets,collectChat,relevantPairs,searchChat} from '../iros-chat.js';
test('공개 질문·답변 JSON과 정적 JS 객체 추출',()=>{
 const items=extractPairs(JSON.stringify({items:[{question:'상속등기 신청인은?',answer:'상속인이 신청합니다.'}]}));assert.equal(items.length,1);
 const js=extractPairs("const list=[{question:'신청서류는?',answer:'서류 안내입니다.'}];");assert.equal(js[0].question,'신청서류는?');
 assert.equal(extractPairs('<script>alert("질문")</script>메뉴 질문 답변').length,0);
});
test('공식 안내봇이 직접 참조한 공개 자산만 탐색',()=>{
 assert.deepEqual(discoverAssets('<script src="./js/qa.js"></script><a href="https://evil.example/qa.json">외부</a>'),['https://www.iros.go.kr/chat/js/qa.js']);
 for(const v of ['/admin/qa.json','https://www.iros.go.kr.evil.example/chat/qa.json','https://pw:user@www.iros.go.kr/chat/qa.json','/chat/delete.json'])assert.equal(chatAsset(v),null);
});
test('실제 추출한 질문·답변만 출처와 함께 검색',async()=>{
 const root='<script src="./qa.json"></script>';
 const data=JSON.stringify([{question:'상속등기 신청 서류는 무엇인가요?',answer:'상속등기 안내 답변입니다.'}]);
 const load=async url=>url===CHAT_URL?root:data;
 const collected=await collectChat(load);assert.equal(collected.status,'ready');assert.equal(collected.items.length,1);
 const result=await searchChat('상속등기 신청 서류',load);assert.equal(result.sources.length,1);assert.equal(result.sources[0].url,CHAT_URL);assert.match(result.sources[0].excerpt,/질문:.*상속등기/);assert.equal(result.chatStatus.matchedCount,1);
 assert.equal(relevantPairs('열람 발급',collected.items).length,0);
});
test('연결 실패와 Q/A 없는 셸을 수집 성공으로 표시하지 않음',async()=>{
 const failed=await collectChat(async()=>{throw Error('http_502');});assert.equal(failed.status,'unavailable');assert.equal(failed.items.length,0);
 const empty=await collectChat(async()=>'<html>등기절차 안내봇 메뉴</html>');assert.equal(empty.status,'no_public_qa');
});
test('순환 참조와 대량 자산을 제한',async()=>{
 const calls=[];await collectChat(async url=>{calls.push(url);return '<script src="'+CHAT_URL+'"></script>'+Array.from({length:20},(_,i)=>`<script src="./qa${i}.js"></script>`).join('');});assert.ok(calls.length<=7);assert.equal(new Set(calls).size,calls.length);
});

const {parseDialogue,collectDialogue}=await import('../iros-chat.js');
test('대화 응답의 match 답변만 근거로 사용하고 메뉴는 질의 후보로 분리',()=>{
 const f={speech:[{text:'공식 안내 답변'}],messages:[{items:[{button:{label:'상속등기',value:'상속등기',action:'query'}}]}]};
 const match=parseDialogue({data:{result:{fulfillment:{...f,response_status:'match'}}}},'상속등기');assert.equal(match.pair.answer,'공식 안내 답변');
 const menu=parseDialogue({data:{result:{fulfillment:{...f,response_status:'suggest'}}}},'상속등기');assert.equal(menu.pair,null);assert.equal(menu.suggestions.length,1);
 assert.throws(()=>parseDialogue({data:{}},'질문'));
});
test('대화 API는 일반 질문만 조회하고 원문 사용자 정보 없이 독립 세션 사용',async()=>{
 const calls=[];
 const result=await collectDialogue(async body=>{calls.push(body);return {data:{result:{fulfillment:{response_status:'match',speech:[{text:'등기 안내 답변'}],messages:[]}}}};},async()=> '127.0.0.1');
 assert.equal(result.items.length,4);assert.equal(calls[0].in_str,'자주하는 질문');assert.equal(calls[0].in_type,'query');assert.match(calls[0].session_id,/^session_/);assert.equal(calls[0].parameters.position_status,'N');
});
