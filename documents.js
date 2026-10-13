// Text supplied by the browser is untrusted and never persisted or cached.
export function validateDocument(doc) {
 if (!doc || typeof doc.name !== 'string' || !doc.name.trim() || doc.name.length > 200 || !Array.isArray(doc.pages) || !doc.pages.length || doc.pages.length > 300) throw new Error('올바른 PDF 문서 정보가 필요합니다.');
 let total=0; const seen=new Set();
 for(const p of doc.pages) {
  if(!Number.isInteger(p.number)||p.number<1||p.number>300||seen.has(p.number)||typeof p.text!=='string')throw new Error('PDF 페이지 정보가 올바르지 않습니다.');
  seen.add(p.number);total+=p.text.length;
 }
 if(total>600000)throw new Error('PDF 텍스트는 최대 60만 자까지 지원합니다. 문서를 나누어 첨부해 주세요.');
 if(!doc.pages.some(p=>p.text.trim()))throw new Error('텍스트를 읽을 수 없습니다. 스캔 PDF는 OCR 처리 후 첨부해 주세요.');
 return doc;
}
export function documentContext(question, doc) {
 const terms=[...new Set(question.toLowerCase().match(/[가-힣a-z0-9]{2,}/g)||[])];
 const chunks=doc.pages.flatMap(p=>Array.from({length:Math.ceil(p.text.length/1200)},(_,i)=>({page:p.number,text:p.text.slice(i*1200,i*1200+1500)})));
 for(const c of chunks)c.rank=terms.reduce((n,t)=>n+(c.text.toLowerCase().includes(t)?t.length:0),0);
 // Include coverage across the document for summaries and broad questions.
 const selected=[]; const add=c=>{if(c&&!selected.includes(c))selected.push(c);};
 for(const c of [...chunks].sort((a,b)=>b.rank-a.rank).slice(0,8))add(c);
 for(let i=0;i<8;i++)add(chunks[Math.round(i*(chunks.length-1)/7)]);
 return selected.slice(0,16).sort((a,b)=>a.page-b.page).map(({page,text})=>({page,text}));
}
