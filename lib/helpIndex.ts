// Help index for "기능 물어보기": a rule-based local search, not AI.
// Each entry is a question, a written answer and the words that should find it.

export type HelpAction = "notices" | "contact" | "plan" | "account" | "atelier" | "tour";

export type HelpEntry = {
  id: string;
  /** question shown as the title of the answer */
  q: string;
  a: string;
  keys: string[];
  action?: { label: string; to: HelpAction };
};

const SC = "단축키";

export const HELP: HelpEntry[] = [
  // ---------- home / files ----------
  {
    id: "create",
    q: "새 도안은 어디서 만들어요?",
    a: "홈 오른쪽 위의 + 코바늘, + 대바늘, + 배색·방안 버튼을 누르면 바로 새 도안이 열려요. 파일이 하나도 없을 때는 이 버튼들이 깜빡여요.",
    keys: ["새 도안", "만들기", "생성", "시작", "새로", "추가"],
  },
  {
    id: "restore-trash",
    q: "지운 작품을 되살리고 싶어요",
    a: "왼쪽 메뉴의 휴지통을 열고, 카드의 … 메뉴나 오른쪽 클릭에서 ‘복원’을 누르세요. 휴지통의 작업은 30일 동안 보관된 뒤 자동으로 지워져요. 삭제 직후 뜨는 알림의 ‘실행 취소’로도 되돌릴 수 있어요.",
    keys: ["휴지통", "복원", "되살리", "지운", "삭제", "실수", "되돌리", "복구"],
  },
  {
    id: "rename",
    q: "도안 이름을 바꾸려면?",
    a: "홈에서 카드의 … 메뉴(또는 오른쪽 클릭) → ‘이름 변경’을 누르세요. 편집기 안에서는 왼쪽 위 도안 이름을 눌러 바로 고칠 수 있어요.",
    keys: ["이름", "제목", "변경", "바꾸", "rename"],
  },
  {
    id: "pin",
    q: "자주 쓰는 도안을 위에 고정하려면?",
    a: "카드 메뉴에서 ‘고정’을 누르면 ‘고정된 도안’ 줄에 따로 모여요. 다시 누르면 고정이 풀려요.",
    keys: ["고정", "핀", "pin", "위에", "즐겨"],
  },
  {
    id: "duplicate",
    q: "도안을 복제하고 싶어요",
    a: "카드 메뉴에서 ‘복제’를 누르면 ‘(사본)’이 붙은 새 도안이 만들어져요.",
    keys: ["복제", "사본", "복사본", "copy"],
  },
  {
    id: "search",
    q: "도안을 찾는 방법이 있어요?",
    a: "홈 위쪽 ‘제목으로 검색’ 칸에 낱말을 넣으세요. 초성(예: ㅋㅂㄴ)으로도 찾을 수 있어요. 정렬 버튼으로 최근 편집순·생성일 순을 바꿀 수 있어요.",
    keys: ["검색", "찾기", "찾", "초성", "정렬", "순서"],
  },
  {
    id: "storage",
    q: "도안은 어디에 저장돼요?",
    a: "이 사본에는 서버가 없어서, 모든 도안은 지금 쓰는 브라우저(localStorage)에만 저장돼요. 편집하면 자동으로 저장되고, 다른 브라우저나 기기에서는 보이지 않아요. 브라우저 데이터를 지우기 전에 계정 설정에서 백업 파일을 받아 두세요.",
    keys: ["저장", "자동 저장", "어디", "브라우저", "클라우드", "서버", "동기화", "다른 기기", "사라"],
    action: { label: "계정 설정 열기", to: "account" },
  },
  {
    id: "backup",
    q: "모든 도안을 파일로 백업하려면?",
    a: "계정 설정 → 데이터에서 ‘모든 도안 백업’을 누르면 .json 파일 하나로 내려받아요. 같은 화면의 ‘백업에서 복원’으로 그 파일을 다시 불러올 수 있어요. 같은 도안은 더 최근 것만 덮어써요.",
    keys: ["백업", "복원", "내보내", "파일", "json", "옮기", "이사", "다른 컴퓨터"],
    action: { label: "계정 설정 열기", to: "account" },
  },
  {
    id: "versions",
    q: "예전 상태로 돌아갈 수 있어요?",
    a: "편집 중에는 Ctrl(Cmd)+Z로 실행 취소, Ctrl(Cmd)+Shift+Z로 다시 실행할 수 있어요. 자동 저장할 때 몇 분마다 버전도 함께 기록돼요.",
    keys: ["버전", "되돌", "예전", "이전 상태", "기록", "히스토리"],
  },
  {
    id: "tour",
    q: "사용 방법을 다시 보고 싶어요",
    a: "왼쪽 아래 ‘사용방법 보기’를 누르면 홈 안내가 다시 열려요. 편집기는 처음 열 때 짧은 안내가 나와요.",
    keys: ["사용방법", "안내", "튜토리얼", "가이드", "투어", "처음"],
    action: { label: "사용방법 보기", to: "tour" },
  },
  // ---------- share / atelier ----------
  {
    id: "share",
    q: "도안을 다른 사람에게 보여 주려면?",
    a: "편집기 왼쪽 아래의 공유하기(공유 아이콘)를 누르면 링크가 만들어져요. 링크 안에 도안이 통째로 들어 있어서 서버에 올리지 않아요. 받은 사람은 읽기 전용으로 보고 ‘내 도안으로 복제’할 수 있어요.",
    keys: ["공유", "링크", "보여", "보내", "친구", "share", "url"],
  },
  {
    id: "atelier",
    q: "아뜰리에에 올리려면?",
    a: "편집기 왼쪽 아래의 ‘아뜰리에에 올리기’(가게 아이콘)를 누르고 제목, 소개, 태그를 채워 올리세요. 이 사본의 아뜰리에는 이 브라우저에만 저장되는 내 갤러리예요. 다른 사람에게는 보이지 않아요.",
    keys: ["아뜰리에", "올리", "게시", "판매", "마켓", "갤러리", "atelier"],
    action: { label: "아뜰리에 열기", to: "atelier" },
  },
  {
    id: "atelier-import",
    q: "아뜰리에 도안을 내 도안으로 가져오려면?",
    a: "아뜰리에에서 도안을 열고 ‘내 도안으로 가져오기’를 누르면 내 작업에 사본이 생겨요.",
    keys: ["가져오", "받기", "아뜰리에", "받은 도안"],
    action: { label: "아뜰리에 열기", to: "atelier" },
  },
  {
    id: "export",
    q: "PDF·이미지로 내보내고 싶어요",
    a: "편집기의 내보내기(다운로드 아이콘)에서 PNG, JPG, SVG로 받을 수 있어요. 인쇄가 필요하면 PNG를 받아 인쇄하거나 브라우저 인쇄로 PDF로 저장하세요.",
    keys: ["내보내기", "pdf", "png", "jpg", "svg", "이미지", "인쇄", "프린트", "다운로드", "저장"],
  },
  // ---------- crochet ----------
  {
    id: "crochet-radial",
    q: "원형으로 한 단을 놓으려면?",
    a: "코바늘 편집기에서 원형 만들기(O)를 고르고, 가운데에서 바깥으로 끌어 원을 그리면 고른 기호가 원 둘레에 반복돼요. 평면으로 한 줄을 놓을 때는 평면 만들기(L)를 쓰세요.",
    keys: ["원형", "한 단", "둘레", "동그랗", "반복 배치", "평면", "코바늘"],
  },
  {
    id: "crochet-increase",
    q: "늘려뜨기·줄여뜨기는 어떻게 넣어요?",
    a: "코바늘 기호 목록에서 늘려뜨기·줄여뜨기 기호를 골라 삽입(E)으로 놓으면 돼요. 여러 코를 한 코에 모으는 기호도 같은 목록에 있어요.",
    keys: ["늘려", "줄여", "늘림", "줄임", "increase", "decrease", "코바늘"],
  },
  {
    id: "crochet-slots",
    q: "자주 쓰는 기호를 빨리 꺼내려면?",
    a: "코바늘 편집기 아래의 퀵 슬롯 1–5에 기호를 넣어 두고 숫자 키 1–5로 바로 꺼내세요. 직접 만든 모양은 ‘내 기호로 등록’(M)으로 라이브러리에 저장할 수 있어요.",
    keys: ["퀵 슬롯", "슬롯", "자주", "숫자", "내 기호", "등록", "라이브러리"],
  },
  // ---------- knitting ----------
  {
    id: "knit-grid",
    q: "대바늘 격자는 어떻게 만들어요?",
    a: "대바늘 편집기에서 격자 만들기(K)를 고르고 캔버스에 끌거나 위쪽 숫자로 코·단 수를 정하세요. 격자 편집(G)에서 크기를 다듬을 수 있어요.",
    keys: ["격자", "대바늘", "차트", "코 수", "단 수"],
  },
  {
    id: "knit-repeat",
    q: "무늬를 반복해서 채우려면?",
    a: "대바늘에서 칸을 선택하면 둘레에 핸들 8개가 생겨요. 그중 하나를 끌면 그 방향으로 선택한 무늬가 반복돼요.",
    keys: ["반복", "무늬", "채우", "핸들", "패턴 반복", "대바늘"],
  },
  {
    id: "knit-cable",
    q: "교차뜨기 기호는 어디 있어요?",
    a: "대바늘 기호 목록에서 ‘교차’로 찾으면 교차뜨기(케이블) 기호가 나와요. 여러 칸을 차지하는 기호는 놓을 때 그 너비만큼 칸을 차지해요.",
    keys: ["교차", "케이블", "cable", "꽈배기", "대바늘"],
  },
  {
    id: "knit-color",
    q: "칸에 색을 칠하려면?",
    a: "대바늘에서 칸 색칠(B)을 켜고 아래 색을 골라 칸을 칠하세요. 기호와 색은 따로 들어가서 함께 쓸 수 있어요.",
    keys: ["색", "칠", "색칠", "배경색", "브러시", "대바늘"],
  },
  // ---------- grid ----------
  {
    id: "grid-image",
    q: "이미지를 배색 도안으로 바꾸려면?",
    a: "배색·방안 편집기 왼쪽의 ‘글자·이미지로 만들기’를 열고 이미지를 고르면, 실 개수에 맞춰 색을 줄여 칸으로 바꿔 줘요. 이 변환은 브라우저 안에서 규칙으로 계산해요.",
    keys: ["이미지", "사진", "그림", "변환", "배색", "픽셀", "글자", "텍스트"],
  },
  {
    id: "grid-count",
    q: "색별 코 수는 어디서 봐요?",
    a: "배색·방안 편집기 왼쪽 ‘실’ 목록에 실마다 쓴 코 수가 나와요(예: 1028코).",
    keys: ["코 수", "색별", "개수", "몇 코", "실 사용", "통계"],
  },
  {
    id: "grid-mirror",
    q: "좌우 대칭으로 뒤집으려면?",
    a: "배색·방안에서 영역을 선택(M)한 뒤 Shift+H로 좌우, Shift+V로 상하 반전, ] / [로 90° 회전해요. 아래 도구 막대의 반전 버튼도 같아요.",
    keys: ["대칭", "좌우", "상하", "반전", "뒤집", "회전", "미러"],
  },
  {
    id: "grid-gauge",
    q: "게이지는 어떻게 넣어요?",
    a: "배색·방안 편집기 오른쪽 ‘게이지 (10cm)’에 코와 단 수를 넣으면 칸 비율과 완성 크기가 그에 맞게 바뀌어요. 실 굵기와 바늘 호수로 어림값을 낼 수도 있어요.",
    keys: ["게이지", "gauge", "10cm", "크기", "완성 크기", "칸 비율"],
  },
  {
    id: "grid-mode",
    q: "대바늘 배색, 코바늘 배색, 코바늘 방안은 뭐가 달라요?",
    a: "배색·방안 편집기 위쪽에서 고를 수 있어요. 대바늘 배색과 코바늘 배색은 칸 비율이 다르고, 코바늘 방안(필레)은 채운 칸과 빈 칸으로만 그려요.",
    keys: ["방안", "필레", "filet", "모드", "태피스트리", "코바늘 배색", "대바늘 배색"],
  },
  // ---------- shortcuts (Shortcuts strings) ----------
  {
    id: "sc-undo",
    q: "실행 취소·다시 실행 단축키",
    a: "실행 취소는 Ctrl(Cmd)+Z, 다시 실행은 Ctrl(Cmd)+Shift+Z예요. 모든 편집기에서 같아요.",
    keys: [SC, "실행 취소", "다시 실행", "undo", "redo", "ctrl z", "되돌리"],
  },
  {
    id: "sc-copy",
    q: "복사·붙여넣기·잘라내기 단축키",
    a: "복사 Ctrl(Cmd)+C, 붙여넣기 Ctrl(Cmd)+V, 잘라내기 Ctrl(Cmd)+X, 삭제 Delete예요. 코바늘에서는 Ctrl(Cmd)+D로 복제, Alt(Option)을 누른 채 드래그해도 복제돼요.",
    keys: [SC, "복사", "붙여넣기", "잘라내기", "삭제", "복제", "ctrl c", "ctrl v"],
  },
  {
    id: "sc-pan",
    q: "화면 이동·확대 단축키",
    a: "스페이스를 누른 채 드래그하면 화면이 움직여요. Ctrl(Cmd)+휠로 확대·축소, Shift+1(코바늘은 Ctrl(Cmd)+0)로 화면에 맞춰요.",
    keys: [SC, "화면 이동", "이동", "확대", "축소", "줌", "zoom", "스페이스", "맞추기"],
  },
  {
    id: "sc-rotate",
    q: "회전·뒤집기 단축키",
    a: "코바늘: R / Shift+R로 ±15° 회전, Shift+H / Shift+V로 좌우·상하 뒤집기. 대바늘: R로 회전, Shift+H / Shift+V로 뒤집기. 배색·방안: ] / [로 90° 회전.",
    keys: [SC, "회전", "돌리", "뒤집", "15도", "90도"],
  },
  {
    id: "sc-tools",
    q: "도구 단축키",
    a: "코바늘: V 선택, E 삽입, P 펜, L 평면 만들기, O 원형 만들기, G 점/격자 표시. 대바늘: V 선택, E 삽입, K 격자 만들기, G 격자 편집, B 칸 색칠. 배색·방안: B 연필, U 사각형, G 채우기, I 스포이트, M 선택, H 화면 이동.",
    keys: [SC, "도구", "연필", "펜", "선택", "삽입", "스포이트", "채우기"],
  },
  {
    id: "sc-help",
    q: "단축키 목록은 어디서 봐요?",
    a: "편집기에서 ? 키를 누르면 그 편집기의 단축키 도움말이 열리고, 한 번 더 누르면 닫혀요.",
    keys: [SC, "목록", "도움말", "물음표", "?", "shortcut", "키보드"],
  },
  // ---------- FAQ ----------
  {
    id: "phone",
    q: "휴대폰에서도 만들 수 있어요?",
    a: "화면이 작아도 열리지만, 편집은 PC나 태블릿처럼 큰 화면에서 가장 편해요. 휴대폰에서는 공유 링크로 도안을 보는 용도로 쓰기 좋아요.",
    keys: ["휴대폰", "모바일", "핸드폰", "폰", "아이폰", "안드로이드", "태블릿"],
  },
  {
    id: "plan",
    q: "Free와 Pro는 뭐가 달라요?",
    a: "요금제마다 저장 개수, 내보내기 형식, AI 기능 등이 달라요. 이 사본은 결제를 받지 않고 모든 기능을 그대로 쓸 수 있어요. 플랜 구매에서 요금제를 비교해 볼 수 있어요.",
    keys: ["free", "pro", "basic", "요금", "플랜", "가격", "구독", "결제", "무료", "유료", "차이"],
    action: { label: "플랜 보기", to: "plan" },
  },
  {
    id: "account",
    q: "닉네임과 프로필 색을 바꾸려면?",
    a: "왼쪽 아래 ‘계정 설정’에서 닉네임과 프로필 색을 고를 수 있어요. 이 프로필은 이 브라우저에만 저장돼요.",
    keys: ["닉네임", "프로필", "계정", "아바타", "프로필 색"],
    action: { label: "계정 설정 열기", to: "account" },
  },
  {
    id: "logout",
    q: "로그아웃하면 도안이 지워져요?",
    a: "아니요. 로그아웃은 이 브라우저의 로컬 프로필만 지우고 처음 화면으로 돌아가요. 도안은 그대로 남아요. 모든 데이터를 지우려면 계정 설정의 ‘모든 로컬 데이터 삭제’를 쓰세요.",
    keys: ["로그아웃", "로그인", "탈퇴", "계정 삭제", "데이터 삭제", "지우"],
  },
  {
    id: "contact",
    q: "버그를 알리거나 기능을 제안하려면?",
    a: "왼쪽 아래 ‘문의하기’에서 내용을 적고 보내기를 누르면 메일 앱이 열려요. 보낸 문의는 이 브라우저의 ‘보낸 문의’에 사본이 남아요.",
    keys: ["문의", "버그", "오류", "제안", "건의", "신고", "연락", "메일", "고객센터"],
    action: { label: "문의하기 열기", to: "contact" },
  },
  {
    id: "notices",
    q: "새 기능 소식은 어디서 봐요?",
    a: "왼쪽 아래 ‘공지사항’에 업데이트 내용을 날짜별로 모아 뒀어요. 홈 위쪽 공지 배너의 ‘보기’로도 열 수 있어요.",
    keys: ["공지", "업데이트", "새 기능", "소식", "패치노트", "변경"],
    action: { label: "공지사항 열기", to: "notices" },
  },
  {
    id: "ai",
    q: "AI가 답해 주는 건가요?",
    a: "아니요. ‘기능 물어보기’는 이 브라우저에 들어 있는 도움말 목록에서 낱말이 겹치는 항목을 찾아 보여 주는 규칙 기반 검색이에요. 서버나 AI에 질문을 보내지 않아요.",
    keys: ["ai", "인공지능", "챗봇", "gpt", "누가 답", "자동 답변"],
  },
];

