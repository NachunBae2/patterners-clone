// AI 어시스턴트 (rule-based): a local command interpreter. It reads one Korean (or simple English)
// sentence, edits the document and says exactly what it did. Nothing leaves the browser.
import type { CrochetItem, GatherItem, StitchItem } from "@/lib/types";
import { defaultSpread, getSymbol } from "@/lib/symbols/crochet";
import { layerStitches, st, ch, type Round } from "./chart";
import { appendRounds, dominantStitch, insertChart, roundScope, type Doc } from "./docops";
import { gatherItemGeom, geomFoot, stitchGeom, type Pt } from "./geometry";
import { parsePattern } from "./parser";
import { TEMPLATES, circleRounds, decreaseRound, increaseRound, templateDefaults } from "./templates";

export type AssistResult = { reply: string; doc?: Doc; select?: string[]; action?: "undo" | "redo" | "fit" };
export type AssistCtx = { doc: Doc; selection: string[]; center: Pt };

export const HELP = [
  "매직링 짧은뜨기 6코로 시작해 5단까지 6코씩 늘리기",
  "3단 추가해줘 · 한 단 더 늘림 없이",
  "2단 지우기 · 선택한 기호 지워",
  "선택한 기호 빨간색으로 · 2단 파란색으로",
  "짧은뜨기를 긴뜨기로 바꿔 · 마지막 단을 한길긴뜨기로",
  "전체 코 수 알려줘 · 3단 코 수",
  "2단: 짧은뜨기 늘려뜨기 6개 (서술 한 줄)",
  "그래니 스퀘어 3단 · 평면 12코 6단",
  "되돌리기 · 다시 실행 · 화면 맞추기",
];
const helpText = (lead: string) => `${lead}\n이렇게 말해 보세요:\n${HELP.map((h) => `· ${h}`).join("\n")}`;

// ---------- vocabulary ----------

const STITCH_WORDS: [RegExp, string][] = [
  [/다섯\s*길(?:\s*긴\s*뜨기)?/, "tall_5"],
  [/네\s*길(?:\s*긴\s*뜨기)?/, "tall_4"],
  [/세\s*길(?:\s*긴\s*뜨기)?|\bdtr\b/, "dtr"],
  [/두\s*길(?:\s*긴\s*뜨기)?|\btr\b/, "tr"],
  [/한\s*길(?:\s*긴\s*뜨기)?|\bdc\b/, "dc"],
  [/짧은\s*뜨기|짧은|\bsc\b/, "sc"],
  [/긴\s*뜨기|\bhdc\b/, "hdc"],
  [/빼\s*뜨기|\bslst\b/, "slst"],
  [/구슬\s*뜨기/, "bobble"],
  [/팝콘\s*뜨기/, "popcorn"],
  [/퍼프\s*뜨기/, "puff"],
];

/** Stitch names in reading order (longest names first, no overlaps). */
function findStitches(text: string): { id: string; at: number }[] {
  const out: { id: string; at: number; end: number }[] = [];
  for (const [re, id] of STITCH_WORDS) {
    const g = new RegExp(re.source, "g");
    let m: RegExpExecArray | null;
    while ((m = g.exec(text))) {
      const at = m.index, end = at + m[0].length;
      if (!out.some((o) => at < o.end && end > o.at)) out.push({ id, at, end });
    }
  }
  return out.sort((a, b) => a.at - b.at);
}

