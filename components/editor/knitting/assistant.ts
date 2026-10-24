// The "AI 어시스턴트" of the knitting editor, as a local rule-based command interpreter.
// It reads short Korean (or simple English) requests and turns them into document edits.
// Nothing is sent anywhere; unknown requests get the list of what it understands.
import { knitSymbol } from "@/lib/symbols/knitting";
import {
  DEFAULT_NUMBERING,
  DEFAULT_ROW_SIDES,
  clearRect,
  flipBlockH,
  flipBlockV,
  mk,
  placeSymbol,
  readBlock,
  resizeGrid,
  rotateBlockCW,
  rowOwners,
  writeBlock,
  type Geo,
  type KDoc,
  type KGrid,
  type Rect,
  type Sel,
} from "./model";
import { parseWritten, DEFAULT_PARSE } from "./written";

export type AssistantCtx = { doc: KDoc; activeId: string | null; sel: Sel | null; geo: Geo };
export type AssistantResult = {
  reply: string;
  /** new document (one undo step) */
  next?: KDoc;
  sel?: Sel | null;
  activate?: string | null;
  action?: "undo" | "redo";
  addGrid?: { cols: number; rows: number };
  /** true when `next` changed cells, so the chat can offer 되돌리기 */
  changed?: boolean;
};

export const ASSISTANT_EXAMPLES = ["10코 20단 격자 추가", "아래 6단은 1코 고무뜨기", "선택 영역 안뜨기로 채워", "3단 지우기", "좌우 반전", "코 수 세어줘"];

export const CAPABILITIES = [
  "격자 만들기 · 「10코 20단 격자 추가」",
  "채우기 · 「선택 영역 안뜨기로 채워」「3~10단 메리야스 뜨기」「아래 6단은 2코 고무뜨기」 (겉뜨기·안뜨기·바늘비우기·모아뜨기·교차뜨기 같은 기호, 메리야스·가터·멍석·고무뜨기 무늬)",
  "색칠 · 「선택 영역 빨간색으로 칠해」「#24365c로 칠해」「색 지워」",
  "지우기 · 「3단 지우기」「5~8코 지워」「홀수단 비우기」「전체 지우기」",
  "뒤집기·회전 · 「좌우 반전」「상하 반전」「회전」",
  "크기 · 「30코 40단으로 크기 바꿔」「가로 4코 늘려」「세로 2단 줄여」",
  "선택 · 「전체 선택」「3~6단 선택」「선택 해제」",
  "세기 · 「코 수 세어줘」",
  "이름 · 「이름을 앞판으로 바꿔」",
  "되돌리기 · 「되돌려」「다시 실행」",
];

const COLORS: [RegExp, string][] = [
  [/빨간|빨강|red/i, "#d64545"],
  [/주황|orange/i, "#e8833a"],
  [/노란|노랑|yellow/i, "#f2c94c"],
  [/연두|lime/i, "#9ccc65"],
  [/초록|녹색|green/i, "#4c9a5a"],
  [/하늘|sky/i, "#7cc3e8"],
  [/파란|파랑|blue/i, "#3f6fd8"],
  [/남색|네이비|navy/i, "#24365c"],
  [/보라|purple/i, "#8e5cc4"],
  [/분홍|핑크|pink/i, "#f19bb5"],
  [/갈색|brown/i, "#8a5a3c"],
  [/회색|grey|gray/i, "#9a9a9a"],
  [/검정|검은|까만|black/i, "#222222"],
  [/흰|하얀|white/i, "#ffffff"],
  [/베이지|beige|아이보리|ivory/i, "#efe7d6"],
];

