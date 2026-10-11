// Cloudflare Worker backend for the Registry Information Plaza AI bot.
// Secrets are kept server-side. The browser must never contain API keys.

const IROS_BASE = 'https://data.iros.go.kr';
const ALLOWED_ORIGIN = '*';

export default {
  async fetch(request, env) {
    const headers = {
      'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
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

    if (kind === 'auction') {
      const result = await getAuctionStats(question);
      if (result) return json(result, 200, headers);
      return json({
        answer: '등기정보광장 경매·공매 현황을 조회하려 했지만 공식 데이터 페이지에서 결과를 확인하지 못했습니다. 조회 조건을 연도·월까지 지정해 주세요.',
        source: `${IROS_BASE}/cr/dv/selectCrDvDataInfograpDetl.do?rdata_seq=6&ris_menu_seq=0000000016`,
        dataDate: null
      }, 200, headers);
    }

    if (kind === 'statistics') {
      return json({
        answer: '통계·현황 질문입니다. 현재는 경매·공매 현황부터 실제 등기정보광장 공개 페이지를 조회하도록 연결했습니다. 다른 통계 항목도 동일한 방식으로 데이터셋별 연결을 확장할 수 있습니다.',
        source: `${IROS_BASE}/cr/rs/openRgsCsInfrm.do?ris_menu_seq=0000000021`,
        dataDate: null
      }, 200, headers);
    }

    if (kind === 'api') {
      return json({
        answer: '등기정보광장 Open API는 회원가입·로그인 후 Open API 신청, 승인, 인증키 발급 등의 절차를 거쳐 이용합니다. 공식 안내에는 하루 최대 1,000건 이용 및 3일 연속 미사용 시 인증키 자동삭제 등의 이용안내가 표시되어 있습니다.',
        source: `${IROS_BASE}/rp/oa/openOapiIntro.do`,
        dataDate: null
      }, 200, headers);
    }

    return json({
      answer: '등기정보광장은 등기현황, 데이터 시각화, 공개데이터, Open API 등의 서비스를 제공합니다. 통계 질문은 공식 데이터 조회 결과를 우선 사용하도록 구성했습니다.',
      source: IROS_BASE,
      dataDate: null
    }, 200, headers);
  }
};

function classify(q) {
  if (/(경매|공매)/.test(q)) return 'auction';
  if (/(몇 건|건수|현황|통계|추이|비율|증가|감소|매매|소유권|저당|신청|지역별|월별|연도별)/.test(q)) return 'statistics';
  if (/(open ?api|오픈 ?api|api|데이터 다운로드|공개데이터)/i.test(q)) return 'api';
  return 'general';
}

function extractYearMonth(q) {
  const m = q.match(/(20\d{2})\s*(?:년|[-/.])\s*(0?[1-9]|1[0-2])\s*월?/);
  if (!m) return null;
  return `${m[1]}${String(m[2]).padStart(2, '0')}`;
}

async function getAuctionStats(question) {
  const ym = extractYearMonth(question);
  if (!ym) return null;

  const pageUrl = `${IROS_BASE}/cr/dv/selectCrDvDataInfograpDetl.do?rdata_seq=6&ris_menu_seq=0000000016&search_end_date=${ym}&search_start_date=${ym}`;
  const response = await fetch(pageUrl, {
    headers: { 'User-Agent': 'st_bot-registry-information-assistant/1.0' }
  });
  if (!response.ok) return null;

  const html = await response.text();
  const compact = html.replace(/\s+/g, ' ');

  // The public data page exposes the current selected month in its rendered text.
  // We intentionally extract only the three headline categories shown by the page.
  const total = findNumber(compact, new RegExp(`${ym.slice(0,4)}년\\s*${Number(ym.slice(4))}월\\s*경매개시결정/공매공고등기 신청은\\s*([0-9,]+)건`));
  const voluntary = findNumber(compact, /임의경매[^0-9]{0,80}([0-9,]+)/);
  const compulsory = findNumber(compact, /강제경매[^0-9]{0,80}([0-9,]+)/);
  const publicAuction = findNumber(compact, /공매공고[^0-9]{0,80}([0-9,]+)/);

  if (total == null && voluntary == null && compulsory == null && publicAuction == null) return null;

  const label = `${ym.slice(0,4)}년 ${Number(ym.slice(4))}월`;
  const parts = [];
  if (total != null) parts.push(`경매개시결정/공매공고등기 신청은 ${total.toLocaleString()}건입니다.`);
  if (voluntary != null) parts.push(`임의경매 ${voluntary.toLocaleString()}건`);
  if (compulsory != null) parts.push(`강제경매 ${compulsory.toLocaleString()}건`);
  if (publicAuction != null) parts.push(`공매공고 ${publicAuction.toLocaleString()}건`);

  return {
    answer: `${label} 기준입니다. ${parts.join(' / ')}\n\n※ 등기정보광장 데이터 시각화 자료는 조회 시점에 따라 일부 데이터가 변경될 수 있습니다.`,
    source: pageUrl,
    dataDate: label,
    queryType: '경매/공매등기 신청 현황'
  };
}

function findNumber(text, regex) {
  const m = text.match(regex);
  if (!m) return null;
  const value = Number(String(m[1]).replace(/,/g, ''));
  return Number.isFinite(value) ? value : null;
}

function json(value, status, headers) {
  return new Response(JSON.stringify(value), { status, headers });
}