const COLORS: [RegExp, string, string][] = [
  [/빨간|빨강|레드|\bred\b/, "#d64545", "빨간색"],
  [/주황|오렌지|\borange\b/, "#e8833a", "주황색"],
  [/노란|노랑|\byellow\b/, "#d9a400", "노란색"],
  [/초록|녹색|연두|\bgreen\b/, "#4f9d2d", "초록색"],
  [/파란|파랑|하늘|\bblue\b/, "#2e86c1", "파란색"],
  [/보라|\bpurple\b/, "#6c4bc4", "보라색"],
  [/분홍|핑크|\bpink\b/, "#c2408f", "분홍색"],
  [/갈색|밤색|\bbrown\b/, "#8a6a4f", "갈색"],
  [/회색|\bgr[ae]y\b/, "#9aa0a6", "회색"],
  [/검정|검은|까만|\bblack\b/, "#1f1f1f", "검은색"],
];
function findColor(text: string): { hex: string; name: string } | null {
  const hex = text.match(/#[0-9a-f]{6}\b/i);
  if (hex) return { hex: hex[0].toLowerCase(), name: hex[0] };
  for (const [re, h, name] of COLORS) if (re.test(text)) return { hex: h, name };
  return null;
}

const KO_NUM: Record<string, number> = { 한: 1, 하나: 1, 두: 2, 둘: 2, 세: 3, 셋: 3, 네: 4, 넷: 4, 다섯: 5, 여섯: 6 };
/** "3단", "한 단" → 3 / 1 */
function roundNumbers(text: string): number[] {
  const out: number[] = [];
  const re = /(\d+|한|두|세|네|다섯|여섯)\s*단(?!\s*계)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) out.push(/^\d+$/.test(m[1]) ? Number(m[1]) : KO_NUM[m[1]]);
  return out;
}

// ---------- targets ----------

type Target = { ids: Set<string>; label: string } | { error: string };

function resolveTarget(text: string, ctx: AssistCtx, defaultAll: boolean): Target {
  const d = ctx.doc;
  const scope = roundScope(d);
  if (/마지막\s*단|맨\s*끝\s*단|last\s+round/.test(text)) {
    const last = scope[scope.length - 1];
    if (!last) return { error: "단이 아직 없어요." };
    return { ids: new Set(last.layer.items.map((i) => i.id)), label: last.layer.name };
  }
  const nums = roundNumbers(text).filter((n) => /\d/.test(String(n)));
  const explicit = text.match(/(\d+)\s*단/g);
  if (explicit) {
    const want = explicit.map((x) => Number(x.match(/\d+/)![0]));
    const layers = scope.filter((x) => want.includes(x.n)).map((x) => x.layer);
    if (!layers.length) return { error: `${want.join(", ")}단을 찾지 못했어요. 지금 있는 단: ${scope.map((x) => x.n).join(", ") || "없음"}` };
    return { ids: new Set(layers.flatMap((l) => l.items.map((i) => i.id))), label: layers.map((l) => l.name).join(", ") };
  }
  void nums;
  if (/선택/.test(text) || (ctx.selection.length && !/전체|모두|다\s|all/.test(text))) {
    if (!ctx.selection.length) return { error: "선택한 기호가 없어요. 캔버스에서 먼저 골라 주세요." };
    return { ids: new Set(ctx.selection), label: "선택한 기호" };
  }
  if (defaultAll || /전체|모두|전부|all/.test(text)) return { ids: new Set(d.layers.filter((l) => l.visible && !l.locked).flatMap((l) => l.items.map((i) => i.id))), label: "전체" };
  return { error: "어디를 바꿀지 알려 주세요. 예) 2단, 선택한 기호, 전체" };
}

const mapItems = (d: Doc, ids: Set<string>, fn: (it: CrochetItem) => CrochetItem | null): Doc => ({
  ...d,
  layers: d.layers.map((l) => {
    if (!l.items.some((it) => ids.has(it.id))) return l;
    const items: CrochetItem[] = [];
    for (const it of l.items) {
      if (!ids.has(it.id)) items.push(it);
      else {
        const r = fn(it);
        if (r) items.push(r);
      }
    }
    return { ...l, items };
  }),
});

/** Swaps the symbol (or increase leg) and keeps the stitch's foot where it was. */
function swapStitch(it: CrochetItem, from: string | null, to: string): CrochetItem | null {
  const legCapable = (id: string) => {
    const s = getSymbol(id);
    return !!s && (!!s.leg || !!s.tall) && !s.gather;
  };
  if (it.type === "stitch") {
    const id = getSymbol(it.symbol)?.id ?? it.symbol;
    if (from ? id !== from : !legCapable(id)) return null;
    if (id === to) return null;
    const f0 = geomFoot(stitchGeom(it));
    const next: StitchItem = { ...it, symbol: to };
    delete next.scale;
    const f1 = geomFoot(stitchGeom(next));
    const r = (it.rotation * Math.PI) / 180;
    const sV = it.flipV ? -1 : 1;
    const ux = Math.sin(r) * sV, uy = -Math.cos(r) * sV;
    next.x = Math.round((it.x + ux * (f1 - f0)) * 100) / 100;
    next.y = Math.round((it.y + uy * (f1 - f0)) * 100) / 100;
    return next;
  }
  if (it.type === "gather") {
    if (from ? it.symbol !== from : !legCapable(it.symbol)) return null;
    if (it.symbol === to || !getSymbol(to)?.leg) return null;
    const f0 = geomFoot(gatherItemGeom(it));
    const next: GatherItem = { ...it, symbol: to, spread: defaultSpread(to, it.count) };
    const f1 = geomFoot(gatherItemGeom(next));
    const r = (it.rotation * Math.PI) / 180;
    next.x = Math.round((it.x + Math.sin(r) * (f1 - f0)) * 100) / 100;
    next.y = Math.round((it.y - Math.cos(r) * (f1 - f0)) * 100) / 100;
    return next;
  }
  return null;
}