type Pattern = (rowNum: number, colNum: number, side: "RS" | "WS", round: boolean) => string | null;
/** row/stitch-number patterns (numbers as printed on the chart: row 1 = first row, stitch 1 = first stitch worked) */
const PATTERNS: [RegExp, string, Pattern][] = [
  [/메리야스|스토키넷|stockinette|st\s*st/i, "메리야스뜨기", () => "k_knit"],
  [/가터|garter/i, "가터뜨기", (_r, _c, side, round) => (round ? (_r % 2 === 0 ? "k_purl" : "k_knit") : side === "WS" ? "k_purl" : "k_knit")],
  [/이중\s*멍석|double\s*(?:seed|moss)/i, "이중 멍석뜨기", (r, c) => ((Math.floor((r - 1) / 2) + c) % 2 === 1 ? "k_knit" : "k_purl")],
  [/멍석|seed|moss/i, "멍석뜨기", (r, c) => ((r + c) % 2 === 0 ? "k_knit" : "k_purl")],
];
const RIB = /(\d)\s*(?:코|x|×|\/)\s*(?:(\d)\s*)?(?:코\s*)?고무|(\d)\s*[x×]\s*(\d)\s*(?:rib|고무)|(\d)\s*코\s*고무|고무\s*뜨기|rib/i;

function ctxGrid(c: AssistantCtx): { g: KGrid | null; note: string } {
  const g = c.doc.grids.find((x) => x.id === (c.sel?.gridId ?? c.activeId)) ?? null;
  if (g) return { g, note: "" };
  const first = c.doc.grids.find((x) => x.visible) ?? c.doc.grids[0] ?? null;
  if (first) return { g: first, note: `선택한 격자가 없어서 ${first.name} 격자에 반영해요. ` };
  return { g: null, note: "" };
}

const rowsRev = (g: KGrid) => (g.numbering ?? DEFAULT_NUMBERING).reverseRows !== false;
const colsRev = (g: KGrid) => (g.numbering ?? DEFAULT_NUMBERING).reverseCols !== false;
/** chart row number (as printed) → row index */
const rowIdx = (g: KGrid, n: number) => (rowsRev(g) ? g.rows - n : n - 1);
const colIdx = (g: KGrid, n: number) => (colsRev(g) ? g.cols - n : n - 1);
const rowNum = (g: KGrid, r: number) => (rowsRev(g) ? g.rows - r : r + 1);
const colNum = (g: KGrid, c: number) => (colsRev(g) ? g.cols - c : c + 1);

/** the region a request talks about: explicit 단/코 numbers, "아래/위 N단", the selection, or the whole grid */
function regionOf(text: string, g: KGrid, sel: Sel | null): { rect: Rect; what: string } | { error: string } {
  let m: RegExpMatchArray | null;
  let r0 = 0;
  let r1 = g.rows - 1;
  let c0 = 0;
  let c1 = g.cols - 1;
  let what = "";
  let explicit = false;
  if ((m = text.match(/(아래|밑|위)\s*(?:쪽\s*)?(\d+)\s*단/))) {
    const n = Math.min(g.rows, +m[2]);
    const bottom = m[1] !== "위";
    // "아래" = the first rows worked
    const a = bottom ? 1 : g.rows - n + 1;
    const b = bottom ? n : g.rows;
    const ia = rowIdx(g, a);
    const ib = rowIdx(g, b);
    r0 = Math.min(ia, ib);
    r1 = Math.max(ia, ib);
    what = `${a}–${b}단`;
    explicit = true;
  } else if ((m = text.match(/(\d+)\s*(?:단\s*)?(?:[~\-–]|부터|에서)\s*(\d+)\s*단/)) || (m = text.match(/(\d+)\s*단(?!\s*[~\-–])/))) {
    const a = +m[1];
    const b = m[2] ? +m[2] : a;
    if (Math.min(a, b) < 1 || Math.max(a, b) > g.rows) return { error: `${g.name}은(는) 1–${g.rows}단이에요. 단 번호를 다시 확인해 주세요.` };
    const ia = rowIdx(g, a);
    const ib = rowIdx(g, b);
    r0 = Math.min(ia, ib);
    r1 = Math.max(ia, ib);
    what = a === b ? `${a}단` : `${Math.min(a, b)}–${Math.max(a, b)}단`;
    explicit = true;
  }
  if ((m = text.match(/(\d+)\s*(?:코\s*)?(?:[~\-–]|부터|에서)\s*(\d+)\s*코(?!\s*(?:고무|모아|교차|늘리))/)) || (m = text.match(/(\d+)\s*번째\s*코/))) {
    const a = +m[1];
    const b = m[2] ? +m[2] : a;
    if (Math.min(a, b) < 1 || Math.max(a, b) > g.cols) return { error: `${g.name}은(는) 1–${g.cols}코예요. 코 번호를 다시 확인해 주세요.` };
    const ia = colIdx(g, a);
    const ib = colIdx(g, b);
    c0 = Math.min(ia, ib);
    c1 = Math.max(ia, ib);
    what += `${what ? " " : ""}${a === b ? `${a}번째 코` : `${Math.min(a, b)}–${Math.max(a, b)}코`}`;
    explicit = true;
  }
  if (!explicit && sel && sel.gridId === g.id) return { rect: sel, what: "선택 영역" };
  return { rect: { r0, r1, c0, c1 }, what: what || "격자 전체" };
}

