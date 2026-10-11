const messages = document.getElementById('messages');
const input = document.getElementById('question');
const form = document.getElementById('questionForm');

// Set window.REGISTRY_BOT_API_BASE in index.html after deploying worker.js.
// Example: https://your-worker-name.your-subdomain.workers.dev
const API_BASE = window.REGISTRY_BOT_API_BASE || (location.hostname.endsWith('workers.dev') || location.hostname === 'localhost' || location.hostname === '127.0.0.1' ? location.origin : '');
let busy = false;

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
}

async function askBackend(q) {
  if (!API_BASE) return null;
  const response = await fetch(`${API_BASE.replace(/\/$/, '')}/api/ask`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ question: q }),
    signal: AbortSignal.timeout(90000)
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}

async function handleQuestion(q) {
  if (busy) return;
  if (q.length > 500) { addMessage('질문은 500자 이내로 입력해 주세요.'); return; }
  busy = true;
  document.querySelectorAll('button').forEach(b => b.disabled = true);
  addMessage(q, 'user'); input.value = '';
  addMessage('질문을 분석하고 공식 자료로 답변을 작성 중입니다…');
  const loading = messages.lastElementChild;
  try {
    const result = await askBackend(q);
    loading.remove();
    if (!result) {
      addMessage('검색 서버가 아직 연결되지 않았습니다. 저장소 README의 배포 안내를 따라 Worker를 배포한 후 해당 주소에서 이용해 주세요.', 'bot', '서버 연결 필요', 'https://data.iros.go.kr/');
      return;
    }
    const mode = result.queryType === '공식 통계 조회' ? '공식 통계 조회 · 서버 수치 검증' : result.llmUsed ? 'Llama 3.3 70B · AI 답변' : '원문 검색 · AI 답변 미사용';
    const meta = mode + (result.searchedAt ? ` · 조회 시각: ${new Date(result.searchedAt).toLocaleString('ko-KR')}` : '');
    addMessage(result.answer, 'bot', meta, result.source);
    for (const source of result.sources || []) {
      try { if (new URL(source.url).origin !== 'https://data.iros.go.kr') continue; } catch { continue; }
      addMessage(source.excerpt, 'bot', `[${(result.sources || []).indexOf(source) + 1}] ${result.queryType === '공식 통계 조회' ? '통계 조회 근거' : '원문 발췌'} · ${source.title}`, source.url);
    }
  } catch {
    loading.remove();
    addMessage('검색 서버에 연결하지 못했습니다. 잠시 후 다시 시도해 주세요.', 'bot', '조회 실패', 'https://data.iros.go.kr/');
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