// ---------- search ----------

const PARTICLES = /(은|는|이|가|을|를|에|에서|으로|로|와|과|도|만|요|나요|어요|아요|해요|하려면|려면|싶어요|있어요|없어요|하나요|되나요|돼요|인가요|할까요|어떻게|어디서|어디|뭐|무엇)$/;

const norm = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}?\s]/gu, " ").replace(/\s+/g, " ").trim();
const words = (s: string) =>
  norm(s)
    .split(" ")
    .map((w) => (w.length > 2 ? w.replace(PARTICLES, "") : w))
    .filter(Boolean);
const STOP = new Set(["어떻게", "어디서", "어디", "무엇", "뭐", "좀", "수", "있어요", "싶어요", "하려면", "방법", "알려", "주세요"]);
/** character bigrams inside each word (question words dropped), so endings like "어요" don't match everything */
const bigrams = (s: string) => {
  const out = new Set<string>();
  for (const w of words(s)) {
    if (STOP.has(w)) continue;
    for (let i = 0; i < w.length - 1; i++) out.add(w.slice(i, i + 2));
  }
  return out;
};

export type HelpHit = { entry: HelpEntry; score: number };

/** Ranks entries by keyword hits + character-bigram overlap. Deterministic; no network. */
export function searchHelp(query: string, limit = 3): HelpHit[] {
  const q = norm(query);
  if (!q) return [];
  const qWords = words(query);
  const qGrams = bigrams(query);
  const qFlat = q.replace(/\s/g, "");
  const hits = HELP.map((entry) => {
    let score = 0;
    for (const k of entry.keys) {
      const kf = norm(k).replace(/\s/g, "");
      if (!kf) continue;
      if (qFlat.includes(kf)) score += 2 + Math.min(kf.length, 6) * 0.6;
      else if (qWords.some((w) => w.length >= 2 && kf.includes(w))) score += 1.2;
    }
    const eGrams = bigrams(`${entry.q} ${entry.keys.join(" ")}`);
    let common = 0;
    qGrams.forEach((g) => eGrams.has(g) && common++);
    if (qGrams.size) score += (common / qGrams.size) * 4;
    if (norm(entry.q) === q) score += 10;
    return { entry, score };
  });
  const ranked = hits.filter((h) => h.score >= 2.4).sort((a, b) => b.score - a.score);
  // related answers must be at least 60% as relevant as the best one
  return ranked.filter((h) => h.score >= ranked[0].score * 0.6).slice(0, limit);
}