// ---------- commands ----------

function counts(text: string, ctx: AssistCtx): string {
  const d = ctx.doc;
  if (/선택/.test(text) && ctx.selection.length) {
    const ids = new Set(ctx.selection);
    const items = d.layers.flatMap((l) => l.items.filter((i) => ids.has(i.id)));
    return `선택한 ${items.length}개는 ${layerStitches(items)}코예요.`;
  }
  const scope = roundScope(d, null).length ? roundScope(d) : [];
  const explicit = text.match(/(\d+)\s*단/);
  if (explicit) {
    const n = Number(explicit[1]);
    const r = scope.find((x) => x.n === n);
    if (!r) return `${n}단을 찾지 못했어요.`;
    return `${n}단은 ${layerStitches(r.layer.items)}코예요 (기호 ${r.layer.items.length}개).`;
  }
  const visible = d.layers.filter((l) => l.visible);
  const total = visible.reduce((s, l) => s + layerStitches(l.items), 0);
  const symbols = visible.reduce((s, l) => s + l.items.filter((i) => i.type === "stitch" || i.type === "gather").length, 0);
  if (!symbols) return "아직 놓은 기호가 없어요.";
  const per = visible.filter((l) => l.items.length).map((l) => `${l.name} ${layerStitches(l.items)}`).join(" · ");
  return `모두 ${total}코예요 (기호 ${symbols}개).\n단별 코 수: ${per}`;
}

function nextRoundNodes(sym: string, from: number, delta: number, row: boolean, lead?: number) {
  const nodes = delta > 0 ? increaseRound(sym, from, delta) : delta < 0 ? decreaseRound(sym, from, -delta) : [st(sym, from)];
  return lead ? [ch(lead), ...nodes] : nodes;
  void row;
}

