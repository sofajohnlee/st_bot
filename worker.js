const BASE = 'https://data.iros.go.kr';
const SEEDS = [BASE+'/', BASE+'/iu/no/openNotic.do?ris_menu_seq=0000000034', BASE+'/iu/rr/openMatrm.do?ris_menu_seq=0000000036', BASE+'/cr/rs/openRgsCs.do?ris_menu_seq=0000000022'];
export function officialUrl(value) { try { const u=new URL(value,BASE); return u.origin===BASE && !/logout|login|download|delete|insert|update/i.test(u.pathname) ? u.href : null; } catch { return null; } }
export function clean(html) {
 return html.replace(/<(script|style|nav|header|footer)\b[^>]*>[\s\S]*?<\/\1>/gi,' ').replace(/<[^>]+>/g,' ').replace(/&nbsp;|&#160;/g,' ').replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&#(\d+);/g,(_,n)=>String.fromCodePoint(Number(n))).replace(/\s+/g,' ').trim();
}
export function tokens(q) { const words=q.toLowerCase().match(/[가-힣a-z0-9]+/g)||[]; return [...new Set(words.flatMap(w=>w.length>2?[w,...Array.from({length:w.length-1},(_,i)=>w.slice(i,i+2))]:[w]))].filter(w=>w.length>1); }
export function score(text,terms) { return terms.reduce((n,t)=>n+(text.toLowerCase().includes(t)?t.length:0),0); }
async function page(url) {
 const cached=await caches.default.match(url); if(cached)return cached.json();
 const r=await fetch(url,{signal:AbortSignal.timeout(8000),redirect:'manual'});
 if(!r.ok || !/text\/html/i.test(r.headers.get('content-type')||''))throw new Error('unavailable');
 const bytes=await r.arrayBuffer(); if(bytes.byteLength>2000000)throw new Error('too large');
 let html=new TextDecoder().decode(bytes);
 const charset=(r.headers.get('content-type')||'').match(/charset=([^; ]+)/i)?.[1] || html.match(/charset\s*=\s*["']?([\w-]+)/i)?.[1];
 if(charset && /euc|ks_c|949/i.test(charset))html=new TextDecoder('euc-kr').decode(bytes);
 if(/access denied|request rejected|captcha/i.test(html))throw new Error('blocked');
 const main=html.match(/<main\b[^>]*>([\s\S]*?)<\/main>/i)?.[1] || html.match(/<body\b[^>]*>([\s\S]*?)<\/body>/i)?.[1] || html;
 const text=clean(main); if(text.length<200 || (text.match(/�/g)||[]).length>20)throw new Error('unreadable');
 const title=clean(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]||'등기정보광장');
 const links=[...html.matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)].map(m=>({url:officialUrl(m[1]),title:clean(m[2])})).filter(l=>l.url&&l.title&&l.url!==url);
 const result={url,title,text:text.slice(0,50000),links,checkedAt:new Date().toISOString()};
 await caches.default.put(url,new Response(JSON.stringify(result),{headers:{'Content-Type':'application/json','Cache-Control':'public, max-age=900'}}));return result;
}
export async function search(q,load=page) {
 const terms=tokens(q); const initial=await Promise.allSettled(SEEDS.map(load));
 const pages=initial.filter(r=>r.status==='fulfilled').map(r=>r.value);
 const visited=new Set(SEEDS); const candidates=pages.flatMap(p=>p.links).filter(l=>!visited.has(l.url)&&score(l.title,terms)>0).sort((a,b)=>score(b.title,terms)-score(a.title,terms));
 const extra=[];for(const l of candidates){if(!visited.has(l.url)){visited.add(l.url);extra.push(l.url);}if(extra.length===4)break;}
 const more=await Promise.allSettled(extra.map(load));pages.push(...more.filter(r=>r.status==='fulfilled').map(r=>r.value));
 const hits=pages.flatMap(p=>{const chunks=Array.from({length:Math.ceil(p.text.length/550)},(_,i)=>p.text.slice(i*550,i*550+750));return chunks.map(text=>({...p,text,rank:score(text,terms)}));}).filter(p=>p.rank>0).sort((a,b)=>b.rank-a.rank);
 const sources=[];for(const h of hits){if(!sources.some(s=>s.url===h.url))sources.push({title:h.title,url:h.url,excerpt:h.text,checkedAt:h.checkedAt});if(sources.length===3)break;}
 const numerical=/(몇|건수|통계|추이|비율|증가|감소|지역별|월별|연도별|순위|비교)/.test(q);
 return {answer:sources.length?'질문과 관련된 공식 페이지에서 다음 내용을 찾았습니다. 아래 원문 발췌와 출처를 확인해 주세요.'+(numerical?'\n\n지역·기간별 통계 수치는 이 검색 결과만으로 확정할 수 없습니다. 공식 통계 화면에서 조건을 지정해 조회해 주세요.':''):pages.length?'공개 페이지에서 질문과 일치하는 내용을 찾지 못했습니다. 검색어를 짧게 바꾸거나 공식 사이트에서 확인해 주세요.':'등기정보광장에 연결하지 못했거나 페이지 내용을 읽을 수 없습니다. 잠시 후 다시 시도하거나 공식 사이트에서 확인해 주세요.',sources,source:BASE+'/',status:sources.length?'found':pages.length?'no_results':'unavailable',queryType:'공식 공개 페이지 검색',searchedAt:new Date().toISOString()};
}
export default {async fetch(request,env){
 const url=new URL(request.url);
 const origin=request.headers.get('Origin');const allowed=origin===url.origin||origin==='https://sofajohnlee.github.io';
 const headers={'Content-Type':'application/json; charset=utf-8','Vary':'Origin',...(allowed?{'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Headers':'Content-Type','Access-Control-Allow-Methods':'POST, OPTIONS'}:{})};
 const reply=(body,status=200)=>new Response(JSON.stringify(body),{status,headers});
 if(url.pathname!=='/api/ask')return env.ASSETS.fetch(request);
 if(origin&&!allowed)return reply({error:'허용되지 않은 출처입니다.'},403);
 if(request.method==='OPTIONS')return new Response(null,{status:204,headers});
 if(request.method!=='POST')return reply({error:'POST 요청이 필요합니다.'},405);
 if(Number(request.headers.get('Content-Length'))>8000)return reply({error:'질문이 너무 깁니다.'},413);
 let body;try{const raw=await request.text();if(raw.length>8000)return reply({error:'질문이 너무 깁니다.'},413);body=JSON.parse(raw);}catch{return reply({error:'올바른 JSON이 필요합니다.'},400);}
 if(typeof body?.question!=='string'||!body.question.trim()||body.question.length>500)return reply({error:'질문을 1~500자로 입력해 주세요.'},400);
 try{return reply(await search(body.question.trim()));}catch{return reply({error:'검색 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.'},502);}
}};
