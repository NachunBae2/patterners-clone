import type { TourSide, TourStep } from "./SpotlightTour";

/* Editor first-run tours (MakerTour.steps.* strings; step ids/anchors/sides as in the reference). */

type Def = { id: string; anchor: string | null; side?: TourSide; only?: "wide" | "compact"; title: string; body: string };

const HELP = {
  title: "다시 보기",
  body: "여기 물음표에서 기능 체험하기(이 안내와 심화 레슨), 기능 물어보기, 단축키 목록(?)을 열 수 있어요. 레슨은 연습용 도안에서 직접 따라 해 보는 방식이라 실제 도안에 영향이 없어요.",
};

const CROCHET: Def[] = [
  {
    id: "welcome",
    anchor: null,
    title: "코바늘 도안 만들기",
    body: "코바늘 도안을 그리는 화면이에요. 왼쪽에서 기호를 고르고, 가운데 캔버스에 놓고, 아래 도구로 다듬어요. 화면 요소를 하나씩 짧게 소개할게요. 언제든 건너뛰고 하단 물음표에서 다시 볼 수 있어요.",
  },
  {
    id: "palette",
    anchor: "palette",
    side: "right",
    only: "wide",
    title: "기호 팔레트",
    body: "왼쪽에서 기호를 고르고 캔버스를 누르면 코가 놓여요. 늘려뜨기·모아뜨기는 ‘늘림·줄임’ 묶음에서 바로 고를 수 있어요.",
  },
  {
    id: "compact-actions",
    anchor: "compact-actions",
    side: "top",
    only: "compact",
    title: "기호 · 레이어 열기",
    body: "화면이 좁을 때는 기호 팔레트와 레이어가 접혀 있어요. ‘기호’를 눌러 놓을 기호를 고르고, ‘레이어’에서 단을 나눠 관리하세요. 3D 미리보기도 여기서 열어요.",
  },
  {
    id: "canvas",
    anchor: "canvas",
    side: "left",
    title: "캔버스",
    body: "클릭하면 기호가 놓이고, 놓인 기호는 드래그로 옮길 수 있어요. 휠을 굴리거나 스페이스를 누른 채 드래그하면 화면이 이동하고, Ctrl(Cmd)을 누른 채 휠을 굴리면 확대·축소해요. 기호를 2개 이상 고르고 오른쪽 클릭하면 ‘늘려뜨기·모아뜨기로 합치기’가, 기호 하나를 오른쪽 클릭하면 ‘늘려뜨기·모아뜨기로 바꾸기’가 나와요.",
  },
  {
    id: "toolbar-tools",
    anchor: "toolbar-tools",
    side: "top",
    title: "도구",
    body: "선택(V)은 놓인 기호를 고르고 옮기고, 편집(E)은 클릭한 자리에 기호를 놓아요. 펜(P)은 자유 선을 그리고, 경로(S)는 선을 따라 기호를 배치해요. 기호를 골라 두면 회전·뒤집기 버튼도 여기 나타나요.",
  },
  {
    id: "toolbar-repeat",
    anchor: "toolbar-repeat",
    side: "top",
    title: "반복",
    body: "같은 기호를 여러 개 놓아야 할 때 써요. 평면 만들기(L)는 한 줄로, 원형 만들기(O)는 원 둘레를 따라 개수를 정해 한 번에 배치해요. 원형 도안의 단을 만들 때 특히 편해요.",
  },
  {
    id: "quick-slots",
    anchor: "quick-slots",
    side: "top",
    title: "퀵 슬롯",
    body: "자주 쓰는 기호를 1–5번 슬롯에 등록해 두면 숫자키 하나로 바로 꺼낼 수 있어요. 빈 슬롯을 누른 뒤 팔레트에서 기호를 고르면 등록돼요.",
  },
  {
    id: "layer-panel",
    anchor: "layer-panel",
    side: "left",
    only: "wide",
    title: "레이어",
    body: "단마다 레이어를 나눠 그리면 겹치는 부분을 편하게 다룰 수 있어요. 레이어를 추가·이름 변경·순서 변경하고, 눈 아이콘으로 잠시 숨길 수 있어요. 선택한 레이어에만 기호가 놓여요.",
  },
  {
    id: "written-toggle",
    anchor: "written-toggle",
    side: "bottom",
    title: "서술형 도안",
    body: "기호 도안 옆에 텍스트 도안을 함께 볼 수 있어요. 이미 있는 서술형 도안을 붙여 넣으면 AI가 기호 도안으로 바꿔 주고, 그린 도안을 텍스트로 정리할 수도 있어요.",
  },
  {
    id: "export",
    anchor: "export",
    side: "right",
    title: "내보내기",
    body: "내보낼 레이어를 고르고 PNG·JPG·PDF 중 형식을 선택해요. 여러 레이어를 한 장으로 합치거나 따로 저장할 수 있고, 인쇄용이면 PDF를 추천해요.",
  },
  { id: "help", anchor: "help", side: "top", ...HELP },
];

