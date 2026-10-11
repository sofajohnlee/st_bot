import test from 'node:test';
import assert from 'node:assert/strict';
import {statistics,officialRequest,parsePeriod,parseRegions,resolveRegions,selectMetric,validateRows} from '../statistics.js';
const now=new Date('2026-10-12T00:00:00Z');
const xml='<Map><Province code="900" label="서울특별시"><Country code="901" label="강남구"/></Province><Province code="800" label="부산광역시"/><Province code="200" label="경기도"><Country code="212" label="성남시"><Gu code="2123" label="분당구"/></Country></Province></Map>';
function fixture(rows=[{crmm:'2026-09',m1_work1:10,m2_work1:20,m3_work1:30}]){const calls=[];return {calls,request:async(path,params)=>{calls.push({path,params});if(path.includes('getLastMonth'))return {ldate:{lastmonth:'2026-09'}};if(path.includes('xml'))return xml;return {dataList:rows};}};}
test('월 범위, 분기, 올해 공표월까지 해석',()=>{
 assert.deepEqual(parsePeriod('2026년 1~9월','202609',now).months,['202601','202602','202603','202604','202605','202606','202607','202608','202609']);
 assert.equal(parsePeriod('2026년 2분기','202609',now).start,'202604');
 assert.equal(parsePeriod('올해','202609',now).end,'202609');
 assert.throws(()=>parsePeriod('2026년 10월','202609',now));
 assert.throws(()=>parsePeriod('2026년 9월 10일','202609',now));
});
test('지역 계층과 축약명은 공식 코드를 적용',()=>{
 const catalog=parseRegions(xml);
 const r=resolveRegions('경기 성남 분당 매매',catalog);assert.equal(r.length,1);assert.deepEqual(r[0].path.map(p=>p.code),['200','212','2123']);
 assert.equal(resolveRegions('서울 강남 매매',catalog)[0].code,'901');
 assert.throws(()=>resolveRegions('서울 잠실동 매매',catalog));
});
test('지역 중복명은 상위 지역 없으면 조회하지 않음',()=>{
 const other=xml.replace('</Map>','<Province code="1100" label="인천광역시"><Country code="1101" label="강남구"/></Province></Map>');
 assert.throws(()=>resolveRegions('강남구',parseRegions(other)));
 assert.equal(resolveRegions('서울 강남구',parseRegions(other))[0].code,'901');
});
test('지표와 단위: 사건, 부동산, 경매개시와 경매소유권을 분리',()=>{
 assert.equal(selectMetric('매매',false).fields[0][0],'val1_work1');assert.equal(selectMetric('매매',true).property,true);
 assert.equal(selectMetric('경매·공매 소유권이전 부동산 수',true).chart,'rdataseq6_areaChart2');
 assert.equal(selectMetric('경매·공매 건수',false).chart,'rdataseq6_areaChart');
 assert.throws(()=>selectMetric('경매·공매',true));assert.throws(()=>selectMetric('근저당권',true));
});
test('누락/null/중복/음수 수치는 0으로 만들지 않음',()=>{
 for(const data of [{dataList:[]},{dataList:[{crmm:'2026-09',val:null}]},{dataList:[{crmm:'2026-09',val:-1}]},{dataList:[{crmm:'2026-09',val:1},{crmm:'2026-09',val:1}]}])assert.throws(()=>validateRows(data,['202609'],[['val','신청']]));
 assert.equal(validateRows({dataList:[{crmm:'2026-09',val:0}]},['202609'],[['val','신청']])[0].total,0);
});
test('실제 조건을 적용하고 수치 합계를 계산',async()=>{
 const f=fixture();const r=await statistics('서울 2026년 9월 매매 신청 부동산 수',f.request,now);
 assert.equal(r.status,'found');assert.equal(r.statistics.results[0].rows[0].total,60);assert.ok(r.answer.includes('60개 부동산'));
 const call=f.calls.find(c=>c.path.includes('selectRgs'));assert.equal(call.params.regncd1,'900');assert.equal(call.params.charttype,'chart2');
});
test('연월 범위 합계 및 전월대비 증감',async()=>{
 const f=fixture([{crmm:'2026-08',m1_work1:5,m2_work1:10,m3_work1:15},{crmm:'2026-09',m1_work1:10,m2_work1:20,m3_work1:30}]);
 const total=await statistics('서울 2026년 8~9월 매매 부동산 수',f.request,now);assert.ok(total.answer.includes('90개 부동산'));
 const compare=await statistics('서울 2026년 9월 매매 부동산 수 전월 대비',f.request,now);assert.ok(compare.answer.includes('+30개 부동산 (100.00%)'));assert.ok(compare.answer.includes('서울특별시: 60개 부동산'));
});
test('명시적 신청사건 건수는 부동산 수로 바꾸지 않음',async()=>{
 const f=fixture();const r=await statistics('서울 2026년 9월 매매 신청사건 건수',f.request,now);assert.equal(r.status,'clarification_required');assert.ok(!f.calls.some(c=>c.path.includes('selectRgs')));
});
test('시도별 순위는 각 공식 시도코드로 조회',async()=>{
 const f=fixture();const r=await statistics('2026년 9월 시도별 매매 부동산 수 상위 2개',f.request,now);
 assert.equal(r.status,'found');assert.equal(r.statistics.results.length,3);assert.equal(f.calls.filter(c=>c.path.includes('selectRgs')).length,3);
});
test('연계 장애는 실패로 표시하고 수치 생성 금지',async()=>{
 const r=await statistics('서울 2026년 9월 매매 부동산 수',async()=>{throw Error();},now);assert.equal(r.status,'unavailable');assert.equal(r.statistics,undefined);
});
test('공식 XML의 축약 시도명을 정규화하고 강남구를 남구로 오인하지 않음',()=>{
 const actual='<Map><Province code="900" label="서울"><Country code="901" label="강남구"/></Province><Province code="800" label="부산"><Country code="801" label="남구"/></Province><Province code="1000" label="울산"><Country code="1001" label="남구"/></Province></Map>';
 const r=resolveRegions('서울 강남구 매매',parseRegions(actual));assert.equal(r.length,1);assert.equal(r[0].code,'901');assert.equal(r[0].path[0].name,'서울특별시');
});

test('Workers에서 지원하는 redirect manual을 사용하고 리다이렉트를 성공 처리하지 않음',async()=>{
 const original=globalThis.fetch;
 try {
  globalThis.fetch=async(url,options)=>{assert.equal(options.redirect,'manual');return new Response('',{status:302});};
  await assert.rejects(()=>officialRequest('/cr/dv/selectRgsCrDvGraph1.do',{rdata_seq:'4'}),/upstream_http_302/);
 }finally{globalThis.fetch=original;}
});