const cellsIn = (r: Rect) => (r.r1 - r.r0 + 1) * (r.c1 - r.c0 + 1);
const sideOfRow = (g: KGrid, n: number): "RS" | "WS" => {
  const s = g.sides ?? DEFAULT_ROW_SIDES;
  if (s.worked === "round") return "RS";
  return (n % 2 === 1) === (s.firstRowSide === "RS") ? "RS" : "WS";
};

/** fills `rect` with symbols from fn (null = plain knit / empty cell); colours stay */
function fillWith(g: KGrid, rect: Rect, fn: (r: number, c: number) => string | null): KGrid {
  let out = clearSymbols(g, rect);
  for (let r = rect.r0; r <= rect.r1; r++) {
    let c = rect.c0;
    while (c <= rect.c1) {
      const id = fn(r, c);
      const w = id ? (knitSymbol(id)?.width ?? 1) : 1;
      if (id && id !== "k_knit" && c + w - 1 <= rect.c1) out = placeSymbol(out, r, c, id) ?? out;
      c += Math.max(1, w);
    }
  }
  return out;
}
function clearSymbols(g: KGrid, rect: Rect): KGrid {
  const cells = g.cells.slice();
  for (let r = rect.r0; r <= rect.r1; r++) {
    // a wide symbol that starts left of the region but reaches into it goes too
    const owners = rowOwners(g, r);
    for (let c = rect.c0; c <= rect.c1; c++) {
      const o = owners[c];
      if (o >= 0) cells[r * g.cols + o] = mk(undefined, cells[r * g.cols + o]?.color);
      cells[r * g.cols + c] = mk(undefined, cells[r * g.cols + c]?.color);
    }
  }
  return { ...g, cells };
}

function setGrid(doc: KDoc, g: KGrid): KDoc {
  return { ...doc, grids: doc.grids.map((x) => (x.id === g.id ? g : x)) };
}
const changedCells = (a: KGrid, b: KGrid) => {
  if (a.cells.length !== b.cells.length) return Math.max(a.cells.length, b.cells.length);
  let n = 0;
  for (let i = 0; i < a.cells.length; i++) if (JSON.stringify(a.cells[i]) !== JSON.stringify(b.cells[i])) n++;
  return n;
};

/** a stitch named in the request, via the written-pattern dictionary ("안뜨기", "k2tog", "2/2 RC", "바늘비우기") */
function symbolFrom(term: string): string | null {
  const t = term.trim().replace(/(으로|로|을|를|은|는)$/, "").trim();
  if (!t) return null;
  const r = parseWritten(`1: ${t}`, { ...DEFAULT_PARSE, width: 24 });
  if (r.unknown.length || !r.block) return null;
  const line = r.lines[0];
  if (line?.kind !== "row") return null;
  // the stitch as written; ask the dictionary through a one-row parse (right-side row, so the symbol is unchanged)
  return r.block.cells.find((c) => c?.symbol && c.symbol !== "k_blank")?.symbol ?? "k_knit";
}

