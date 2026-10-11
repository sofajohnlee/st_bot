// Only endpoints and fields verified against the official Registry Plaza charts.
const BASE='https://data.iros.go.kr';
const GRAPH='/cr/dv/selectRgsCrDvGraph1.do';
const MAP='/rMate/rMateMapChartH5Web/rMateMapChartH5/MapDataBaseXml/SouthKoreaDrillDownSeoulDong12Gu_modify.xml?ver=20260702';
const PROPERTIES=[['m1_work1','집합건물'],['m2_work1','토지'],['m3_work1','일반건물']];
export class QueryError extends Error {}
export function isStatistics(q) {
 return /(소유권|매매|저당|경매|공매|부동산등기)/.test(q) && /(\d{4}|\d+\s*월|건|수치|통계|현황|추이|몇|얼마|기간|분기|올해|작년|지난|최근|월별|지역별|시도별|비교|대비)/.test(q);
}
function ym(year,month){if(year<2010||year>2100||month<1||month>12)throw new QueryError('조회 기간은 2010년 이후의 유효한 연월로 입력해 주세요.');return String(year)+String(month).padStart(2,'0');}
function shift(month,n){const y=Number(month.slice(0,4)),m=Number(month.slice(4));const d=new Date(Date.UTC(y,m-1+n,1));return ym(d.getUTCFullYear(),d.getUTCMonth()+1);}
export function monthsBetween(start,end){const out=[];for(let m=start;m<=end;m=shift(m,1)){out.push(m);if(out.length>36)throw new QueryError('한 번에 최대 36개월까지 조회할 수 있습니다. 기간을 나누어 질문해 주세요.');}if(!out.length)throw new QueryError('시작월은 종료월보다 늦을 수 없습니다.');return out;}
export function parsePeriod(q,latest,now=new Date()) {
 const korea=new Date(now.getTime()+9*3600000),year=korea.getUTCFullYear();
 if(/\d+\s*일|일별/.test(q))throw new QueryError('현재 통계 조회는 월 단위입니다. 예: 2026년 9월');
 let start,end;let carryYear=year;
 const dates=[];
 const normalized=q.replace(/(\d{1,2})\s*[~～-]\s*(\d{1,2})\s*월/g,'$1월 ~ $2월').replace(/(20\d{2})[-./](\d{1,2})(?!\d)/g,'$1년 $2월');
 for(const m of normalized.matchAll(/(?:(20\d{2})\s*년\s*)?(\d{1,2})\s*월/g)){if(m[1])carryYear=Number(m[1]);dates.push(ym(carryYear,Number(m[2])));}
 const years=[...q.matchAll(/(20\d{2})\s*년/g)].map(m=>Number(m[1]));
 if(dates.length){start=dates[0];end=dates.at(-1);}
 else if(/지난달|전월/.test(q)&&!/대비|비교/.test(q)){start=end=shift(ym(year,korea.getUTCMonth()+1),-1);}
 else if(/이번\s*달|이달/.test(q)){start=end=ym(year,korea.getUTCMonth()+1);}
 else if(/최근\s*(\d+)\s*개월/.test(q)){const n=Number(q.match(/최근\s*(\d+)\s*개월/)[1]);if(n<1||n>36)throw new QueryError('최근 기간은 1~36개월로 입력해 주세요.');end=latest;start=shift(end,1-n);}
 else if(years.length||/올해|작년|금년|전년/.test(q)){
  const y=years[0]||(/작년|전년/.test(q)?year-1:year);const quarter=q.match(/([1-4])\s*분기/);
  if(quarter){const m=(Number(quarter[1])-1)*3+1;start=ym(y,m);end=ym(y,m+2);}
  else if(/상반기|하반기/.test(q)){start=ym(y,/하반기/.test(q)?7:1);end=ym(y,/하반기/.test(q)?12:6);}
  else {start=ym(y,1);end=ym(years.at(-1)||y,12);if(y===Number(latest.slice(0,4))&&end>latest)end=latest;}
 } else {start=end=latest;}
 monthsBetween(start,end);
 if(end>latest)throw new QueryError(`요청한 종료월은 아직 공표되지 않았습니다. 공식 최신 제공월은 ${labelMonth(latest)}입니다.`);
 return {start,end,months:monthsBetween(start,end)};
}
export function parseRegions(xml) {
 const stack=[],regions=[];
 for(const m of xml.matchAll(/<\/?(?:Province|Country|Gu|Dong)\b[^>]*>/g)){
  const tag=m[0];if(tag.startsWith('</')){stack.pop();continue;}
  const code=tag.match(/\bcode="([0-9]+)"/)?.[1];let name=tag.match(/\blabel="([^"]+)"/)?.[1];
  if(tag.startsWith('<Province'))name=({서울:'서울특별시',부산:'부산광역시',대구:'대구광역시',대전:'대전광역시',울산:'울산광역시',인천:'인천광역시',세종:'세종특별자치시'})[name]||name;
  if(!code||!name)throw new Error('Invalid official region map');
  const path=[...stack,{code,name}];regions.push({code,name,path});if(!tag.endsWith('/>'))stack.push({code,name});
 }
 if(!regions.some(r=>r.name==='서울특별시'))throw new Error('Region map unavailable');return regions;
}
const ALIASES={서울특별시:['서울','서울시'],부산광역시:['부산','부산시'],대구광역시:['대구','대구시'],대전광역시:['대전','대전시'],울산광역시:['울산','울산시'],인천광역시:['인천','인천시'],경기도:['경기'],강원특별자치도:['강원','강원도'],경상남도:['경남'],경상북도:['경북'],전북특별자치도:['전북','전라북도'],전남광주통합특별시:['전남광주'],충청남도:['충남'],충청북도:['충북'],제주특별자치도:['제주','제주도'],세종특별자치시:['세종','세종시']};
export function resolveRegions(q,catalog) {
 if(/수도권|호남|영남|충청권|경인지역/.test(q))throw new QueryError('권역 대신 공식 시·도 또는 시·군·구 이름을 지정해 주세요.');
 const matches=catalog.filter(r=>[r.name,...(ALIASES[r.name]||[]),...(r.path.length>1&&r.name.length>=3?[r.name.replace(/[시군구]$/,'')]:[])].some(a=>new RegExp('(?:^|[^가-힣])'+a+'(?=$|[^가-힣]|의|에서|과|와|는|은)').test(q)));
 const leaves=matches.filter(r=>!matches.some(other=>other.code!==r.code&&other.path.slice(0,-1).some(p=>p.code===r.code)));
 const result=[];
 for(const name of new Set(leaves.map(r=>r.name))){
  let candidates=leaves.filter(r=>r.name===name);
  const explicit=candidates.filter(r=>r.path.slice(0,-1).some(p=>matches.some(m=>m.code===p.code)));
  if(explicit.length)candidates=explicit;
  if(candidates.length!==1)throw new QueryError(`${name}의 상위 시·도를 함께 입력해 주세요.`);
  result.push(candidates[0]);
 }
 // Never broaden an unrecognized sub-region to its province or to nationwide.
 const known=result.flatMap(r=>r.path.map(p=>p.name));
 const residual=q.replace(/\(근\)저당권/g,'근저당권');
 const placeWords=residual.match(/[가-힣]+(?:특별시|광역시|자치도|통합특별시|시|군|구|읍|면|동)(?=\s|의|에서|과|와|,|$)/g)||[];
 for(const word of placeWords){if(!known.some(n=>n===word)&&!Object.values(ALIASES).flat().includes(word)&&!['신청건수','공매공고등기'].includes(word))throw new QueryError(`${word}의 지역을 명확하게 입력해 주세요. 공식 지역명과 시·군·구를 함께 사용해 주세요.`);}
 if(/광주|전남|전라남도/.test(q)&&!result.length)throw new QueryError('광주·전남은 행정구역 개편 전후의 지역 구분이 필요합니다. 공식 지역명을 입력해 주세요.');
 if(result.length>4)throw new QueryError('한 번에 최대 4개 지역까지 비교할 수 있습니다.');
 return result.length?result:[{name:'전국',code:'',path:[]}];
}
export function selectMetric(q,regional) {
 const property=regional||/부동산\s*(수|건수)|집합건물|일반건물|토지/.test(q);
 if(/경매|공매/.test(q)){
  const transfer=/소유권|매각|낙찰|매수/.test(q);
  if(!transfer&&property)throw new QueryError('경매개시결정·공매공고 신청은 현재 전국 신청 건수 조회를 지원합니다. 지역별 또는 부동산 수 조회는 “경매·공매에 의한 소유권이전”으로 구분해 주세요.');
  if(regional&&!transfer)throw new QueryError('지역별 경매·공매 통계는 “경매·공매에 의한 소유권이전 신청 부동산 수”를 조회할 수 있습니다. 경매개시결정·공매공고 신청 건수와 구분하여 질문해 주세요.');
  let fields;
  if(transfer&&property)fields=[['m1_work1','임의경매'],['m2_work1','강제경매'],['m3_work1','공매']];
  else if(transfer)fields=[['val','경매·공매 소유권이전']];
  else fields=[['m1_work1','임의경매'],['m2_work1','강제경매'],['m3_work1','공매공고']];
  if(/임의경매/.test(q))fields=fields.filter(f=>f[1]==='임의경매');
  else if(/강제경매/.test(q))fields=fields.filter(f=>f[1]==='강제경매');
  else if(/공매/.test(q)&&!/경매/.test(q))fields=fields.filter(f=>f[1].startsWith('공매'));
  else if(/경매/.test(q)&&!/공매/.test(q)&&fields.length>1)fields=fields.filter(f=>!f[1].startsWith('공매'));
  if(!fields.length)throw new QueryError('해당 세부 분류의 전국 신청 건수는 확인된 조회 방식에서 분리되지 않습니다. 신청 부동산 수로 질문해 주세요.');
  return {seq:6,chart:transfer?(property?'rdataseq6_areaChart2':'rdataseq6_columnChart'):'rdataseq6_areaChart',fields,title:transfer?'경매·공매에 의한 소유권이전등기':'경매개시결정·공매공고등기',property:transfer&&property};
 }
 if(/저당/.test(q)){
  if(property&&!/설정|말소/.test(q))throw new QueryError('지역별 (근)저당권 통계는 “설정” 또는 “말소”를 지정해 주세요.');
  const cancel=/말소/.test(q);
  return {seq:5,chart:property?'rdataseq5_area2dchart':'rdataseq5_areahart',changetyp:cancel?'b':'a',fields:property?PROPERTIES:/설정|말소/.test(q)?[[cancel?'m2_val':'m1_val',cancel?'말소':'설정']]:[['m1_val','설정'],['m2_val','말소']],title:`(근)저당권${property||/설정|말소/.test(q)?(cancel?'말소':'설정'):'설정·말소'}등기`,property};
 }
 if(/매매/.test(q))return {seq:4,chart:property?'chart2':'chart1',fields:property?PROPERTIES:[['val1_work1','매매']],title:'매매에 의한 소유권이전등기',property};
 if(/소유권/.test(q))return {seq:3,chart:property?'rdataseq3_lineChart':'rdataseq3_linechart1',fields:property?PROPERTIES:[['val','소유권이전']],title:'소유권이전등기',property};
 if(regional||property)throw new QueryError('부동산등기 전체 신청 건수는 현재 전국 조회를 지원합니다. 지역별로는 소유권이전·매매·근저당권설정/말소를 지정해 주세요.');
 return {seq:2,chart:'rdataseq2_linechart1',fields:[['val','부동산등기']],title:'부동산등기',property:false};
}
function labelMonth(m){return `${m.slice(0,4)}년 ${Number(m.slice(4))}월`;}
export function validateRows(data,months,fields) {
 if(!Array.isArray(data?.dataList))throw new Error('Invalid statistics response');
 const rows=[];
 for(const month of months){
  const found=data.dataList.filter(r=>String(r.crmm).replace(/-/g,'')===month);
  if(found.length!==1)throw new QueryError(`${labelMonth(month)}의 통계가 누락되었거나 중복되어 수치를 확정할 수 없습니다.`);
  const values=Object.fromEntries(fields.map(([key,name])=>{
   const raw=found[0][key];if(raw===null||raw===undefined||raw==='')throw new Error('Missing statistic');
   const num=typeof raw==='number'?raw:/^(?:\d+|\d{1,3}(?:,\d{3})+)$/.test(raw)?Number(raw.replace(/,/g,'')):NaN;
   if(!Number.isSafeInteger(num)||num<0)throw new Error('Invalid statistic');return [name,num];
  }));
  rows.push({month,values,total:Object.values(values).reduce((a,b)=>a+b,0)});
 }
 return rows;
}
export async function officialRequest(path,params={},text=false) {
 if(![GRAPH,'/cr/dv/getLastMonth.do',MAP].includes(path))throw new Error('Disallowed statistics endpoint');
 const cacheUrl=BASE+path+(text?'':('?'+new URLSearchParams(params)));
 const cache=globalThis.caches?.default;const hit=await cache?.match(cacheUrl);if(hit)return text?hit.text():hit.json();
 const r=await fetch(BASE+path,text?{signal:AbortSignal.timeout(10000)}:{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams(params),signal:AbortSignal.timeout(12000),redirect:'error'});
 if(!r.ok)throw new Error('Official statistics unavailable');
 const raw=await r.text();if(raw.length>1000000)throw new Error('Response too large');
 const value=text?raw:JSON.parse(raw);
 if(cache)await cache.put(cacheUrl,new Response(raw,{headers:{'Content-Type':text?'text/xml':'application/json','Cache-Control':'public,max-age=900'}}));
 return value;
}
export async function statistics(q,request=officialRequest,now=new Date()) {
 if(!isStatistics(q))return null;
 let seq=/경매|공매/.test(q)?6:/저당/.test(q)?5:/매매/.test(q)?4:/소유권/.test(q)?3:2;
 const source=BASE+`/cr/dv/selectCrDvDataInfograpDetl.do?rdata_seq=${seq}&ris_menu_seq=0000000016`;
 const base={source,sources:[],searchedAt:now.toISOString(),queryType:'공식 통계 조회',model:null,llmUsed:false};
 try {
  const [last,xml]=await Promise.all([request('/cr/dv/getLastMonth.do',{table_name:'tb_br301_st_l2'}),request(MAP,{},true)]);
  const latest=String(last?.ldate?.lastmonth||'').replace(/-/g,'');if(!/^20\d{2}(0[1-9]|1[0-2])$/.test(latest))throw new Error('Unknown latest month');
  const period=parsePeriod(q,latest,now),catalog=parseRegions(xml);
  let regions=resolveRegions(q,catalog);
  const allProvinces=/시도별|지역별|순위|상위|하위/.test(q)&&regions.every(r=>!r.code);
  if(allProvinces)regions=catalog.filter(r=>r.path.length===1);
  const regional=regions.some(r=>r.code);const metric=selectMetric(q,regional);
  if(/법인|아파트|오피스텔|주택|증여|상속|신탁|가등기|건물별/.test(q))throw new QueryError('현재 확인된 통계 조회 범위는 부동산등기 전체·소유권이전·매매·근저당권·경매/공매입니다. 세부 원인·용도 분류는 지원하지 않습니다.');
  if(/신청사건|신청\s*건수/.test(q)&&regional&&!/부동산/.test(q))throw new QueryError('지역별 공식 조회값은 신청 부동산 수입니다. 신청사건 건수와 다르므로 “신청 부동산 수”로 질문해 주세요.');
  if(metric.property&&metric.seq!==6){const selected=PROPERTIES.filter(f=>q.includes(f[1]));if(selected.length)metric.fields=selected;}
  const compare=/전월\s*(대비|비교)/.test(q)?-1:/전년\s*(동월|같은\s*달)|전년\s*대비/.test(q)?-12:0;
  if(compare&&period.months.length!==1)throw new QueryError('전월·전년동월 비교는 한 개 월을 지정해 주세요.');
  const comparisonMonth=compare?shift(period.end,compare):null;
  const requested=compare?[comparisonMonth,...period.months]:period.months;
  const fetchStart=compare?comparisonMonth:period.start;
  const loadRegion=async region=>{
   const path=region.path; if(path.length>3)throw new QueryError('현재 읍·면·동 상세 조회는 지원하지 않습니다. 시·군·구를 지정해 주세요.');
   const params={rdata_seq:String(metric.seq),charttype:metric.chart,search_start_date:fetchStart,search_end_date:period.end,regncd1:path[0]?.code||'',regncd2:path[1]?.code||'',regncd3:path[2]?.code||'',real_cls_cd:'All',...(metric.changetyp?{changetyp:metric.changetyp}:{})};
   const raw=await request(GRAPH,params);return {region:region.path.map(p=>p.name).join(' ')||'전국',rows:validateRows(raw,requested,metric.fields),request:params};
  };
  const results=[];
  for(let i=0;i<regions.length;i+=4)results.push(...await Promise.all(regions.slice(i,i+4).map(loadRegion)));
  if(allProvinces)results.sort((a,b)=>{const sum=r=>r.rows.filter(x=>period.months.includes(x.month)).reduce((n,x)=>n+x.total,0);return /하위/.test(q)?sum(a)-sum(b):sum(b)-sum(a);});
  const fmt=n=>n.toLocaleString('ko-KR');const unit=metric.property?'개 부동산':'건';
  let answer=`${metric.title} ${metric.property?'신청 부동산 수':'신청 건수'}\n조회 기간: ${labelMonth(period.start)}${period.start===period.end?'':' ~ '+labelMonth(period.end)}\n공식 최신 제공월: ${labelMonth(latest)}\n`;
  if(allProvinces)answer+='시도별 신청 부동산 수 순위 (공식 지역 코드 기준)\n';
  const limit=q.match(/(?:상위|하위)\s*(\d+)/)?.[1];
  const displayResults=allProvinces&&limit?results.slice(0,Math.min(Number(limit),results.length)):results;
  for(const result of displayResults){
   const rows=result.rows.filter(r=>period.months.includes(r.month));const total=rows.reduce((sum,r)=>sum+r.total,0);
   answer+=`\n${result.region}: ${fmt(total)}${unit}\n`;
   if(rows.length>1&&!allProvinces)answer+=rows.map(r=>`${labelMonth(r.month)}: ${fmt(r.total)}${unit}`).join('\n')+'\n';
   if(!allProvinces)for(const [,name] of metric.fields)answer+=`· ${name}: ${fmt(rows.reduce((sum,r)=>sum+r.values[name],0))}${unit}\n`;
   if(compare){const prev=result.rows.find(r=>r.month===comparisonMonth).total,diff=total-prev;answer+=`${labelMonth(comparisonMonth)} 대비: ${diff>=0?'+':''}${fmt(diff)}${unit}${prev?' ('+(diff/prev*100).toFixed(2)+'%)':' (비교 기준이 0이므로 증감률 산출 불가)'}\n`;}
   else if(/비교|증가|감소|증감/.test(q)&&rows.length>1){const first=rows[0].total,diff=rows.at(-1).total-first;answer+=`첫 월 대비 마지막 월: ${diff>=0?'+':''}${fmt(diff)}${unit}${first?' ('+(diff/first*100).toFixed(2)+'%)':' (기준값 0으로 증감률 산출 불가)'}\n`;}
  }
  if(results.length===2&&/비교|차이/.test(q)){const totals=results.map(r=>r.rows.filter(x=>period.months.includes(x.month)).reduce((sum,x)=>sum+x.total,0));answer+=`\n${results[0].region} − ${results[1].region}: ${fmt(totals[0]-totals[1])}${unit}\n`;}
  answer+='\n※ 월별 합계는 해당 기간의 신청량 합계입니다. 신청 부동산 수는 신청사건 건수와 다르며, 기간 내 고유 부동산 수를 뜻하지 않습니다. 조회 시점에 따라 공식 자료가 변경될 수 있습니다.';
  return {...base,status:'found',aiStatus:'statistics',answer,statistics:{metric:metric.title,unit,latest,period,results},sources:[{title:'등기정보광장 공식 통계',url:source,excerpt:`${metric.title} · ${metric.property?'신청 부동산 수':'신청 건수'} · ${labelMonth(period.start)} ~ ${labelMonth(period.end)}. 공식 화면의 JSON 응답을 조회하고 서버에서 합계를 계산하였습니다.`}]};
 } catch(e) {
  return {...base,status:e instanceof QueryError?'clarification_required':'unavailable',aiStatus:'statistics',answer:e instanceof QueryError?e.message:'공식 통계 조회에 실패하여 수치를 확인할 수 없습니다. 잠시 후 다시 시도해 주세요. 수치를 임의로 생성하지 않습니다.'};
 }
}
