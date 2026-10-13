export const CHAT_URL='https://www.iros.go.kr/chat/';
const CACHE_URL='https://registry-bot.internal/iros-chat-qa-v3';
const QUESTION_KEYS=['question','questionText','question_text','qstn','qstnCn','questionCn','query','faqQuestion','utterance'];
const ANSWER_KEYS=['answer','answerText','answer_text','ans','ansCn','answerCn','response','faqAnswer'];
const text=value=>typeof value==='string'?value.replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi,' ').replace(/<[^>]*>/g,' ').replace(/&nbsp;/g,' ').replace(/&amp;/g,'&').replace(/&#(\d+);/g,(_,n)=>String.fromCodePoint(Number(n))).replace(/\s+/g,' ').trim():'';
export function chatAsset(value,base=CHAT_URL){
 try{const u=new URL(value.replace(/&amp;/g,'&'),base);u.hash='';return u.origin===new URL(CHAT_URL).origin&&u.pathname.startsWith('/chat/')&&!u.username&&!u.password&&!/login|logout|delete|insert|update|download/i.test(u.pathname)&&(/\.(?:json|js|mjs|html?)$/i.test(u.pathname)||u.href===CHAT_URL)?u.href:null;}catch{return null;}
}
function pair(obj){
 if(!obj||typeof obj!=='object'||Array.isArray(obj))return null;
 const q=QUESTION_KEYS.map(k=>text(obj[k])).find(Boolean),a=ANSWER_KEYS.map(k=>text(obj[k])).find(Boolean);
 return q&&a&&q.length<=1000&&a.length<=16000?{question:q,answer:a}:null;
}
export function extractPairs(raw){
 const found=[];const seen=new Set();
 const add=item=>{if(item&&!seen.has(item.question+'\n'+item.answer)){seen.add(item.question+'\n'+item.answer);found.push(item);}};
 const walk=(obj,depth=0)=>{if(depth>12||found.length>=2000||!obj||typeof obj!=='object')return;add(pair(obj));for(const v of Object.values(obj))walk(v,depth+1);};
 try{walk(JSON.parse(raw));}catch{}
 // Read JSON script blocks without executing upstream JavaScript.
 for(const m of raw.matchAll(/<script\b[^>]*type=["']application\/(?:ld\+)?json["'][^>]*>([\s\S]*?)<\/script>/gi)){try{walk(JSON.parse(m[1]));}catch{}}
 // Schema.org public FAQ markup.
 for(const m of raw.matchAll(/\{[^{}]{1,24000}\}/g)){
  try{add(pair(JSON.parse(m[0])));}catch{}
  const object={};
  const keyPattern=new RegExp('(?:["\']?(?:'+[...QUESTION_KEYS,...ANSWER_KEYS].join('|')+')["\']?)\\s*:\\s*("(?:[^"\\\\]|\\\\.)*"|\'(?:[^\'\\\\]|\\\\.)*\')','g');
  for(const kv of m[0].matchAll(keyPattern)){
   const key=kv[0].slice(0,kv[0].indexOf(':')).trim().replace(/["']/g,'');
   try{object[key]=kv[1][0]==='"'?JSON.parse(kv[1]):kv[1].slice(1,-1).replace(/\\'/g,"'").replace(/\\n/g,'\n').replace(/\\t/g,' ');}catch{}
  }
  add(pair(object));
 }
 for(const m of raw.matchAll(/<dt\b[^>]*>([\s\S]*?)<\/dt>\s*<dd\b[^>]*>([\s\S]*?)<\/dd>/gi))add(pair({question:text(m[1]),answer:text(m[2])}));
 // FAQPage is nested rather than a flat question/answer object.
 try{const root=JSON.parse(raw);const nodes=Array.isArray(root)?root:[root];for(const n of nodes)for(const item of n.mainEntity||[])if(item['@type']==='Question')add(pair({question:item.name,answer:item.acceptedAnswer?.text}));}catch{}
 return found.slice(0,2000);
}
export function discoverAssets(raw,base=CHAT_URL){
 const values=[];
 for(const m of raw.matchAll(/(?:src|href)\s*=\s*["']([^"']+)["']/gi))values.push(m[1]);
 for(const m of raw.matchAll(/["']([^"'\s]+\.(?:json|js|mjs)(?:\?[^"'\s]*)?)["']/gi))values.push(m[1]);
 return [...new Set(values.map(v=>chatAsset(v,base)).filter(Boolean))];
}
async function readPublic(url){
 const r=await fetch(url,{signal:AbortSignal.timeout(7000),redirect:'manual',headers:{Accept:'text/html,application/json,text/javascript'}});
 if(!r.ok)throw new Error('http_'+r.status);
 const contentType=r.headers.get('Content-Type')||'';
 if(!/html|json|javascript|text\/plain/i.test(contentType))throw new Error('unsupported_content');
 if(Number(r.headers.get('Content-Length'))>1500000)throw new Error('too_large');
 const raw=await r.text();if(raw.length>1500000)throw new Error('too_large');
 if(/<title[^>]*>\s*(?:502|403)|access denied|request rejected|서비스 점검중/i.test(raw))throw new Error('unavailable_page');
 return raw;
}
export async function collectChat(load=readPublic){
 const queue=[CHAT_URL],visited=new Set(),items=[],errors=[],integrationHints=[];
 // Root plus at most six referenced assets, two bounded discovery rounds.
 for(let round=0;round<3&&queue.length&&visited.size<7;round++){
  const batch=queue.splice(0,Math.min(3,7-visited.size)).filter(u=>!visited.has(u));batch.forEach(u=>visited.add(u));
  const results=await Promise.allSettled(batch.map(load));
  for(let i=0;i<results.length;i++){
   const r=results[i],url=batch[i];if(r.status!=='fulfilled'){errors.push({url,reason:String(r.reason?.message||'unavailable')});continue;}
   if(/\.js(?:\?|$)/.test(url)){
    const handler=r.value.indexOf('function mr(');if(handler>=0)integrationHints.push({url,snippet:r.value.slice(handler,handler+9000)});
    for(const m of r.value.matchAll(/(?:\.(?:post|get)\(\s*["']|baseURL\s*:|["'][^"'\n]{0,100}(?:faq|qna|chatbot|intent|answer)[^"'\n]{0,100}["'])/gi)){
     const snippet=r.value.slice(Math.max(0,m.index-100),m.index+400);
     if(integrationHints.length<24&&!integrationHints.some(x=>x.snippet===snippet))integrationHints.push({url,snippet});
    }
   }
   for(const item of extractPairs(r.value))if(!items.some(x=>x.question===item.question&&x.answer===item.answer))items.push({...item,assetUrl:url});
   queue.push(...discoverAssets(r.value,url).filter(u=>!visited.has(u)&&!queue.includes(u)));
  }
 }
 return {status:items.length?'ready':errors.some(e=>e.url===CHAT_URL)?'unavailable':'no_public_qa',items:items.slice(0,2000),checkedAt:new Date().toISOString(),source:CHAT_URL,assets:[...visited],errors,integrationHints};
}
export async function chatKnowledge(load=readPublic){
 const cache=globalThis.caches?.default;
 if(load===readPublic){const hit=await cache?.match(CACHE_URL);if(hit)return hit.json();}
 const data=await collectChat(load);
 if(load===readPublic&&cache)await cache.put(CACHE_URL,new Response(JSON.stringify(data),{headers:{'Content-Type':'application/json','Cache-Control':`public,max-age=${data.status==='ready'?3600:300}`}}));
 return data;
}
function terms(s){const words=s.toLowerCase().match(/[가-힣a-z0-9]{2,}/g)||[];return [...new Set(words.flatMap(w=>[w,...Array.from({length:w.length-1},(_,i)=>w.slice(i,i+2))]))];}
export function relevantPairs(q,items){
 const t=terms(q),topic=['매매','상속','증여','근저당','법인','열람','발급'].filter(w=>q.includes(w));
 return items.map(item=>{const title=item.question.toLowerCase(),body=item.answer.toLowerCase();const rank=t.reduce((n,w)=>n+(title.includes(w)?w.length*3:body.includes(w)?w.length:0),0);return {...item,rank};}).filter(x=>x.rank>=8&&(!topic.length||topic.some(w=>(x.question+x.answer).includes(w)))).sort((a,b)=>b.rank-a.rank).slice(0,3);
}
export async function searchChat(q,load=readPublic){
 const data=await chatKnowledge(load),matches=relevantPairs(q,data.items);
 return {sources:matches.map(item=>({title:'인터넷등기소 등기절차 안내봇 · '+item.question,url:CHAT_URL,assetUrl:item.assetUrl,question:item.question,excerpt:'질문: '+item.question+'\n답변: '+item.answer,checkedAt:data.checkedAt,sourceType:'공식 등기절차 안내봇 질문·답변'})),chatStatus:{status:data.status,questionCount:data.items.length,matchedCount:matches.length,checkedAt:data.checkedAt,source:CHAT_URL}};
}
export async function chatStatus(){const data=await chatKnowledge();return {status:data.status,questionCount:data.items.length,checkedAt:data.checkedAt,source:CHAT_URL,assets:data.assets,errors:data.errors,integrationHints:data.integrationHints};}
