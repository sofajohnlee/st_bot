const messages = document.getElementById('messages');
const input = document.getElementById('question');
const form = document.getElementById('questionForm');

// Set window.REGISTRY_BOT_API_BASE in index.html after deploying worker.js.
// Example: https://your-worker-name.your-subdomain.workers.dev
const API_BASE = window.REGISTRY_BOT_API_BASE || (location.hostname.endsWith('workers.dev') || location.hostname === 'localhost' || location.hostname === '127.0.0.1' ? location.origin : '');
let busy = false;
let conversationHistory = [];
function resetConversation() {
 conversationHistory=[];
 messages.replaceChildren();
 addMessage("새 대화를 시작합니다. 이전 질문과 답변은 참조하지 않습니다.");
}
document.getElementById("newConversation").addEventListener("click",()=>{if(!busy&&!pdfReading)resetConversation();});
let attachedDocument = null;
let pdfUrl = null;
let pdfReading = false;
const pdfStatus = document.getElementById('pdfStatus');
const fileInput = document.getElementById('pdfFile');
function clearPdf() {
 if(attachedDocument)resetConversation();
 attachedDocument=null;
 if(pdfUrl) URL.revokeObjectURL(pdfUrl);
 pdfUrl=null; fileInput.value='';
 document.getElementById('removePdf').hidden=true;
 pdfStatus.textContent='PDF 1개 · 최대 20MB / 300쪽';
}
document.getElementById('attachPdf').addEventListener('click',()=>fileInput.click());
document.getElementById('removePdf').addEventListener('click',clearPdf);
fileInput.addEventListener('change',async()=>{
 const file=fileInput.files[0]; if(!file || busy || pdfReading)return;
 clearPdf(); pdfReading=true;
 document.querySelectorAll('button').forEach(b=>b.disabled=true);
 pdfStatus.textContent='PDF 텍스트를 읽고 있습니다…';
 let task;
 try {
  if(!/\.pdf$/i.test(file.name)||file.size>20*1024*1024)throw new Error('20MB 이하의 PDF 파일을 선택해 주세요.');
  const local=location.hostname.endsWith('workers.dev')||location.hostname==='localhost'||location.hostname==='127.0.0.1';
  const base=local ? './vendor/' : 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/';
  const pdfjs=await import(local ? base+'pdf.mjs' : base+'build/pdf.mjs');
  pdfjs.GlobalWorkerOptions.workerSrc=base+(local?'pdf.worker.mjs':'build/pdf.worker.mjs');
  task=pdfjs.getDocument({data:new Uint8Array(await file.arrayBuffer()),isEvalSupported:false,cMapUrl:base+'cmaps/',cMapPacked:true,standardFontDataUrl:base+'standard_fonts/'});
  task.onPassword=()=>task.destroy();
  const pdf=await task.promise;
  if(pdf.numPages>300)throw new Error('최대 300쪽까지 지원합니다. PDF를 나누어 첨부해 주세요.');
  const pages=[]; let total=0;
  for(let number=1;number<=pdf.numPages;number++) {
   const page=await pdf.getPage(number);const content=await page.getTextContent();
   const text=content.items.map(item=>(item.str||'')+(item.hasEOL?'\n':' ')).join('').trim();
   total+=text.length;if(total>600000)throw new Error('PDF 텍스트는 최대 60만 자까지 지원합니다. 문서를 나누어 주세요.');
   pages.push({number,text});page.cleanup();pdfStatus.textContent=`PDF 읽기: ${number} / ${pdf.numPages}쪽`;
  }
  if(!pages.some(p=>p.text))throw new Error('텍스트가 없는 스캔 PDF입니다. OCR 처리 후 첨부해 주세요.');
  resetConversation();
  attachedDocument={name:file.name.slice(0,200),pages};pdfUrl=URL.createObjectURL(file);
  pdfStatus.textContent=`${file.name} · ${pages.length}쪽 · 문서 질문 가능`;
  document.getElementById('removePdf').hidden=false;
 }catch(e){clearPdf();pdfStatus.textContent=e.message||'PDF를 읽지 못했습니다. 암호와 파일 상태를 확인해 주세요.';}
 finally{if(task)await task.destroy().catch(()=>{});pdfReading=false;document.querySelectorAll('button').forEach(b=>b.disabled=false);}
});

function addMessage(text, who = 'bot', meta = '', sourceUrl = '') {
  const row = document.createElement('div');
  row.className = `message ${who}`;
  row.innerHTML = `<div class="avatar">${who === 'bot' ? 'AI' : 'YOU'}</div><div class="bubble"></div>`;
  const bubble = row.querySelector('.bubble');
  bubble.textContent = text;
  if (meta || sourceUrl) {
    const small = document.createElement('div');
    small.className = 'meta';
    if (meta) small.textContent = meta;
    if (sourceUrl) {
      if (meta) small.appendChild(document.createTextNode(' · '));
      const link = document.createElement('a');
      link.href = sourceUrl;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.textContent = '공식 출처 열기 ↗';
      link.className = 'source-link';
      small.appendChild(link);
    }
    bubble.appendChild(small);
  }
  messages.appendChild(row);
  messages.scrollTop = messages.scrollHeight;
  return bubble;
}

async function askBackend(q) {
  if (!API_BASE) return null;
  const response = await fetch(`${API_BASE.replace(/\/$/, '')}/api/ask`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ question: q, history: conversationHistory, ...(attachedDocument ? {document:attachedDocument} : {}) }),
    signal: AbortSignal.timeout(90000)
  });
  if (!response.ok) {const result=await response.json().catch(()=>({}));throw new Error(result.error || `HTTP ${response.status}`);}
  return response.json();
}

