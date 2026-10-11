import test from 'node:test';
import assert from 'node:assert/strict';
import worker, {clean, officialUrl, search} from '../worker.js';
test('외부 URL 및 변경 경로 차단',()=>{assert.equal(officialUrl('https://evil.example/a'),null);assert.equal(officialUrl('/delete.do'),null);assert.equal(officialUrl('/iu/no/openNotic.do'),'https://data.iros.go.kr/iu/no/openNotic.do');});
test('스크립트 제거',()=>assert.equal(clean('<p>공지&nbsp;안내</p><script>evil()</script>'),'공지 안내'));
test('질문과 관련된 링크를 조회하고 출처 제공',async()=>{const loaded=[];const r=await search('공황 안내',async url=>{loaded.push(url);return {url,title:'자료실',text:url.endsWith('detail.do')?'공황 안내에 관한 자료입니다.':'공개자료 목록입니다.',links:[{title:'공황 안내',url:'https://data.iros.go.kr/detail.do'}]};});assert.ok(loaded.includes('https://data.iros.go.kr/detail.do'));assert.equal(r.status,'found');assert.ok(r.sources[0].excerpt.includes('공황'));});
test('조회 실패를 성공으로 표시하지 않음',async()=>{const r=await search('매매 건수',async()=>{throw Error();});assert.equal(r.status,'unavailable');assert.equal(r.sources.length,0);});
test('통계에 확정 수치 대신 한계 안내',async()=>{const r=await search('매매 건수',async url=>({url,title:'등기현황',text:'매매 건수는 조건별 조회가 필요합니다.',links:[]}));assert.ok(r.answer.includes('확정할 수 없습니다'));});
test('질문 길이 검증',async()=>{const r=await worker.fetch(new Request('https://bot.example/api/ask',{method:'POST',body:JSON.stringify({question:'가'.repeat(501)})}),{});assert.equal(r.status,400);});