function addRounds(text: string, ctx: AssistCtx): AssistResult {
  const d = ctx.doc;
  const scope = roundScope(d);
  const last = scope[scope.length - 1];
  if (!last) return generate(text.includes("단") ? `매직링 짧은뜨기 6코로 시작 ${text}` : text, ctx) ?? { reply: helpText("늘릴 단이 아직 없어요. 먼저 시작 단을 만들어 주세요.") };
  const nums = roundNumbers(text);
  let count = 1, firstN = last.n + 1;
  const want = nums[0];
  if (want !== undefined) {
    if (/더|추가로|개/.test(text) && !/\d+\s*단\s*추가/.test(text)) count = want;
    else if (want > last.n) count = want - last.n;
    else count = want;
  }
  count = Math.max(1, Math.min(20, count));
  const P = layerStitches(last.layer.items);
  const prev = scope[scope.length - 2];
  const hasRing = last.layer.items.some((i) => i.type === "stitch" && getSymbol(i.symbol)?.id === "magic_ring");
  let delta = prev ? P - layerStitches(prev.layer.items) : hasRing ? P : 0;
  const per = text.match(/(\d+)\s*코\s*씩\s*(늘|줄)/);
  if (per) delta = Number(per[1]) * (per[2] === "줄" ? -1 : 1);
  else if (/늘림\s*없이|그대로|늘리지\s*않|같은\s*코\s*수|plain/.test(text)) delta = 0;
  else if (/줄여|줄이|줄임|모아/.test(text)) delta = -Math.max(1, Math.abs(delta) || 6);
  else if (/늘려|늘리|늘림/.test(text) && delta <= 0) delta = hasRing || P % 6 === 0 ? 6 : Math.max(1, Math.round(P / 4));
  const named = findStitches(text)[0]?.id;
  const sym = named ?? dominantStitch(last.layer.items) ?? "sc";
  const row = last.layer.guide?.kind === "row";
  const firstSt = last.layer.items[0];
  const lead = row && firstSt?.type === "stitch" && firstSt.symbol === "ch" ? (sym === "sc" ? 1 : sym === "hdc" ? 2 : 3) : undefined;
  const rounds: Round[] = [];
  let cur = P;
  const steps: string[] = [];
  for (let i = 0; i < count; i++) {
    let dd = delta;
    if (cur + dd < 3) dd = 0;
    const nodes = nextRoundNodes(sym, cur, dd, row, lead);
    rounds.push({ label: String(firstN + i), nodes });
    const after = cur + (dd < 0 ? -Math.min(-dd, Math.floor(cur / 2)) : dd);
    steps.push(dd > 0 ? `${firstN + i}단: ${cur}코에서 늘려뜨기 ${dd}곳 → ${after}코` : dd < 0 ? `${firstN + i}단: ${cur}코에서 모아뜨기 ${-dd}곳 → ${after}코` : `${firstN + i}단: ${symbolName(sym)} ${after}코 (늘림 없이)`);
    cur = after;
  }
  const r = appendRounds(d, last.layer, rounds, firstN);
  if (!r) return { reply: "이어 붙일 단의 모양을 알 수 없어요." };
  const n = r.layers.reduce((s, l) => s + l.items.length, 0);
  const labels = r.layers.map((l) => l.name.replace(/단$/, "")).join(", ");
  void firstN;
  return { doc: r.doc, select: [], reply: `${labels}단을 반영했어요. 기호 ${n}개예요.\n${steps.join("\n")}` };
}

const symbolName = (id: string) => getSymbol(id)?.name ?? id;

function generate(text: string, ctx: AssistCtx): AssistResult | null {
  const d = ctx.doc;
  const num = (re: RegExp, def: number) => {
    const m = text.match(re);
    return m ? Number(m[1]) : def;
  };
  const tpl = (id: string, params: Record<string, number>) => {
    const t = TEMPLATES.find((x) => x.id === id)!;
    const p = { ...templateDefaults(t), ...params };
    for (const f of t.fields) p[f.key] = Math.max(f.min, Math.min(f.max, Math.round(p[f.key])));
    const rounds = t.build(p);
    const res = insertChart(d, rounds, { layout: t.layout, at: ctx.center, name: t.name });
    return { doc: res.doc, select: [], reply: `‘${t.name}’을(를) 만들었어요. 단별 코 수 ${res.counts.join(", ")} · 모두 ${res.stitches}코` };
  };
  const stitchIdx = (): number | undefined => {
    const id = findStitches(text)[0]?.id;
    return id === "sc" ? 0 : id === "hdc" ? 1 : id === "dc" ? 2 : undefined;
  };
  if (/그래니/.test(text)) return tpl("granny", { rounds: num(/(\d+)\s*단/, 3) });
  if (/육각/.test(text)) return tpl("hexagon", { rounds: num(/(\d+)\s*단/, 3) });
  if (/꽃/.test(text)) return tpl("flower", { petals: num(/(\d+)\s*(?:장|잎|개)/, 6) });
  if (/원통|통\s*모양/.test(text)) return tpl("tube", { chains: num(/(\d+)\s*코/, 20), rounds: num(/(\d+)\s*단/, 4), ...(stitchIdx() !== undefined ? { stitch: stitchIdx()! } : {}) });
  if (/타원|바닥/.test(text)) return tpl("oval", { chains: num(/사슬\s*(\d+)|(\d+)\s*코/, 10), rounds: num(/(\d+)\s*단/, 3) });
  if (/공\b|공\s*모양|아미구루미|구\s*모양/.test(text)) return tpl("ball", { widest: num(/(\d+)\s*코/, 30) });
  if (/평면|사각|직사각|스와치|swatch/.test(text)) {
    return tpl("rect", { chains: num(/(\d+)\s*코/, 10), rounds: num(/(\d+)\s*단/, 6), ...(stitchIdx() !== undefined ? { stitch: stitchIdx()! } : {}) });
  }
  if (/매직\s*링|원형|링|동그|circle|magic/.test(text)) {
    const sym = findStitches(text)[0]?.id ?? "sc";
    const start = Math.max(3, Math.min(16, num(/(\d+)\s*코(?!\s*씩)/, sym === "dc" ? 12 : sym === "hdc" ? 8 : 6)));
    const rounds = Math.max(1, Math.min(15, num(/(\d+)\s*단/, 1)));
    const delta = Math.max(0, Math.min(16, num(/(\d+)\s*코\s*씩/, start)));
    const rs = circleRounds(sym, start, rounds, delta);
    const res = insertChart(d, rs, { layout: "radial", at: ctx.center, name: "원형" });
    const steps = res.counts.map((c, i) => (i === 0 ? `1단: 매직링에 ${symbolName(sym)} ${c}코` : `${i + 1}단: ${res.counts[i - 1]}코에서 늘려뜨기 ${c - res.counts[i - 1]}곳 → ${c}코`));
    return { doc: res.doc, select: [], reply: `원형 ${rounds}단을 만들었어요. 모두 ${res.stitches}코예요.\n${steps.join("\n")}` };
  }
  return null;
}