const KNITTING: Def[] = [
  {
    id: "welcome",
    anchor: null,
    title: "대바늘 도안 만들기",
    body: "대바늘 차트를 그리는 화면이에요. 순서는 간단해요. 격자를 만들고, 모드를 바꿔 가며 칸에 기호를 놓거나 색을 칠해요. 아래 도구 막대의 모드부터 하나씩 짧게 소개할게요. 언제든 건너뛸 수 있어요.",
  },
  {
    id: "toolbar-tools",
    anchor: "toolbar-tools",
    side: "top",
    title: "모드가 나뉘어 있어요",
    body: "대바늘은 어떤 모드가 켜져 있는지에 따라 칸을 눌렀을 때 하는 일이 달라져요. 선택(V)은 칸을 고르고 옮기고, 편집(E)은 기호를 놓고, 이동은 화면을 옮겨요. 격자 만들기(K), 격자 편집(G), 칸 색칠(B)은 이어서 하나씩 볼게요. 원하는 대로 안 될 땐 켜진 모드부터 확인하세요.",
  },
  {
    id: "grid",
    anchor: "toolbar-grid",
    side: "top",
    title: "격자 만들기",
    body: "차트는 격자에서 시작해요. 이 모드(K)를 켜고 캔버스를 끌면 끈 만큼 격자가 생겨요. 켜면 바로 위에 뜨는 칸에 가로·세로 수를 적고 ‘만들기’를 눌러도 돼요. 격자는 여러 개 만들 수 있어요.",
  },
  {
    id: "gridEdit",
    anchor: "toolbar-grid-edit",
    side: "top",
    title: "격자 고치기",
    body: "만든 격자의 크기와 모양은 여기서 바꿔요. 선택 모드에서 격자를 고르면 이 버튼(G)이 켜져요. 가장자리를 끌면 줄·열이 통째로 늘거나 줄고, 칸을 끌면 그 자리에 칸이 추가돼요. Alt(Option)를 누른 채 끌면 칸이 빠지고, Shift를 누른 채 끌면 네모 영역이 한 번에 채워져요.",
  },
  {
    id: "brush",
    anchor: "toolbar-brush",
    side: "top",
    title: "칸 색칠",
    body: "기호 대신 칸의 배경색을 칠하는 모드(B)예요. 켜면 색 팔레트가 나타나요. 색을 골라 칸을 칠하고, 지우개로 비우고, 스포이드로 칸 색을 집어오고, 올가미로 감싼 칸을 한 번에 칠할 수 있어요. 배색 무늬는 이 모드로 그려요.",
  },
  {
    id: "palette",
    anchor: "palette",
    side: "right",
    only: "wide",
    title: "기호 팔레트",
    body: "편집 모드에서 쓰는 기호가 모여 있어요. 기호를 고르고 칸을 누르면 채워져요. 위쪽 연필 버튼으로 나만의 기호를 직접 그려서 쓸 수도 있어요.",
  },
  {
    id: "compact-actions",
    anchor: "compact-actions",
    side: "top",
    only: "compact",
    title: "기호 · 레이어 열기",
    body: "화면이 좁을 때는 기호 팔레트와 레이어가 접혀 있어요. ‘기호’를 눌러 칸에 넣을 기호를 고르고, ‘레이어’에서 보드를 나눠 관리하세요. 3D 미리보기도 여기서 열어요.",
  },
  {
    id: "canvas",
    anchor: "canvas",
    side: "left",
    title: "그리드 캔버스",
    body: "격자 도구(K)로 드래그하면 새 격자가 생겨요. 칸을 드래그해 영역을 고르고, 선택한 영역은 그대로 끌어 옮기거나 Ctrl(Cmd)을 누른 채 끌어 복사할 수 있어요. 사방 핸들을 끌면 무늬가 그 방향으로 반복돼요. 스페이스로 화면 이동, 휠로 확대·축소해요.",
  },
  {
    id: "layer-panel",
    anchor: "layer-panel",
    side: "left",
    only: "wide",
    title: "보드 · 레이어",
    body: "앞판·뒤판·소매처럼 조각마다 보드를 나눠 그릴 수 있어요. 보드를 추가·전환하고, 레이어 눈 아이콘으로 필요한 것만 보이게 해요.",
  },
  {
    id: "written-toggle",
    anchor: "written-toggle",
    side: "bottom",
    title: "서술형 도안",
    body: "차트 옆에 텍스트 도안을 함께 볼 수 있어요. 기존 서술형 도안을 붙여 넣어 차트로 가져오거나, 그린 차트를 단별 텍스트로 정리할 수 있어요.",
  },
  {
    id: "export",
    anchor: "export",
    side: "right",
    title: "내보내기",
    body: "내보낼 보드를 고르고 PNG·JPG·PDF 중 형식을 선택해요. 여러 보드를 한 장으로 합치거나 따로 저장할 수 있고, 인쇄용이면 PDF를 추천해요.",
  },
  { id: "help", anchor: "help", side: "top", ...HELP },
];

/** Steps for the editor's first-run tour; `compact` = palette/layers are folded away (narrow window). */
export function makerTourSteps(craft: "crochet" | "knitting", compact: boolean): TourStep[] {
  return (craft === "crochet" ? CROCHET : KNITTING)
    .filter((s) => !s.only || s.only === (compact ? "compact" : "wide"))
    .map(({ id, anchor, side, title, body }) => ({ id, anchor, side, title, body }));
}
