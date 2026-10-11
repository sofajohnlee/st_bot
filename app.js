const messages = document.getElementById('messages');
const input = document.getElementById('question');
const form = document.getElementById('questionForm');

const API_BASE = window.REGISTRY_BOT_API_BASE || '';

function addMessage(text, who = 'bot', meta = '') {
  const row = document.createElement('div');
  row.className = `message ${who}`;
  row.innerHTML = `<div class="avatar">${who === 'bot' ? 'AI' : 'YOU'}</div><div class="bubble"></div>`;
  row.querySelector('.bubble').textContent = text;
  if (meta) {
    const small = document.createElement('div');
    small.className = 'meta';
    small.textContent = meta;
    row.querySelector('.bubble').appendChild(small);
  }
  messages.appendChild(row);
  messages.scrollTop = messages.scrollHeight;
}

function classifyQuestion(q) {
  const s = q.toLowerCase();
  const statistical = /(몇 건|건수|현황|통계|추이|비율|증가|감소|경매|공매|매매|소유권|저당|신청|지역별|월별|연도별)/.test(s);
  const api = /(open ?api|오픈 ?api|api|데이터 다운로드|공개데이터)/.test(s);
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
      text: '이 질문은 등기정보광장의 실제 통계·현황 데이터가 필요한 질문입니다. 현재 화면은 공식 사이트를 기준으로 조회하도록 연결되어 있습니다. 정확한 수치는 공식 조회 결과를 확인한 뒤 답변하도록 구성해야 합니다.',
      meta: '조회 대상: 대한민국 법원 등기정보광장 · 데이터 시각화/등기현황'
    };
  }
  if (type === 'api') {
    return {
      text: '등기정보광장 Open API는 회원가입·로그인 후 Open API 메뉴에서 신청하고, 승인 및 인증키 발급 절차를 거쳐 이용하는 방식입니다. 일일 이용량 제한도 있으므로 실제 봇에서는 API 키를 브라우저에 노출하지 않고 서버에서 호출해야 합니다.',
      meta: '출처: 대한민국 법원 등기정보광장 Open API 안내'
    };
  }
  return {
    text: '등기정보광장은 등기현황, 데이터 시각화, 공개데이터, Open API 등을 제공하는 대한민국 법원의 서비스입니다. 질문을 통계·현황 질문과 일반 안내 질문으로 구분하여 실제 공개자료를 기준으로 답변하도록 구성하고 있습니다.',
    meta: '출처: 대한민국 법원 등기정보광장'
  };
}

async function handleQuestion(q) {
  addMessage(q, 'user');
  input.value = '';
  addMessage('조회 중입니다…');
  const loading = messages.lastElementChild;
  try {
    const result = await askBackend(q);
    loading.remove();
    if (result) {
      addMessage(result.answer || result.text || '조회 결과가 없습니다.', 'bot', result.source || '실시간 조회 결과');
      return;
    }
  } catch (e) {
    loading.remove();
    addMessage('실시간 API 서버에 연결하지 못했습니다. 공식 등기정보광장 기준 안내로 전환합니다.');
  }
  const result = officialFallback(q);
  addMessage(result.text, 'bot', result.meta);
}

form.addEventListener('submit', e => {
  e.preventDefault();
  const q = input.value.trim();
  if (q) handleQuestion(q);
});

document.querySelectorAll('.suggestions button').forEach(button => {
  button.addEventListener('click', () => handleQuestion(button.dataset.q));
});
