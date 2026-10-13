export const CHAT_URL='https://www.iros.go.kr/chat/';
const CACHE_URL='https://registry-bot.internal/iros-chat-qa-v5';
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
 for(const m of raw.matchAll(/["']([^"'\s]+\.json(?:\?[^"'\s]*)?)["']/gi))values.push(m[1]);
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
 const queue=[CHAT_URL],visited=new Set(),items=[],errors=[];let apiSchemaVerified=false;
 // Root plus at most six referenced assets, two bounded discovery rounds.
 for(let round=0;round<3&&queue.length&&visited.size<7;round++){
  const batch=queue.splice(0,Math.min(3,7-visited.size)).filter(u=>!visited.has(u));batch.forEach(u=>visited.add(u));
  const results=await Promise.allSettled(batch.map(load));
  for(let i=0;i<results.length;i++){
   const r=results[i],url=batch[i];if(r.status!=='fulfilled'){errors.push({url,reason:String(r.reason?.message||'unavailable')});continue;}
   if(/\.js(?:\?|$)/.test(url)&&r.value.includes('"/chat/dialogue"')&&r.value.includes('session_id:')&&r.value.includes('in_str:'))apiSchemaVerified=true;
   for(const item of extractPairs(r.value))if(!items.some(x=>x.question===item.question&&x.answer===item.answer))items.push({...item,assetUrl:url});
   queue.push(...discoverAssets(r.value,url).filter(u=>!visited.has(u)&&!queue.includes(u)));
  }
 }
 return {status:items.length?'ready':errors.some(e=>e.url===CHAT_URL)?'unavailable':'no_public_qa',items:items.slice(0,2000),checkedAt:new Date().toISOString(),source:CHAT_URL,assets:[...visited],errors,apiSchemaVerified};
}
// Request/response schema verified in main.818b0933.js on 2026-10-14.
export function parseDialogue(raw,question){
 const f=raw?.data?.result?.fulfillment||raw?.result?.fulfillment;
 if(!f||typeof f!=='object')throw new Error('invalid_dialogue_schema');
 const suggestions=[];
 for(const msg of f.messages||[])for(const item of msg.items||[]){const b=item.button;if(b?.action==='query'&&typeof b.value==='string'&&b.value.length<=300&&text(b.label))suggestions.push({question:text(b.label),value:b.value});}
 for(const item of f.suggest||[])if(typeof item.sentence==='string')suggestions.push({question:text(item.sentence),value:text(item.sentence)});
 const answer=(f.speech||[]).map(x=>text(x.text)).filter(Boolean).join('\n');
 const matched=f.response_status==='match';
 return {pair:matched&&answer&&!/서버로.*응답.*못|다시.*질문|이해하지.*못|죄송.*답변|찾지 못|질문.*선택|선택.*질문/.test(answer)?{question,answer,assetUrl:CHAT_URL+'dialogue'}:null,suggestions};
}
export async function dialogueFetch(payload){
 const r=await fetch(CHAT_URL+'dialogue',{method:'POST',headers:{'Content-Type':'application/json','Accept':'application/json','Referer':CHAT_URL},body:JSON.stringify(payload),signal:AbortSignal.timeout(6000),redirect:'manual'});
 if(!r.ok)throw new Error('dialogue_http_'+r.status);
 const raw=await r.text();if(raw.length>300000)throw new Error('dialogue_too_large');return JSON.parse(raw);
}
export async function getChatUserId(){
 const r=await fetch(CHAT_URL+'getIp',{signal:AbortSignal.timeout(6000),redirect:'manual'});if(!r.ok)throw new Error('getIp_http_'+r.status);
 const ip=(await r.text()).trim().replace(/^"|"$/g,'').replace(/::ffff:/g,'').split(',')[0];if(!/^[0-9a-f:.]{3,60}$/i.test(ip))throw new Error('invalid_getIp');return ip;
}
export async function collectDialogue(request=dialogueFetch,getUserId=getChatUserId){
 const user_id=await getUserId(),session_id='session_'+crypto.randomUUID(),items=[],errors=[];
 const queue=['자주하는 질문','매매에 의한 소유권이전등기 신청절차','상속등기 신청서류','근저당권 말소등기'];const visited=new Set();
 // Only general public prompts and public query buttons; never forward user chat or documents.
 while(queue.length&&visited.size<6){
  const question=queue.shift();if(visited.has(question))continue;visited.add(question);
  try {
   const response=await request({user_id,in_type:'query',in_str:question,session_id,channel_id:'pc',parameters:{latitude_y:'',longitude_x:'',position_status:'N'}});
   const result=parseDialogue(response,question);if(result.pair)items.push(result.pair);
   for(const suggestion of result.suggestions)if(!visited.has(suggestion.value)&&!queue.includes(suggestion.value))queue.push(suggestion.value);
  }catch(e){errors.push({url:CHAT_URL+'dialogue',reason:String(e.message)});break;}
 }
 return {items,errors};
}
export async function chatKnowledge(load=readPublic){
 const cache=globalThis.caches?.default;
 if(load===readPublic){const hit=await cache?.match(CACHE_URL);if(hit)return hit.json();}
 let data=await collectChat(load);
 if(load===readPublic&&data.apiSchemaVerified&&!data.items.length){
  try {const result=await collectDialogue();data={...data,items:result.items,status:result.items.length?'ready':result.errors.length?'unavailable':'no_public_qa',errors:[...data.errors,...result.errors],collectionMode:'official_dialogue_api'};}catch(e){data={...data,status:'unavailable',errors:[...data.errors,{url:CHAT_URL+'dialogue',reason:String(e.message)}],collectionMode:'official_dialogue_api'};}
 }
 if(load===readPublic&&cache)await cache.put(CACHE_URL,new Response(JSON.stringify(data),{headers:{'Content-Type':'application/json','Cache-Control':`public,max-age=${data.status==='ready'?3600:300}`}}));
 return data;
}
function terms(s){const words=s.toLowerCase().match(/[가-힣a-z0-9]{2,}/g)||[];return [...new Set(words.flatMap(w=>[w,...Array.from({length:w.length-1},(_,i)=>w.slice(i,i+2))]))];}
export function relevantPairs(q,items){
 const t=terms(q),topic=['매매','상속','증여','근저당','법인','열람','발급'].filter(w=>q.includes(w));
 return items.map(item=>{const title=item.question.toLowerCase(),body=item.answer.toLowerCase();const rank=t.reduce((n,w)=>n+(title.includes(w)?w.length*3:body.includes(w)?w.length:0),0);return {...item,rank};}).filter(x=>x.rank>=8&&(!topic.length||topic.some(w=>(x.question+x.answer).includes(w)))).sort((a,b)=>b.rank-a.rank).slice(0,3);
}
export function canonicalQuestion(q){
 const topics=[[/근저당.*말소|저당.*말소/,'근저당권 말소등기'],[/근저당|저당/,'근저당권 설정등기'],[/상속/,'상속등기'],[/증여/,'증여등기'],[/매매/,'매매 소유권이전등기'],[/소유권.*이전/,'소유권이전등기'],[/소유권.*보존/,'소유권보존등기'],[/전세권/,'전세권등기'],[/임차권/,'임차권등기'],[/신탁/,'신탁등기'],[/가등기/,'가등기'],[/임원|대표이사/,'임원변경등기'],[/본점|지점/,'본점이전등기'],[/법인|회사|상업/,'법인등기'],[/등기필/,'등기필정보'],[/전자신청/,'전자신청'],[/전자표준|이폼|e-form/i,'전자표준양식'],[/열람|발급|증명서/,'등기사항증명서 열람 발급']];
 return topics.find(([pattern])=>pattern.test(q))?.[1]||null;
}
export async function queryTopic(topic,request=dialogueFetch,getUserId=getChatUserId){
 const cache=globalThis.caches?.default,key='https://registry-bot.internal/iros-chat-topic-v1/'+encodeURIComponent(topic);
 if(request===dialogueFetch){const hit=await cache?.match(key);if(hit)return hit.json();}
 const result={items:[],errors:[]};
 try {
  const user_id=await getUserId(),session_id='session_'+crypto.randomUUID();
  const queue=[{question:topic,value:topic}],visited=new Set();
  while(queue.length&&visited.size<3){
   const current=queue.shift();if(visited.has(current.value))continue;visited.add(current.value);
   const raw=await request({user_id,in_type:'query',in_str:current.value,session_id,channel_id:'pc',parameters:{latitude_y:'',longitude_x:'',position_status:'N'}});
   const parsed=parseDialogue(raw,current.question);if(parsed.pair)result.items.push(parsed.pair);
   const ranked=parsed.suggestions.map(s=>({...s,rank:terms(topic).reduce((n,t)=>n+(s.question.includes(t)?t.length:0),0)})).sort((a,b)=>b.rank-a.rank);
   for(const s of ranked)if(!visited.has(s.value)&&!queue.some(x=>x.value===s.value))queue.push(s);
  }
 }catch(e){result.errors.push(String(e.message));}
 if(request===dialogueFetch&&cache)await cache.put(key,new Response(JSON.stringify(result),{headers:{'Content-Type':'application/json','Cache-Control':`public,max-age=${result.items.length?3600:300}`}}));
 return result;
}
export async function searchChat(q,load=readPublic){
 const data=await chatKnowledge(load),topic=canonicalQuestion(q);
 const specific=load===readPublic&&data.apiSchemaVerified&&topic?await queryTopic(topic):{items:[]};
 const pool=[...specific.items,...data.items];
 const unique=pool.filter((x,i)=>pool.findIndex(y=>y.question===x.question&&y.answer===x.answer)===i);
 const matches=relevantPairs(q,unique);
 return {sources:matches.map(item=>({title:'인터넷등기소 등기절차 안내봇 · '+item.question,url:CHAT_URL,assetUrl:item.assetUrl,question:item.question,excerpt:'질문: '+item.question+'\n답변: '+item.answer,checkedAt:data.checkedAt,sourceType:'공식 등기절차 안내봇 질문·답변'})),chatStatus:{status:data.status,questionCount:unique.length,matchedCount:matches.length,checkedAt:data.checkedAt,source:CHAT_URL}};
}
export async function chatStatus(){const data=await chatKnowledge();return {status:data.status,questionCount:data.items.length,checkedAt:data.checkedAt,source:CHAT_URL,collectionMode:data.collectionMode||"public_assets",assets:data.assets,errors:data.errors,apiSchemaVerified:data.apiSchemaVerified};}