export function interpret(input: string, c: AssistantCtx): AssistantResult {
  const text = input.trim().replace(/\s+/g, " ");
  if (!text) return { reply: "무엇을 할지 적어 주세요." };
  let m: RegExpMatchArray | null;

  // ----- help -----
  if (/^(도움말?|help|\?|뭐\s*할\s*수|무엇을\s*할\s*수|기능)/i.test(text) || /할\s*수\s*있(는|어)/.test(text)) return { reply: capabilities("이렇게 말하면 바로 반영해요.") };

  // ----- undo / redo -----
  if (/되돌려|되돌리기|실행\s*취소|undo|취소해/i.test(text)) return { reply: "마지막 변경을 되돌렸어요.", action: "undo" };
  if (/다시\s*실행|redo/i.test(text)) return { reply: "되돌린 변경을 다시 적용했어요.", action: "redo" };

  // ----- new grid -----
  if (
    ((m = text.match(/(\d+)\s*코\s*[,x×]?\s*(\d+)\s*단/)) || (m = text.match(/(\d+)\s*[x×*]\s*(\d+)/))) &&
    /(격자|보드|grid|추가|만들|새로)/i.test(text) &&
    !/크기|바꿔|변경|늘려|줄여|resize/.test(text)
  ) {
    const cols = Math.max(1, Math.min(400, +m[1]));
    const rows = Math.max(1, Math.min(400, +m[2]));
    return { reply: `${cols}코 ${rows}단 격자를 추가했어요.`, addGrid: { cols, rows } };
  }
  if (/^(새\s*)?격자\s*(추가|만들어)/.test(text) || /^add grid$/i.test(text)) return { reply: "20코 20단 격자를 추가했어요.", addGrid: { cols: 20, rows: 20 } };

  // ----- selection -----
  if (/선택\s*(해제|취소|풀어)|해제해/.test(text)) return { reply: "선택을 해제했어요.", sel: null };

  const { g, note } = ctxGrid(c);
  if (!g) return { reply: "먼저 캔버스에서 격자를 선택해 주세요. 격자가 없다면 「10코 20단 격자 추가」처럼 말해 보세요." };

  if (/전체\s*선택|모두\s*선택|select all/i.test(text)) {
    return { reply: `${note}${g.name} 전체(${g.cols}코 × ${g.rows}단)를 선택했어요.`, sel: { gridId: g.id, r0: 0, c0: 0, r1: g.rows - 1, c1: g.cols - 1 }, activate: g.id };
  }
  if (/선택(해|해줘|하기)?$/.test(text) && /\d/.test(text)) {
    const reg = regionOf(text, g, null);
    if ("error" in reg) return { reply: reg.error };
    return { reply: `${note}${reg.what}을(를) 선택했어요.`, sel: { ...reg.rect, gridId: g.id }, activate: g.id };
  }

  // ----- count -----
  if (/세어|세 줘|몇\s*코|몇\s*단|코\s*수|개수|count|통계|요약/i.test(text)) return { reply: note + countReply(g, c.sel && c.sel.gridId === g.id ? c.sel : null) };

  // ----- rename -----
  if ((m = text.match(/이름(?:을|를)?\s*(.+?)\s*(?:으로|로)\s*(?:바꿔|변경|해)/))) {
    const name = m[1].replace(/^["'「『]|["'」』]$/g, "").trim().slice(0, 40);
    if (!name) return { reply: "새 이름을 적어 주세요. 예) 이름을 앞판으로 바꿔" };
    return { reply: `${note}격자 이름을 「${name}」(으)로 바꿨어요.`, next: setGrid(c.doc, { ...g, name }), activate: g.id };
  }

  // ----- flip / rotate -----
  const flip = /좌우\s*(반전|뒤집)|flip\s*h|mirror/i.test(text) ? "h" : /상하\s*(반전|뒤집)|flip\s*v/i.test(text) ? "v" : /회전|돌려|rotate/i.test(text) ? "r" : null;
  if (flip) {
    const reg = regionOf(text, g, c.sel);
    if ("error" in reg) return { reply: reg.error };
    const rect = reg.rect;
    let block = readBlock(g, rect);
    block = flip === "h" ? flipBlockH(block) : flip === "v" ? flipBlockV(block) : rotateBlockCW(block);
    let ng: KGrid;
    let sel: Sel | null | undefined;
    if (flip === "r" && reg.what === "격자 전체") {
      ng = { ...g, cols: block.cols, rows: block.rows, cells: block.cells };
      sel = null;
    } else {
      ng = writeBlock(clearRect(g, rect), block, rect.c0, rect.r0);
      if (flip === "r") sel = { gridId: g.id, r0: rect.r0, c0: rect.c0, r1: Math.min(g.rows - 1, rect.r0 + block.rows - 1), c1: Math.min(g.cols - 1, rect.c0 + block.cols - 1) };
    }
    const label = flip === "h" ? "좌우로 뒤집었어요" : flip === "v" ? "상하로 뒤집었어요" : "오른쪽으로 90° 돌렸어요";
    return { reply: `${note}${reg.what}을(를) ${label}.`, next: setGrid(c.doc, ng), sel, activate: g.id, changed: true };
  }

  // ----- resize -----
  if ((m = text.match(/(\d+)\s*코\s*[,x×]?\s*(\d+)\s*단\s*(?:으로|로)?\s*(?:크기|바꿔|변경|맞춰|resize)/)) || (m = text.match(/크기.*?(\d+)\s*[x×코]\s*(\d+)/))) {
    const cols = Math.max(1, Math.min(400, +m[1]));
    const rows = Math.max(1, Math.min(400, +m[2]));
    // knitting starts at the bottom right, so rows and stitches come and go at the top and left
    const ng = resizeGrid(g, { left: cols - g.cols, right: 0, top: rows - g.rows, bottom: 0 }, c.geo);
    return { reply: `${note}격자를 ${cols}코 ${rows}단으로 바꿨어요.`, next: setGrid(c.doc, ng), sel: null, activate: g.id, changed: true };
  }
  if ((m = text.match(/(가로|세로|코|단)\s*(\d+)\s*(코|단)?\s*(늘려|늘리기|추가|줄여|줄이기|빼)/))) {
    const n = +m[2] * (/늘|추가/.test(m[4]) ? 1 : -1);
    const horiz = m[1] === "가로" || m[1] === "코" || m[3] === "코";
    const d = horiz ? { left: Math.max(1 - g.cols, n), right: 0, top: 0, bottom: 0 } : { left: 0, right: 0, top: Math.max(1 - g.rows, n), bottom: 0 };
    const ng = resizeGrid(g, d, c.geo);
    return { reply: `${note}격자를 ${ng.cols}코 ${ng.rows}단으로 바꿨어요.`, next: setGrid(c.doc, ng), sel: null, activate: g.id, changed: true };
  }

  // ----- clear -----
  if ((m = text.match(/(홀수|짝수)\s*단\s*(?:을|를)?\s*(비워|비우기|지워|지우기|삭제)/))) {
    const odd = m[1] === "홀수";
    const cells = g.cells.slice();
    for (let r = 0; r < g.rows; r++) if (rowNum(g, r) % 2 === (odd ? 1 : 0)) for (let x = 0; x < g.cols; x++) cells[r * g.cols + x] = null;
    const ng = { ...g, cells };
    const n = changedCells(g, ng);
    if (!n) return { reply: "바꿀 칸이 없었어요. 단·코 범위를 다시 확인해 주세요." };
    return { reply: `${note}${m[1]}단을 비웠어요 (${n}칸).`, next: setGrid(c.doc, ng), activate: g.id, changed: true };
  }
  if (/(색|배색)\s*(?:을|를)?\s*(지워|지우기|빼|없애)/.test(text)) {
    const reg = regionOf(text, g, c.sel);
    if ("error" in reg) return { reply: reg.error };
    const cells = g.cells.slice();
    for (let r = reg.rect.r0; r <= reg.rect.r1; r++) for (let x = reg.rect.c0; x <= reg.rect.c1; x++) cells[r * g.cols + x] = mk(cells[r * g.cols + x]?.symbol, undefined);
    const ng = { ...g, cells };
    const n = changedCells(g, ng);
    if (!n) return { reply: "바꿀 칸이 없었어요. 단·코 범위를 다시 확인해 주세요." };
    return { reply: `${note}${reg.what}의 색 ${n}칸을 지웠어요.`, next: setGrid(c.doc, ng), activate: g.id, changed: true };
  }
  if (/(지워|지우기|지우|비워|비우기|삭제|clear|erase)/i.test(text) && !/격자\s*삭제/.test(text)) {
    const reg = regionOf(text, g, c.sel);
    if ("error" in reg) return { reply: reg.error };
    const ng = clearRect(g, reg.rect);
    const n = changedCells(g, ng);
    if (!n) return { reply: "바꿀 칸이 없었어요. 단·코 범위를 다시 확인해 주세요." };
    return { reply: `${note}${reg.what}을(를) 지웠어요 (${n}칸).`, next: setGrid(c.doc, ng), activate: g.id, changed: true };
  }

  // ----- paint -----
  const hex = text.match(/#([0-9a-f]{6}|[0-9a-f]{3})\b/i);
  const named = COLORS.find(([re]) => re.test(text));
  if ((hex || named) && /칠|색|paint|color|colour/i.test(text)) {
    let col = hex ? `#${hex[1]}` : named![1];
    if (col.length === 4) col = `#${col[1]}${col[1]}${col[2]}${col[2]}${col[3]}${col[3]}`;
    col = col.toLowerCase();
    const reg = regionOf(text, g, c.sel);
    if ("error" in reg) return { reply: reg.error };
    const cells = g.cells.slice();
    for (let r = reg.rect.r0; r <= reg.rect.r1; r++) for (let x = reg.rect.c0; x <= reg.rect.c1; x++) cells[r * g.cols + x] = mk(cells[r * g.cols + x]?.symbol, col);
    const ng = { ...g, cells };
    const n = changedCells(g, ng);
    if (!n) return { reply: "바꿀 칸이 없었어요. 단·코 범위를 다시 확인해 주세요." };
    const next = setGrid(c.doc, ng);
    if (!next.colors.includes(col)) next.colors = [...next.colors, col].slice(-16);
    return { reply: `${note}${reg.what} ${n}칸을 ${col} 색으로 칠했어요.`, next, activate: g.id, changed: true };
  }

  // ----- fill with a stitch or a stitch pattern -----
  const wantsFill = /(채워|채우|바꿔|변경|뜨기로|로 해|으로 해|만들어|떠|뜨기$|fill|넣어|깔아)/i.test(text) || PATTERNS.some(([re]) => re.test(text)) || RIB.test(text);
  if (wantsFill) {
    const reg = regionOf(text, g, c.sel);
    if ("error" in reg) return { reply: reg.error };
    const rect = reg.rect;
    const round = (g.sides ?? DEFAULT_ROW_SIDES).worked === "round";
    // stitch pattern?
    let fn: ((r: number, cc: number) => string | null) | null = null;
    let label = "";
    const rib = text.match(RIB);
    if (rib) {
      const k = +(rib[1] ?? rib[3] ?? rib[5] ?? 1);
      const p = +(rib[2] ?? rib[4] ?? k);
      // ribs line up from the first stitch worked (stitch 1)
      fn = (_r, cc) => ((colNum(g, cc) - 1) % (k + p) < k ? "k_knit" : "k_purl");
      label = k === p ? `${k}코 고무뜨기` : `겉${k} 안${p} 고무뜨기`;
    } else {
      const pat = PATTERNS.find(([re]) => re.test(text));
      if (pat) {
        fn = (r, cc) => pat[2](rowNum(g, r), colNum(g, cc), sideOfRow(g, rowNum(g, r)), round);
        label = pat[1];
      }
    }
    if (!fn) {
      // the stitch name: what comes before 로/으로 (or the whole request minus the region words)
      const stripped = text
        .replace(/(선택\s*(?:한\s*)?(?:영역|칸)|이\s*영역|격자\s*전체|전체|모두|모든\s*칸)\s*(?:을|를|은|는)?/g, "")
        .replace(/(아래|밑|위)\s*(?:쪽\s*)?\d+\s*단\s*(?:은|는|을|를)?/g, "")
        .replace(/\d+\s*(?:단\s*)?(?:[~\-–]|부터|에서)\s*\d+\s*단\s*(?:까지|을|를|은|는)?/g, "")
        .replace(/\d+\s*(?:코\s*)?(?:[~\-–]|부터|에서)\s*\d+\s*코\s*(?:까지|을|를|은|는)?/g, "")
        .replace(/\d+\s*단\s*(?:을|를|은|는)?/g, "")
        .trim();
      const tm = stripped.match(/^(.+?)\s*(?:으로|로)\s*(?:채워|채우기|채워줘|바꿔|변경|해|만들어|넣어|깔아|fill)/) ?? stripped.match(/^(.+?)\s*(?:채워|채우기|fill)/) ?? stripped.match(/^(.+?)$/);
      const id = tm ? symbolFrom(tm[1].replace(/\s*(?:뜨기로|로|으로)$/, (x) => (x.includes("뜨기") ? "뜨기" : ""))) : null;
      if (!id) return { reply: `어떤 기호로 채울지 알아듣지 못했어요. 겉뜨기·안뜨기·바늘비우기·k2tog·2/2 RC처럼 기호 이름을 적거나, 메리야스·가터·멍석·1코 고무뜨기 같은 무늬를 적어 주세요.` };
      fn = () => id;
      label = knitSymbol(id)?.name ?? id;
    }
    const ng = fillWith(g, rect, fn);
    const n = changedCells(g, ng);
    if (!n) return { reply: `${note}이미 ${label}(으)로 채워져 있어서 바꿀 칸이 없었어요.` };
    const rowsTouched = rect.r1 - rect.r0 + 1;
    return { reply: `${note}${reg.what}을(를) ${label}(으)로 채웠어요 · ${rowsTouched}단, ${n}칸을 바꿨어요.`, next: setGrid(c.doc, ng), activate: g.id, changed: true };
  }

  if (/격자\s*삭제/.test(text)) {
    const grids = c.doc.grids.filter((x) => x.id !== g.id);
    return { reply: `${g.name} 격자를 지웠어요. 「되돌려」로 되살릴 수 있어요.`, next: { ...c.doc, grids }, activate: null, sel: null, changed: true };
  }

  return { reply: capabilities("이 요청은 아직 이해하지 못했어요. 이렇게 말해 보세요.") };
}

function capabilities(head: string) {
  return `${head}\n${CAPABILITIES.map((x) => `• ${x}`).join("\n")}`;
}

function countReply(g: KGrid, sel: Rect | null): string {
  const rect = sel ?? { r0: 0, c0: 0, r1: g.rows - 1, c1: g.cols - 1 };
  const m = new Map<string, number>();
  let blank = 0;
  const colors = new Map<string, number>();
  for (let r = rect.r0; r <= rect.r1; r++) {
    const owners = rowOwners(g, r);
    for (let c = rect.c0; c <= rect.c1; c++) {
      const col = g.cells[r * g.cols + c]?.color;
      if (col) colors.set(col, (colors.get(col) ?? 0) + 1);
      const o = owners[c];
      if (o >= 0 && o !== c && c !== rect.c0) continue;
      const id = o >= 0 ? g.cells[r * g.cols + o]?.symbol : undefined;
      if (id === "k_blank") {
        blank++;
        continue;
      }
      const name = id ? (knitSymbol(id)?.name ?? id) : "겉뜨기(빈 칸)";
      m.set(name, (m.get(name) ?? 0) + 1);
    }
  }
  const W = rect.c1 - rect.c0 + 1;
  const H = rect.r1 - rect.r0 + 1;
  const parts = [...m.entries()].sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`);
  let s = `${sel ? "선택 영역" : g.name}: ${W}코 × ${H}단, ${cellsIn(rect)}칸이에요.`;
  if (parts.length) s += `\n기호: ${parts.join(", ")}`;
  if (blank) s += `\n빈칸(코 없음) ${blank}칸`;
  if (colors.size) s += `\n색: ${[...colors.entries()].map(([k, v]) => `${k} ${v}칸`).join(", ")}`;
  return s;
}
