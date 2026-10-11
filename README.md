# 등기정보광장 검색 안내봇

등기정보광장 공개 HTML 페이지를 서버에서 조회하고, 질문의 한국어 키워드와 일치하는 원문을 출처 링크와 함께 제공합니다. Cloudflare Workers AI의 공개 가중치 모델 Meta Llama 3.3 70B (`@cf/meta/llama-3.3-70b-instruct-fp8-fast`)가 질문을 검색어로 정리하고 공식 원문 발췌를 근거로 한국어 답변을 생성합니다. 별도의 외부 LLM API 키는 필요하지 않으며 `AI` 바인딩을 사용합니다. 통계 API 연동은 포함하지 않습니다.

AI 모델 실행 실패 또는 바인딩 미설정 시 원문 검색 결과로 전환하며, 화면에 AI 답변 사용 여부를 표시합니다. 검색 자료가 없으면 모델 답변을 생성하지 않습니다. 웹페이지는 비신뢰 데이터로 취급하며 출처 번호를 포함하도록 모델에 지시합니다. 생성 답변의 정확성을 보장하는 것은 아니므로 원문 확인이 필요합니다.

## AI 배포 설정

- `wrangler.jsonc`의 Worker 이름은 실제 서비스 주소에 맞춰 `st-bot`입니다.
- `ai: { "binding": "AI" }`를 배포하면 Workers AI가 연결됩니다. Cloudflare 계정에 Workers AI 이용 권한이 필요합니다.
- Workers AI의 무료 할당량 초과 시 계정 요금제에 따라 비용이 발생하거나 요청이 제한될 수 있습니다. https://developers.cloudflare.com/workers-ai/platform/pricing/
- 질문과 공식 발췌는 Cloudflare Workers AI로 전송됩니다. 개인정보나 비공개 자료를 입력하지 마세요.
- 기존 GitHub Actions의 Cloudflare 배포 자격증명으로 main 변경 시 자동 배포합니다. 토큰 권한에 따라 AI 바인딩 배포가 제한되면 Cloudflare에서 권한을 확인하세요.

## 실행 및 배포

1. Node.js 22 이상에서 `npm test`로 검증합니다.
2. `npx wrangler dev`로 로컬 실행합니다.
3. `npx wrangler login` 후 `npm run deploy`를 실행합니다.
4. 출력된 `https://st-bot.<계정>.workers.dev` 주소를 엽니다. 화면과 `/api/ask`가 함께 배포되므로 서버 주소를 별도로 입력할 필요가 없습니다.

GitHub Actions 자동 배포를 쓰려면 저장소 Settings → Secrets and variables → Actions에 `CLOUDFLARE_API_TOKEN`(Workers 배포 권한), `CLOUDFLARE_ACCOUNT_ID`를 등록합니다. main에 반영하면 기존 배포 워크플로가 실행됩니다. 토큰을 파일에 넣지 마세요.

GitHub Pages를 별도로 쓰면 index.html의 `window.REGISTRY_BOT_API_BASE`에 배포된 Worker URL을 설정하고 같은 변경을 public/index.html에도 반영합니다. 화면 배포용 public 폴더와 루트의 화면 파일은 동일하게 유지합니다.

## 검색 범위와 한계

- 홈페이지, 공지사항, 자료실, 등기현황에서 시작하여 질문과 관련된 직접 링크를 최대 4개 추가 조회합니다. 전체 사이트 검색 인덱스는 아닙니다.
- EUC-KR 문자 인코딩을 처리하며, 조회 타임아웃과 15분 캐시를 적용합니다.
- JavaScript로만 제공되는 게시글·통계 및 PDF 첨부파일 본문은 검색하지 못할 수 있습니다. 로그인, 신청, 파일 다운로드는 수행하지 않습니다.
- 통계 수치를 자동 추출하거나 지역·기간별로 집계하지 않습니다. 검색 결과의 숫자를 질문의 통계 답으로 단정하지 않으며 공식 통계 화면에서 확인하도록 안내합니다.
- 조회 시각은 자료의 통계 기준일이 아닙니다. 원문 발췌에는 메뉴 등 주변 텍스트가 포함될 수 있습니다.
- 외부 연결 실패 시 조회 성공처럼 표시하지 않습니다. 사이트의 접근 정책·이용약관을 확인한 후 운영하고, 공개 운영 규모에 맞춰 Cloudflare에서 요청 제한을 설정하세요.

## 구성

worker.js: 공식 페이지 조회/검색 및 JSON API. public/: Worker가 제공하는 채팅 화면. 루트 app.js/index.html: GitHub Pages용 화면. 테스트는 실제 사이트에 의존하지 않는 fixture를 사용합니다.
