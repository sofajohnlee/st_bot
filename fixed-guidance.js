export const MORTGAGE_GUIDANCE = `근저당권 설정에 대한 안내입니다.
[제출사항]

[소유자]
• 인감증명서
• 등기필정보(구 등기필증, 등기권리증)
• 채권최고액이 2천만원 이상인 경우 채권최고액의 1000분의 10만큼 국민주택채권매입
• 신분증 및 인감도장
• 부동산등기규칙 제52조의2 제1항에 해당하는 경우 주소를 증명하는 서면(주민등록초본, 법인등기사항증명서)

[근저당권자]
• 근저당권설정계약서
• 주민등록표등초본(법인의 경우 법인등기사항증명서)
• 등록면허세영수필확인서
• 등기신청수수료 납부 영수증(등기신청 수수료액표 : 인터넷등기소 > 고객센터 > 등기비용안내 > "부동산" 탭  접속 후 등기신청수수료 항목에서 [등기의 목적별 부동산등기신청수수료액표 바로가기] 버튼 클릭)
• 신분증 및 도장
[신청방법]

• 부동산 소재지 관할 등기소로 접수
• 인터넷등기소 → 고객센터 → 지원안내 → 등기신청양식 → '근저당권설정'으로 검색 → 신청서 확인 및 다운로드
• 공동신청이 원칙이므로 일방에게 위임하는 경우 위임장 준비(소유자 위임 시 인감 날인)
• 소유자의 등기상 정보와 현재 정보가 다른 경우 등기명의인 표시변경이 먼저 선행되어야 함 (소유자의 등기상 정보와 현재 정보가 다르더라도 등기사항증명서에 등록번호가 기재되어 있는 내국인 또는 내국법인의 경우 주소증명서면에 의하여 동일인임이 인정되는 경우에는 등기명의인 표시변경을 선행하지 않아도 됨)
• 가족대리인에게 위임하는 경우 위임장, 가족증빙서류, 대리인의 신분증, 도장 준비

※ 안내된 서류 이외 추가서류가 발생할 수 있음
※ 제출서류는 발행일로부터 3개월 내, 주민등록번호를 공개하여 발급하여야 함
※ 인감도장과 인감증명서는 본인서명과 본인서명사실확인서로 대체 가능

추가 문의는 등기민원콜센터(☎1544-0773)로 연락해주시기 바랍니다.`;

export const MORTGAGE_DEFINITION = `근저당권 설정은 대출 등 채무를 담보하기 위해 부동산에 근저당권을 만들고 등기부에 기록하는 것입니다.

근저당권은 담보할 채무의 최고액인 ‘채권최고액’을 먼저 정하고, 최종적으로 담보할 채무의 확정은 나중에 하는 방식입니다. 채무의 이자도 채권최고액에 포함됩니다. [1]

쉽게 말하면, 부동산을 담보로 제공하면서 담보 범위의 상한을 정해 두는 것입니다. 채권최고액과 실제 대출잔액은 같은 의미가 아닙니다.

신청방법과 준비서류가 필요하면 “근저당권 설정 신청방법” 또는 “근저당권 설정 준비서류”라고 질문해 주세요.`;
const DEFINITION_SOURCE={title:'민법 제357조(근저당) · 시행 2026.3.17.',url:'https://www.law.go.kr/LSW/lsSideInfoP.do?docCls=jo&joBrNo=00&joNo=0357&lsiSeq=284415&urlMode=lsScJoRltInfoR',sourceType:'법령 원문',effectiveDate:'2026.3.17.'};
export function mortgageIntent(question,history=[]){
 let q=question.replace(/\s+/g,'');
 const explicit=/근저당(?:권)?/.test(q);
 if(!explicit){
  const prior=history.slice(-2).map(m=>m.content).join(' ');
  const deictic=/^(?:그게|그건|그것|이게|이건|그럼|그러면)/.test(q);
  const shortFollowup=/^(?:신청방법|신청절차|준비서류|필요서류|서류)(?:은|는|가|이)?(?:뭐|무엇|알려|설명|안내|[?？])/.test(q);
  if(!/근저당(?:권)?설정/.test(prior.replace(/\s+/g,''))||(!deictic&&!shortFollowup)||/상속|증여|매매|소유권|전세권|임차권|신탁|법인|전자신청|인터넷등기소/.test(q))return {intent:'other',question};
  q='근저당권설정 '+q;
 }
 if(/말소|해지|통계|현황|건수|몇건|부동산수|신청수|추이|증감|비교|순위|지역별|월별|연도별/.test(q))return {intent:'other',question};
 if(/제\d+조|근거|계산|얼마|세율|채권최고액|왜|주소|동일인|인감|대체|위임장/.test(q))return {intent:'detail',question};
 const definition=/뜻|개념|의미|정의|이란/.test(q)||/근저당(?:권)?(?:설정(?:등기)?)?(?:이|가|은|는)?(?:뭐|무엇)/.test(q)||/^(?:근저당권설정 )?(?:그게|그건|그것|이게|이건)(?:은|이)?(?:뭐|무엇)/.test(q);
 const application=/절차|방법|서류|준비|신청/.test(q);
 if(definition)return {intent:application?'definition_and_application':'definition',question:explicit?question:'근저당권 설정의 개념은 무엇인가요?'};
 const general=application||/안내|알려|문의|설명/.test(q)||/^근저당권?설정(?:등기)?[?？.!]*$/.test(q);
 if(general&&/근저당권?설정/.test(q))return {intent:'application',question:explicit?question:'근저당권 설정 신청 안내'};
 return {intent:'other',question};
}
export function fixedGuidance(question,history=[]){
 const classified=mortgageIntent(question,history);
 if(!['definition','application','definition_and_application'].includes(classified.intent))return null;
 const definition=classified.intent!=='application';
 const answer=classified.intent==='definition_and_application'?MORTGAGE_DEFINITION+'\n\n'+MORTGAGE_GUIDANCE:definition?MORTGAGE_DEFINITION:MORTGAGE_GUIDANCE;
 return {answer,status:'found',queryType:definition?'근저당권 설정 개념 안내':'근저당권 설정 안내',intent:classified.intent,llmUsed:false,model:null,aiStatus:'fixed_guidance',answerMode:'fixed',sources:definition?[DEFINITION_SOURCE]:[],source:definition?DEFINITION_SOURCE.url:'https://www.iros.go.kr/chat/',resolvedQuestion:classified.question};
}