function writtenLine(text: string, ctx: AssistCtx): AssistResult | null {
  if (!/\d\s*단\s*[:：]|^\s*r(?:nd|ound)?\s*\d+\s*[:.]/i.test(text)) return null;
  const d = ctx.doc;
  const scope = roundScope(d);
  const res = parsePattern(text);
  const rounds = res.rounds.filter((r) => !r.foundation);
  if (!rounds.length) return null;
  const errs = res.lines.flatMap((l) => l.errors);
  if (errs.length) return { reply: `서술을 읽지 못했어요: ${errs.join(" / ")}` };
  const n0 = Number(rounds[0].label);
  const below = [...scope].reverse().find((x) => x.n < n0);
  if (!below) {
    if (n0 === 1) {
      const r = insertChart(d, res.rounds, { layout: res.layout, at: ctx.center, name: "서술도안", ring: res.layout === "radial" });
      return { doc: r.doc, select: [], reply: `${rounds.map((r) => r.label).join(", ")}단을 만들었어요. 단별 코 수 ${r.counts.join(", ")}` };
    }
    return { reply: `${n0}단 아래에 이어 붙일 단이 없어요.` };
  }
  // replace rounds that already exist with the same number
  const replaced = scope.filter((x) => rounds.some((r) => Number(r.label) === x.n)).map((x) => x.layer.id);
  const base: Doc = { ...d, layers: d.layers.filter((l) => !replaced.includes(l.id)) };
  const reparsed = parsePattern(text, { startCount: layerStitches(below.layer.items) });
  const r = appendRounds(base, below.layer, reparsed.rounds.filter((x) => !x.foundation), n0);
  if (!r) return { reply: "이어 붙일 단의 모양을 알 수 없어요." };
  const n = r.layers.reduce((s, l) => s + l.items.length, 0);
  return { doc: r.doc, select: [], reply: `${rounds.map((x) => x.label).join(", ")}단을 ${replaced.length ? "고쳐" : "넣어"} 반영했어요. 기호 ${n}개예요.` };
}

