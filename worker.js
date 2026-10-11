const IROS_BASE = 'https://data.iros.go.kr';
const MENU_SEQ = '0000000016';

// Data-visualization categories exposed by the Registry Information Plaza.
const DATASETS = [
  {seq:1,name:'부동산등기 기록 현황',words:['등기기록','기록 현황']},
  {seq:2,name:'부동산등기 신청 현황',words:['등기 신청','신청 현황']},
  {seq:3,name:'소유권이전등기 신청 현황',words:['소유권이전','소유권 이전']},
  {seq:4,name:'매매에 의한 소유권이전등기 신청 현황',words:['매매']},
  {seq:5,name:'(근)저당권등기 신청 현황',words:['근저당','저당권','저당']},
  {seq:6,name:'경매/공매등기 신청 현황',words:['경매','공매']},
  {seq:7,name:'상법법인등기 신청 현황',words:['법인등기 신청','법인 신청']},
  {seq:8,name:'상법법인등기 기록 현황',words:['법인등기 기록','법인 기록']},
  {seq:9,name:'특별조치법에 의한 등기신청 현황',words:['특별조치법']},
  {seq:10,name:'부기등기 신청 및 등기기록 현황',words:['부기등기']}
];

export default { async fetch(request) {
  const headers={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'Content-Type','Access-Control-Allow-Methods':'POST, OPTIONS','Content-Type':'application/json; charset=utf-8'};
  if(request.method==='OPTIONS') return new Response('',{headers});
  if(request.method!=='POST') return json({error:'POST only'},405,headers);
  const url=new URL(request.url);
  if(url.pathname!=='/api/ask') return json({error:'Not found'},404,headers);
  let body; try{body=await request.json()}catch{return json({error:'Invalid JSON'},400,headers)}
  const q=String(body.question||'').trim(); if(!q)return json({error:'question is required'},400,headers);

  if(/(open\s*api|오픈\s*api|api|데이터\s*다운로드|공개데이터)/i.test(q)) return json({
    answer:'등기정보광장 Open API는 회원가입·로그인 후 Open API 신청, 승인, 인증키 발급 등의 절차를 거쳐 이용합니다. 인증키는 브라우저에 노출하지 않고 서버에서 관리해야 합니다.',
    source:`${IROS_BASE}/rp/oa/openOapiIntro.do`},200,headers);

  if(isStatistics(q)){
    const d=selectDataset(q), p=period(q), result=await fetchDataset(d,p);
    if(result)return json(result,200,headers);
    return json({answer:`${d.name} 질문으로 분류했습니다. 공식 데이터 페이지를 조회했지만 상세 수치를 안정적으로 추출하지 못했습니다. 숫자를 임의로 생성하지 않습니다.`,source:datasetUrl(d,p),queryType:d.name,dataDate:p.label},200,headers);
  }
  return json({answer:'등기정보광장은 부동산등기·법인등기의 기록 및 신청 현황, 데이터 시각화, 공개데이터, Open API 등을 제공합니다. 통계 질문은 해당 공식 데이터셋을 조회하도록 구성되어 있습니다.',source:IROS_BASE},200,headers);
}};

function isStatistics(q){return /(몇\s*건|건수|현황|통계|추이|비율|증가|감소|지역별|월별|연도별|순위|상위|비교)/.test(q)||( /(경매|공매|저당|근저당|소유권|매매|법인등기|부기등기|특별조치법)/.test(q) && /(몇|건|현황|통계|추이|얼마|비교)/.test(q));}
function selectDataset(q){for(const d of DATASETS)if(d.words.some(w=>q.includes(w)))return d;return DATASETS[1];}
function period(q){let m=q.match(/(20\d{2})\s*년\s*(0?[1-9]|1[0-2])\s*월/);if(!m)m=q.match(/(20\d{2})[-./](0?[1-9]|1[0-2])/);if(m)return{year:m[1],month:m[2].padStart(2,'0'),label:`${m[1]}년 ${m[2]}월`};m=q.match(/(20\d{2})\s*년/);if(m)return{year:m[1],month:null,label:`${m[1]}년`};return{year:null,month:null,label:'최신 조회'};}
function datasetUrl(d,p){const y=p.year||new Date().getFullYear();const m=p.month||(p.year?'12':String(new Date().getMonth()+1).padStart(2,'0'));return`${IROS_BASE}/cr/dv/selectCrDvDataInfograpDetl.do?rdata_seq=${d.seq}&ris_menu_seq=${MENU_SEQ}&search_end_date=${y}${m}&search_start_date=${y}${m}`;}
async function fetchDataset(d,p){const u=datasetUrl(d,p);try{const r=await fetch(u,{headers:{'User-Agent':'st_bot-registry-information-assistant/1.0'}});if(!r.ok)return null;const t=clean(await r.text());if(t.length<300)return null;const facts=[];for(const re of [/임의경매\s*([0-9,]+)/,/강제경매\s*([0-9,]+)/,/공매공고\s*([0-9,]+)/,/개인\s*([0-9,]+)/,/법인\s*([0-9,]+)/]){const m=t.match(re);if(m)facts.push(m[0].replace(/\s+/g,' '));}
  const h=headline(t,p);if(!h&&!facts.length)return null;let a=`${p.label} ${d.name}을(를) 공식 등기정보광장에서 조회했습니다.`;if(h)a+=`\n\n${h}`;if(facts.length)a+=`\n\n확인된 세부 항목: ${facts.join(', ')}`;a+='\n\n※ 조회 시점에 따라 일부 데이터가 변경될 수 있습니다.';return{answer:a,source:u,dataDate:p.label,queryType:d.name};}catch{return null;}}
function headline(t,p){if(!p.month)return null;const re=new RegExp(`${esc(`${p.year}년 ${Number(p.month)}월`)}[^.]{0,180}?(\\d[\\d,]*)\\s*건(?:입니다)?`);const m=t.match(re);return m?m[0]:null;}
function esc(s){return s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');}
function clean(h){return h.replace(/<script[\s\S]*?<\/script>/gi,' ').replace(/<style[\s\S]*?<\/style>/gi,' ').replace(/<[^>]+>/g,' ').replace(/&nbsp;/gi,' ').replace(/&amp;/gi,'&').replace(/\s+/g,' ').trim();}
function json(v,s,h){return new Response(JSON.stringify(v),{status:s,headers:h});}