async function handleQuestion(q) {
  if (busy || pdfReading) return;
  if (q.length > 500) { addMessage('질문은 500자 이내로 입력해 주세요.'); return; }
  busy = true;
  document.querySelectorAll('button').forEach(b => b.disabled = true);
  addMessage(q+(attachedDocument ? `\n📎 ${attachedDocument.name}` : ''), 'user'); input.value = '';
  addMessage(attachedDocument ? '첨부 PDF에서 근거를 찾아 답변을 작성 중입니다…' : '질문을 분석하고 공식 자료로 답변을 작성 중입니다…');
  const loading = messages.lastElementChild;
  try {
    const result = await askBackend(q);
    loading.remove();
    if (!result) {
      addMessage('검색 서버가 아직 연결되지 않았습니다. 저장소 README의 배포 안내를 따라 Worker를 배포한 후 해당 주소에서 이용해 주세요.', 'bot', '서버 연결 필요', 'https://data.iros.go.kr/');
      return;
    }
    if(result.status !== 'unavailable' && result.status !== 'clarification_required' && result.aiStatus !== 'unavailable' && result.aiStatus !== 'not_configured') {
      conversationHistory.push({role:'user',content:q},{role:'assistant',content:result.answer.slice(0,4000)});
      while(conversationHistory.length>12 || conversationHistory.reduce((sum,m)=>sum+m.content.length,0)>18000)conversationHistory.splice(0,2);
    }
    const mode = result.answerMode === 'fixed' ? '등록된 안내문' : result.queryType === '첨부 PDF 질의' ? (result.llmUsed ? '첨부 PDF · AI 답변' : '첨부 PDF · AI 답변 미사용') : result.queryType === '공식 통계 조회' ? '공식 통계 조회 · 서버 수치 검증' : result.llmUsed ? 'Llama 3.3 70B · AI 답변' : '원문 검색 · AI 답변 미사용';
    const meta = (result.queryType && !["첨부 PDF 질의","공식 통계 조회","공식 공개 페이지 검색"].includes(result.queryType) ? result.queryType+" · " : "") + mode + (result.searchedAt ? ` · 조회 시각: ${new Date(result.searchedAt).toLocaleString('ko-KR')}` : '');
    const bubble = addMessage(result.answer, 'bot', meta, (result.sources || []).length ? '' : result.source);
    const sourceList = document.createElement('div');
    sourceList.className = 'meta source-list';
    sourceList.setAttribute('aria-label', '답변 출처');
    for (const [index, source] of (result.sources || []).entries()) {
      try { if (!['https://data.iros.go.kr','https://www.iros.go.kr','https://www.easylaw.go.kr','https://easylaw.go.kr','https://www.law.go.kr','https://law.go.kr','https://glaw.scourt.go.kr'].includes(new URL(source.url).origin)) continue; } catch { continue; }
      const link = document.createElement('a');
      link.href = source.url;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.className = 'source-link';
      link.textContent = `[${index + 1}] ${source.title || '공식 자료'}${source.effectiveDate ? ' · 시행 '+source.effectiveDate : ''} ↗`;
      sourceList.appendChild(link);
    }
    for(const source of result.guideLinks||[]) {
      try {if(!['https://www.iros.go.kr','https://www.easylaw.go.kr','https://www.law.go.kr','https://glaw.scourt.go.kr'].includes(new URL(source.url).origin))continue;}catch{continue;}
      const link=document.createElement('a');link.href=source.url;link.target='_blank';link.rel='noopener noreferrer';link.className='source-link';link.textContent='안내: '+source.title+' ↗';sourceList.appendChild(link);
    }
    if(result.queryType==='첨부 PDF 질의'  && pdfUrl) {
      const pages=[...new Set((result.documentSources||[]).map(s=>s.page))];
      for(const page of pages){const link=document.createElement('a');link.href=pdfUrl+'#page='+page;link.target='_blank';link.rel='noopener';link.className='source-link';link.textContent=`[PDF p.${page}]`;sourceList.appendChild(link);}
      const info=document.createElement('div');info.className='meta';info.textContent='관련 발췌를 기준으로 답변합니다. 페이지는 PDF 순서 기준이며 문서 전체 검토 결과가 아닙니다.';bubble.appendChild(info);
    }
    if(result.chatStatus){
      const status=document.createElement('div');status.className='meta';
      status.textContent=result.chatStatus.matchedCount ? `등기절차 안내봇 질문·답변 ${result.chatStatus.matchedCount}건 참고` : result.chatStatus.status==='ready' ? '등기절차 안내봇에서 일치하는 질문·답변을 찾지 못했습니다.' : '등기절차 안내봇 질문·답변을 확인하지 못해 다른 공식 자료를 참고했습니다.';
      bubble.appendChild(status);
    }
    if (sourceList.children.length) bubble.appendChild(sourceList);
  } catch (e) {
    loading.remove();
    addMessage(e.message || '서버에 연결하지 못했습니다. 잠시 후 다시 시도해 주세요.', 'bot', '조회 실패');
  } finally {
    busy = false;
    document.querySelectorAll('button').forEach(b => b.disabled = false);
    input.focus();
  }
}

form.addEventListener('submit', e => {
  e.preventDefault();
  const q = input.value.trim();
  if (q) handleQuestion(q);
});

document.querySelectorAll('.suggestions button').forEach(button => {
  button.addEventListener('click', () => handleQuestion(button.dataset.q));
});

