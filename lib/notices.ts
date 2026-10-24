// Static notices ("공지사항") in the Updates (패치노트) style. Newest first.

export type UpdateKind = "new" | "improved" | "fixed";
export type UpdateArea = "crochet" | "knitting" | "grid" | "atelier" | "account" | "phone";

export type NoticeItem = { kind: UpdateKind; area: UpdateArea; text: string };
export type NoticeEntry = {
  /** also shown in the title, e.g. "26.10.21" */
  id: string;
  tag: "update" | "안내";
  title: string;
  date: string;
  pinned?: boolean;
  lead: string;
  items: NoticeItem[];
  /** "이렇게 써 보세요" */
  tryIt?: string;
};

export const KIND_LABEL: Record<UpdateKind, string> = { new: "새 기능", improved: "개선", fixed: "수정" };
export const AREA_LABEL: Record<UpdateArea, string> = {
  crochet: "코바늘",
  knitting: "대바늘",
  grid: "배색·방안",
  atelier: "아뜰리에",
  account: "계정·요금",
  phone: "휴대폰",
};

export const NOTICES: NoticeEntry[] = [
  {
    id: "26.10.21",
    tag: "update",
    title: "기능 업데이트 안내 (26.10.21)",
    date: "2026-10-21",
    lead: "도안을 나누고 보관하는 기능을 더했어요. 모두 서버 없이 이 브라우저 안에서 동작해요.",
    items: [
      { kind: "new", area: "grid", text: "공유 링크: 도안을 링크 하나에 담아 보내요. 받은 사람은 읽기 전용으로 보고 내 도안으로 복제할 수 있어요." },
      { kind: "new", area: "atelier", text: "아뜰리에 (beta): 만든 도안을 제목·소개·태그와 함께 이 브라우저의 내 갤러리에 올려요." },
      { kind: "new", area: "account", text: "계정 설정에서 모든 도안을 파일 하나로 백업하고 복원할 수 있어요." },
      { kind: "improved", area: "account", text: "알림: 아뜰리에에 올리거나 백업을 복원하면 홈의 종 아이콘에 알림이 남아요." },
      { kind: "new", area: "account", text: "기능 물어보기: 사용법을 물어보면 도움말 목록에서 맞는 답을 찾아 보여 줘요." },
    ],
    tryIt: "배색·방안 도안을 열고 왼쪽 아래 공유하기를 눌러 링크를 복사해 보세요.",
  },
  {
    id: "26.10.08",
    tag: "update",
    title: "버전 기록과 처음 사용 안내 (26.10.08)",
    date: "2026-10-08",
    lead: "실수해도 걱정 없도록 자동 저장과 함께 버전을 남겨요.",
    items: [
      { kind: "new", area: "crochet", text: "자동 저장할 때 몇 분마다 버전을 함께 기록해요." },
      { kind: "new", area: "knitting", text: "홈과 코바늘·대바늘 편집기에 처음 쓰는 분을 위한 짧은 안내를 넣었어요. 홈 왼쪽 아래 ‘사용방법 보기’로 다시 볼 수 있어요." },
      { kind: "improved", area: "knitting", text: "대바늘 기호 목록을 328개로 넓혔어요." },
    ],
  },
  {
    id: "26.09.30",
    tag: "안내",
    title: "도안은 이 브라우저에 저장돼요",
    date: "2026-09-30",
    pinned: true,
    lead: "이 사본은 서버와 계정 없이 동작해요. 만든 도안은 지금 쓰는 브라우저에만 저장되고, 다른 기기와 동기화되지 않아요.",
    items: [
      { kind: "improved", area: "account", text: "브라우저의 사이트 데이터를 지우면 도안도 함께 지워져요. 계정 설정 → 데이터에서 백업 파일을 받아 두세요." },
      { kind: "improved", area: "phone", text: "휴대폰에서는 공유 링크로 도안을 보는 용도로 쓰기 좋아요." },
    ],
  },
];

const READ_KEY = "patterners.home.noticesRead";
export const latestNoticeId = NOTICES[0].id;
export const noticesRead = () => {
  try {
    return localStorage.getItem(READ_KEY) === latestNoticeId;
  } catch {
    return false;
  }
};
export const markNoticesRead = () => {
  try {
    localStorage.setItem(READ_KEY, latestNoticeId);
  } catch {}
};
