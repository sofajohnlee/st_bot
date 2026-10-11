// Cloudflare Worker backend for the Registry Information Plaza AI bot.
// Deploy this file as a Worker and set secrets in the Worker environment:
// OPENROUTER_API_KEY (optional, if an LLM is used)
// IROS_API_KEY (when using an approved Registry Information Plaza Open API key)
//
// The browser must never contain these keys.

const IROS_OPEN_API_BASE = 'https://data.iros.go.kr/';

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '*';
    const headers = {
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Content-Type': 'application/json; charset=utf-8'
    };

    if (request.method === 'OPTIONS') return new Response('', { headers });
    if (request.method !== 'POST') return json({ error: 'POST only' }, 405, headers);

    const url = new URL(request.url);
    if (url.pathname !== '/api/ask') return json({ error: 'Not found' }, 404, headers);

    let body;
    try { body = await request.json(); } catch { return json({ error: 'Invalid JSON' }, 400, headers); }
    const question = String(body.question || '').trim();
    if (!question) return json({ error: 'question is required' }, 400, headers);

    const kind = classify(question);

    // IMPORTANT: current/statistical figures must come from structured official data.
    // Do not let an LLM invent figures. Add the approved IROS Open API endpoint here
    // after the API service and parameters are confirmed for the selected dataset.
    if (kind === 'statistics') {
      return json({
        answer: '통계·현황 질문으로 분류했습니다. 등기정보광장 Open API를 서버에서 조회한 뒤 실제 수치와 기준일을 답변하도록 연결할 수 있습니다. 현재는 API 키와 해당 데이터셋의 승인된 엔드포인트가 필요합니다.',
        source: '대한민국 법원 등기정보광장 Open API'
      }, 200, headers);
    }

    if (kind === 'api') {
      return json({
        answer: '등기정보광장 Open API는 회원가입·로그인 후 Open API 신청, 승인, 인증키 발급 등의 절차를 거쳐 이용합니다. API 키는 브라우저 코드에 넣지 않고 서버 환경변수로 관리해야 합니다.',
        source: IROS_OPEN_API_BASE + 'rp/oa/openOapiIntro.do'
      }, 200, headers);
    }

    return json({
      answer: '등기정보광장은 등기현황, 데이터 시각화, 공개데이터, Open API 등의 서비스를 제공합니다. 질문을 데이터 질문과 일반 안내 질문으로 분류하여 공식 자료를 기준으로 답변하도록 구성했습니다.',
      source: IROS_OPEN_API_BASE
    }, 200, headers);
  }
};

function classify(q) {
  if (/(몇 건|건수|현황|통계|추이|비율|증가|감소|경매|공매|매매|소유권|저당|신청|지역별|월별|연도별)/.test(q)) return 'statistics';
  if (/(open ?api|오픈 ?api|api|데이터 다운로드|공개데이터)/i.test(q)) return 'api';
  return 'general';
}

function json(value, status, headers) {
  return new Response(JSON.stringify(value), { status, headers });
}