/** Interprets one message. */
export function interpret(input: string, ctx: AssistCtx): AssistResult {
  const text = input.trim().toLowerCase();
  if (!text) return { reply: helpText("무엇을 할까요?") };
  if (/도움|뭘\s*할|뭐.*(할|돼)|무엇을|help|사용법|명령/.test(text)) return { reply: helpText("이 어시스턴트는 서버 없이 브라우저에서 규칙으로 동작해요.") };
  if (/다시\s*실행|redo/.test(text)) return { action: "redo", reply: "다시 실행했어요." };
  if (/되돌|실행\s*취소|취소해|undo/.test(text)) return { action: "undo", reply: "한 단계 되돌렸어요." };
  if (/화면.*(맞|보)|전체\s*보기|\bfit\b/.test(text)) return { action: "fit", reply: "도안 전체가 보이게 맞췄어요." };

  const written = writtenLine(input, ctx);
  if (written) return written;

  if (/코\s*수|코수|몇\s*코|몇\s*개|stitch(es)?\s*count|how\s+many|세어/.test(text)) return { reply: counts(text, ctx) };

  if (/시작|만들|그려|떠\s*줘|짜\s*줘|넣어|start|make/.test(text)) {
    const gen = generate(text, ctx);
    if (gen) return gen;
  }

  const color = findColor(text);
  if (color && /(색|으로|로|칠|바꿔|변경|color|make)/.test(text)) {
    const t = resolveTarget(text, ctx, false);
    if ("error" in t) return { reply: t.error };
    let n = 0;
    const doc = mapItems(ctx.doc, t.ids, (it) => (n++, { ...it, color: color.hex }));
    return { doc, reply: `${t.label} ${n}개를 ${color.name}으로 바꿨어요.` };
  }

  if (/지워|지우|삭제|없애|빼\s*줘|빼줘|delete|remove/.test(text)) {
    const scope = roundScope(ctx.doc);
    const explicit = text.match(/(\d+)\s*단/g);
    if (explicit || /마지막\s*단/.test(text)) {
      const want = explicit ? explicit.map((x) => Number(x.match(/\d+/)![0])) : scope.length ? [scope[scope.length - 1].n] : [];
      const layers = scope.filter((x) => want.includes(x.n)).map((x) => x.layer);
      if (!layers.length) return { reply: `${want.join(", ") || "그"}단을 찾지 못했어요. 지금 있는 단: ${scope.map((x) => x.n).join(", ") || "없음"}` };
      const ids = new Set(layers.map((l) => l.id));
      const rest = ctx.doc.layers.filter((l) => !ids.has(l.id));
      const activeLayerId = rest.some((l) => l.id === ctx.doc.activeLayerId) ? ctx.doc.activeLayerId : (rest[rest.length - 1]?.id ?? "");
      return { doc: { ...ctx.doc, layers: rest, activeLayerId }, select: [], reply: `${layers.map((l) => l.name.replace(/단$/, "")).join(", ")}단을 지웠어요. 되돌리기로 다시 살릴 수 있어요.` };
    }
    const t = resolveTarget(text, ctx, false);
    if ("error" in t) return { reply: t.error };
    const doc = mapItems(ctx.doc, t.ids, () => null);
    return { doc, select: [], reply: `${t.label} ${t.ids.size}개를 지웠어요. 되돌리기로 다시 살릴 수 있어요.` };
  }

  const stitches = findStitches(text);
  if (stitches.length && /바꿔|바꾸|변경|교체|으로|로\s|로$|change|replace|→|->/.test(text) && !/추가|더\s*떠/.test(text)) {
    const to = stitches[stitches.length - 1].id;
    const from = stitches.length >= 2 ? stitches[0].id : null;
    const t = resolveTarget(text, ctx, true);
    if ("error" in t) return { reply: t.error };
    let n = 0;
    const doc = mapItems(ctx.doc, t.ids, (it) => {
      const r = swapStitch(it, from, to);
      if (r) n++;
      return r ?? it;
    });
    if (!n) return { reply: `${t.label}에 바꿀 ${from ? symbolName(from) : "기호"}가 없어요.` };
    return { doc, reply: `${t.label}의 ${from ? symbolName(from) : "코"} ${n}개를 ${symbolName(to)}로 바꿨어요. 발 위치는 그대로 두고 높이만 바뀌었어요.` };
  }

  if (/단/.test(text) && /추가|더|이어|계속|다음\s*단|늘려|줄여|만들어|append|add/.test(text) && roundScope(ctx.doc).length) return addRounds(text, ctx);

  const gen = /그래니|육각|꽃|원통|타원|아미구루미|평면|사각|스와치|공\s*모양|매직\s*링|원형/.test(text) ? generate(text, ctx) : null;
  if (gen) return gen;
  if (/단/.test(text) && /추가|더|이어|계속|다음/.test(text)) return addRounds(text, ctx);

  if (/선택/.test(text) && /해|골라|select/.test(text)) {
    const t = resolveTarget(text.replace(/선택/g, ""), ctx, true);
    if ("error" in t) return { reply: t.error };
    return { select: [...t.ids], reply: `${t.label} ${t.ids.size}개를 선택했어요.` };
  }

  return { reply: helpText("이 요청은 아직 처리할 수 없어요.") };
}
