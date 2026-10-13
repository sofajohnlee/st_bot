// Public official sources only; no authenticated service or private registration data.
export const OFFICIAL_ORIGINS = new Set(['https://data.iros.go.kr','https://www.iros.go.kr','https://www.easylaw.go.kr','https://easylaw.go.kr','https://www.law.go.kr','https://law.go.kr','https://glaw.scourt.go.kr']);
export function safeSource(value, base='https://www.iros.go.kr/') {
 try {const u=new URL(value.replace(/&amp;/g,'&'),base);return OFFICIAL_ORIGINS.has(u.origin)&&!u.username&&!u.password&&!/logout|login|download|delete|insert|update|fileDown|flDownload/i.test(u.pathname)?u.href:null;}catch{return null;}
}
const easy=(ccf,cci,cls)=>`https://www.easylaw.go.kr/CSP/CnpClsMain.laf?csmSeq=566&ccfNo=${ccf}&cciNo=${cci}&cnpClsNo=${cls}&popMenu=ov`;
const law=(name)=>'https://www.law.go.kr/법령/'+name;
export const GUIDES = [
 {title:'인터넷등기소 이용·열람·발급·고객센터',url:'https://www.iros.go.kr/',tags:'인터넷등기소 모바일 열람 발급 증명서 결제 수수료 오류 인증 프로그램 로그인 전자신청 전자표준양식 이폼 e-form 서비스 이용시간 양식'},
 {title:'부동산등기의 신청과 절차',url:easy(1,2,1),tags:'등기절차 등기신청 신청인 공동신청 단독신청 접수 조사 보정 각하 교합 등기부 갑구 을구 표제부 열람 발급 법령 규정'},
 {title:'매매 소유권이전등기 신청절차',url:easy(3,1,5),tags:'매매 소유권 이전 신청 절차 방문 전자신청'},
 {title:'매매 소유권이전등기 제출서류',url:easy(3,1,3),tags:'매매 소유권 이전 제출서류 준비서류 첨부 서류 신청'},
 {title:'증여 소유권이전등기 신청절차',url:easy(3,2,4),tags:'증여 소유권 이전 신청 절차'},
 {title:'상속 소유권이전등기 제출서류',url:easy(3,3,2),tags:'상속 소유권 이전 제출서류 준비서류 첨부 서류'},
 {title:'상속 소유권이전등기 신청절차',url:easy(3,3,4),tags:'상속 소유권 이전 신청 절차 단독'},
 {title:'근저당권 설정등기 제출서류',url:easy(4,2,2),tags:'근저당권 설정 제출서류 첨부 준비 서류'},
 {title:'근저당권 설정등기 신청서 작성',url:easy(4,2,3),tags:'근저당권 설정 신청서 작성 위임장'},
 {title:'부동산등기법',url:law('부동산등기법'),tags:'법률 법령 규정 부동산등기법 신청인 공동신청 단독신청 방문 전자신청'},
 {title:'부동산등기규칙',url:law('부동산등기규칙'),tags:'규칙 법령 규정 부동산등기규칙 신청정보 첨부정보'},
 {title:'상업등기법',url:law('상업등기법'),tags:'법인 상업 회사 법률 법령 규정'},
 {title:'상업등기규칙',url:law('상업등기규칙'),tags:'법인 상업 회사 규칙 법령 규정'},
 {title:'부동산등기법 제19조 · 시행 2025.1.31. 본문',url:'https://www.law.go.kr/lsLinkCommonInfo.do?chrClsCd=010202&lsJoLnkSeq=1026156537',tags:'열람 발급 증명서 부속서류 수수료 19조'},
 {title:'부동산등기법 제23조 · 시행 2025.1.31. 본문',url:'https://www.law.go.kr/LSW/lsSideInfoP.do?docCls=jo&joBrNo=00&joNo=0023&lsiSeq=265377&urlMode=lsScJoRltInfoR',tags:'신청인 공동신청 단독신청 상속 판결 신탁 23조'},
 {title:'부동산등기법 제24조 · 시행 2025.1.31. 본문',url:'https://www.law.go.kr/lsLinkCommonInfo.do?chrClsCd=010202&lsJoLnkSeq=1027009601',tags:'방문 전자신청 신청방법 모바일 24조'}
];
export function guidanceDomain(q) {
 if(/법령|규정|규칙|예규|선례|법적|법률|근거|제\s*\d+\s*조/.test(q))return '등기 관련 규정 안내';
 if(/등기정보광장|등기지수|데이터셋|Open\s*API|오픈\s*API/i.test(q))return null;
 if(/인터넷등기소|열람|발급|증명서|로그인|인증|결제|오류|프로그램|이용시간|전자표준양식|이폼|e-form|모바일/i.test(q))return '인터넷등기소 이용 안내';
 if(/등기|소유권|저당|상속|증여|신탁|가등기/.test(q))return '등기절차 안내';
 return null;
}
function rank(q,guide) {
 const terms=[...new Set(q.match(/[가-힣a-z0-9]+/gi)||[])];
 if(/상업|법인|회사/.test(guide.tags)&&!/상업|법인|회사/.test(q)&&guide.url.includes("/법령/"))return -1;
 let n=terms.reduce((sum,t)=>sum+(guide.tags.includes(t)?t.length:0),0);
 for(const t of ['매매','증여','상속','근저당','상업','법인'])if(q.includes(t)&&guide.tags.includes(t))n+=15;
 if(/서류/.test(q)&&guide.tags.includes('서류'))n+=20;
 if(/규정|법령|규칙|근거|제\s*\d+\s*조/.test(q)&&guide.url.includes('law.go.kr/')&&!guide.url.includes('easylaw'))n+=12;
 if(/인터넷등기소/.test(q)&&guide.url==='https://www.iros.go.kr/')n+=25;
 const article=q.match(/제\s*(\d+)\s*조/)?.[1];if(article&&guide.title.includes("제"+article+"조"))n+=100;
 return n;
}
export function guidanceSeeds(q) {
 const sorted=GUIDES.map(g=>({...g,rank:rank(q,g)})).sort((a,b)=>b.rank-a.rank);
 const selected=sorted.filter(g=>g.rank>0).slice(0,4);
 if(!selected.length)selected.push(GUIDES[1]);
 return selected;
}
export async function searchGuidance(q,load) {
 const domain=guidanceDomain(q),seeds=guidanceSeeds(q);
 const results=await Promise.allSettled(seeds.map(g=>load(g.url)));
 const pages=results.filter(r=>r.status==='fulfilled').map(r=>r.value);
 // Related official article links can supply the law text behind an explanatory page.
 const extra=[...new Set(pages.flatMap(p=>p.links||[]).filter(l=>/법|규칙|등기|신청|서류/.test(l.title)).map(l=>safeSource(l.url)).filter(Boolean))].filter(u=>!seeds.some(s=>s.url===u)).slice(0,3);
 const more=await Promise.allSettled(extra.map(load));pages.push(...more.filter(r=>r.status==='fulfilled').map(r=>r.value));
 const sources=[];
 for(const p of pages){
  if(!safeSource(p.url)||!p.text)continue;
  // Reject menu-only legal pages: a title is not statutory evidence.
  if(/(^|\.)law\.go\.kr$/.test(new URL(p.url).hostname)&&!/제\s*\d+\s*조\s*\(/.test(p.text))continue;
  const terms=[...new Set(q.match(/[가-힣a-z0-9]{2,}/gi)||[])];
  const article=q.match(/제\s*(\d+)\s*조/)?.[1];
  const chunks=Array.from({length:Math.ceil(p.text.length/1300)},(_,i)=>p.text.slice(i*1300,i*1300+1900));
  const best=chunks.map(text=>({text,rank:terms.reduce((n,t)=>n+(text.includes(t)?t.length:0),0)+(article&&new RegExp('제\\s*'+article+'\\s*조').test(text)?100:0)})).sort((a,b)=>b.rank-a.rank);
  const excerpt=best.slice(0,3).map(c=>c.text).join('\n');
  sources.push({title:p.title||seeds.find(g=>g.url===p.url)?.title||'공식 등기 안내',url:p.url,excerpt,checkedAt:p.checkedAt,sourceType:p.url.includes('easylaw.go.kr')?'법제처 생활법령 해설':p.url.includes('law.go.kr')?'법령 원문':'법원 공식 안내',effectiveDate:p.text.match(/\[시행\s*([^\]]+)\]/)?.[1]||null});
  if(sources.length===5)break;
 }
 return {queryType:domain,sources,source:seeds[0].url,guideLinks:seeds.map(({title,url})=>({title,url})),status:sources.length?'found':'unavailable',searchedAt:new Date().toISOString(),answer:sources.length?'공식 안내 자료를 확인했습니다. 아래 출처에서 해당 내용을 확인해 주세요.':'공식 자료의 본문을 읽지 못해 상세 내용을 확인할 수 없습니다. 아래 공식 안내 링크에서 확인해 주세요.'};
}
