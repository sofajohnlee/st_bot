const messages = document.getElementById('messages');
const input = document.getElementById('question');
const form = document.getElementById('questionForm');

// Set window.REGISTRY_BOT_API_BASE in index.html after deploying worker.js.
// Example: https://your-worker-name.your-subdomain.workers.dev
const API_BASE = window.REGISTRY_BOT_API_BASE || '';

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

function classifyQuestion(q) {
  const s = q.toLowerCase();
  const api = /(open ?api|오픈 ?api|api|데이터 다운로드|공개데이터)/.test(s);
  const statistical = /(몇 건|건수|현황|통계|추이|비율|증가|감소|경매|공매|매매|소유권|저당|신청|지역별|월별|연도별|순위|비교)/.test(s);
  return statistical ? 'statistics' : api ? 'api' : 'general';
}

async function askBackend(q) {
  if (!API_BASE) return null;
  const response = await fetch(`${API_BASE.replace(/\/$/, '')}/api/ask`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ question: q })
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}

function officialFallback(q) {
  const type = classifyQuestion(q);
  if (type === 'statistics') {
    return {
      text: '이 질문은 등기정보광장의 실제 통계·현황 데이터가 필요한 질문입니다. Worker를 연결하면 공식 데이터 페이지를 조회하여 기준일과 함께 수치를 표시합니다.',
      meta: '조회 대상: 대한민국 법원 등기정보광장 · 데이터 시각화/등기현황',
      source: 'https://data.iros.go.kr/cr/dv/selectCrDvDataInfograpDetl.do?rdata_seq=6&ris_menu_seq=0000000016'
    };
  }
  if (type === 'api') {
    return {
      text: '등기정보광장 Open API는 회원가입·로그인 후 Open API 메뉴에서 신청하고 승인 및 인증키 발급 절차를 거쳐 이용합니다. 인증키는 브라우저에 노출하지 않고 서버에서 관리해야 합니다.',
      meta: '출처: 대한민국 법원 등기정보광장 Open API 안내',
      source: 'https://data.iros.go.kr/rp/oa/openOapiIntro.do'
    };
  }
  return {
    text: '등기정보광장은 등기현황, 데이터 시각화, 공개데이터, Open API 등의 서비스를 제공합니다. 통계 질문은 공식 데이터 조회 결과를 우선 사용하도록 구성했습니다.',
    meta: '출처: 대한민국 법원 등기정보광장',
    source: 'https://data.iros.go.kr/'
  };
}

async function handleQuestion(q) {
  addMessage(q, 'user');
  input.value = '';
  addMessage('공식 데이터를 조회 중입니다…');
  const loading = messages.lastElementChild;
  try {
    const result = await askBackend(q);
    loading.remove();
    if (result) {
      const meta = [result.queryType, result.dataDate ? `기준일: ${result.dataDate}` : ''].filter(Boolean).join(' · ');
      addMessage(result.answer || result.text || '조회 결과가 없습니다.', 'bot', meta || '실시간 공식자료 조회 결과', result.source || '');
      return;
    }
  } catch (e) {
    loading.remove();
    addMessage('실시간 조회 서버에 연결하지 못했습니다. 현재는 공식 사이트 안내로 전환합니다.');
  }
  const result = officialFallback(q);
  addMessage(result.text, 'bot', result.meta, result.source);
}

form.addEventListener('submit', e => {
  e.preventDefault();
  const q = input.value.trim();
  if (q) handleQuestion(q);
});

document.querySelectorAll('.suggestions button').forEach(button => {
  button.addEventListener('click', () => handleQuestion(button.dataset.q));
});
