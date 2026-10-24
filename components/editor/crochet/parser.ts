// Written crochet pattern → rounds. Deterministic: Korean terms and English abbreviations,
// one round (or row) per line, with repeats "(sc, inc) x6", "*…; rep from * 5 times", "6번 반복".
import { expandRound, type Layout, type Node, type Round } from "./chart";

export type LineResult = {
  line: number;
  text: string;
  kind: "round" | "foundation" | "skip";
  label?: string;
  produced?: number;
  expected?: number;
  errors: string[];
  warnings: string[];
};

export type ParseResult = { lines: LineResult[]; rounds: Round[]; layout: Layout; ring: boolean; foundation: number | null };

// ---------- normalisation ----------

const KO: [RegExp, string][] = [
  [/(\d+)\s*번째\s*(?:사슬|코)(?:에|부터)?/g, " skip@$1 "],
  [/다섯\s*길\s*긴\s*뜨기/g, " tall_5 "],
  [/네\s*길\s*긴\s*뜨기/g, " tall_4 "],
  [/세\s*길\s*긴\s*뜨기/g, " dtr "],
  [/두\s*길\s*긴\s*뜨기/g, " tr "],
  [/한\s*길\s*긴\s*뜨기/g, " dc "],
  [/긴\s*뜨기/g, " hdc "],
  [/짧은\s*뜨기/g, " sc "],
  [/빼\s*뜨기/g, " slst "],
  [/구슬\s*뜨기/g, " bobble "],
  [/팝콘\s*뜨기/g, " popcorn "],
  [/퍼프\s*뜨기/g, " puff "],
  [/피코\s*뜨기|피코/g, " picot "],
  [/매직\s*링|매직\s*서클|원형\s*코|원형\s*고리|링\s*코/g, " mr "],
  [/링\s*(?:안)?에/g, " in mr "],
  [/기둥\s*코/g, " "],
  [/사슬\s*뜨기|사슬/g, " ch "],
  [/(\d)\s*코\s*늘려\s*뜨기/g, " inc@$1 "],
  [/(\d)\s*코\s*모아\s*뜨기/g, " dec@$1 "],
  [/코\s*늘림|늘려\s*뜨기|늘리기|늘림/g, " inc "],
  [/코\s*줄임|모아\s*뜨기|줄여\s*뜨기|줄이기|줄임/g, " dec "],
  [/이랑\s*뜨기|뒷\s*고리|뒤\s*반코/g, " blo "],
  [/앞\s*고리|앞\s*반코/g, " flo "],
  [/앞\s*걸어/g, " fp "],
  [/뒤\s*걸어/g, " bp "],
  [/한길(?=\s*\d)/g, " dc "],
  [/두길(?=\s*\d)/g, " tr "],
  [/짧(?=\s*\d)/g, " sc "],
  [/긴(?=\s*\d)/g, " hdc "],
  [/빼(?=\s*\d)/g, " slst "],
  [/늘(?=\s*\d)/g, " inc "],
  [/모(?=\s*\d)/g, " dec "],
  [/사(?=\s*\d)/g, " ch "],
  [/(\d+)\s*(?:번|회)\s*반복/g, " rep $1 times "],
  [/반복\s*(\d+)\s*(?:번|회)/g, " rep $1 times "],
  [/(\d+)\s*(?:번|회|개|곳)/g, " x$1 "],
  [/각\s*코(?:에|마다)?|코마다|모든\s*코(?:에)?|한\s*바퀴|끝까지|나머지(?:\s*코)?(?:에)?/g, " around "],
  [/뒤집(?:기|어|고)?/g, " turn "],
  [/연결|이어\s*주기/g, " join "],
  [/실\s*자르기|마무리/g, " fo "],
  [/반복/g, " rep "],
  [/(\d+)\s*코/g, " $1 "],
];

const EN: [RegExp, string][] = [
  [/(\d+)\s*(?:st|nd|rd|th)\s+(?:ch|chain|st|stitch)\s+from\s+(?:the\s+)?hook/g, " skip@$1 "],
  [/half\s+double\s+crochets?/g, " hdc "],
  [/double\s+crochets?/g, " dc "],
  [/(?:treble|triple)\s+crochets?/g, " tr "],
  [/single\s+crochets?/g, " sc "],
  [/slip\s+stitch(?:es)?|sl\s*-?\s*st|\bss\b/g, " slst "],
  [/magic\s+(?:ring|circle|loop)|adjustable\s+ring|\bmc\b/g, " mr "],
  [/\bchains?\b/g, " ch "],
  [/invisible\s+dec(?:rease)?|inv\s*dec|invdec/g, " dec "],
  [/\bincreases?\b/g, " inc "],
  [/\bdecreases?\b/g, " dec "],
  [/\b(sc|hdc|dc|tr)\s*([2-9])\s*tog\b/g, " $1 dec@$2 "],
  [/\b(sc|hdc|dc|tr)([2-9])inc\b/g, " $1 inc@$2 "],
  [/ch\s*-\s*\d+\s*(?:sp|space)s?/g, " sp "],
  [/\brepeat\b/g, " rep "],
  [/\bfasten\s+off\b/g, " fo "],
  [/in\s+each\s+(?:st|stitch|ch)?\s*(?:around|across)?|\baround\b|\bacross\b|to\s+(?:the\s+)?end|\beach\b/g, " around "],
];

const STITCH_IDS = new Set(["sc", "hdc", "dc", "tr", "dtr", "tall_4", "tall_5", "trtr", "slst", "bobble", "popcorn", "puff", "picot", "fpdc", "bpdc", "fpsc", "bpsc", "fphdc", "bphdc", "fptr", "sc_blo", "hdc_blo", "dc_blo", "sc_flo", "hdc_flo", "dc_flo", "vst", "xdc", "cluster5", "shell5"]);
const ALIAS: Record<string, string> = { trtr: "tall_4", pc: "popcorn", cl: "bobble", "v-st": "vst" };
const MOD: Record<string, Record<string, string>> = {
  blo: { sc: "sc_blo", hdc: "hdc_blo", dc: "dc_blo" },
  flo: { sc: "sc_flo", hdc: "hdc_flo", dc: "dc_flo" },
  fp: { sc: "fpsc", hdc: "fphdc", dc: "fpdc", tr: "fptr" },
  bp: { sc: "bpsc", hdc: "bphdc", dc: "bpdc" },
};
/** words that only say where a stitch goes */
const TRAIL = new Set(["in", "into", "next", "same", "st", "sts", "stitch", "stitches", "the", "of", "from", "hook", "sp", "space", "spaces", "corner", "first", "last", "both", "loops", "loop", "top", "side", "other", "bottom", "beg", "beginning", "to", "work", "and", "on", "at", "remaining", "following"]);
const IGNORE = new Set([
  ...TRAIL, "turn", "join", "fo", "with", "then", "more", "times", "round", "rnd", "row", "end", "sk", "skip", "do", "not", "count", "counts", "as", "a", "an", "it", "made", "make", "sts.", "total", "x",
  "에", "에서", "으로", "로", "을", "를", "은", "는", "이", "가", "다음", "같은", "한", "씩", "마다", "번째", "시작", "하기", "해서", "하고", "뜨기", "뜹니다", "떠요", "뜨고", "코에", "코", "단", "합니다", "해요", "총", "위에", "안에", "사이", "공간", "모서리", "부분", "그대로", "없이", "만", "도", "의", "와", "과", "및", "후", "그리고", "에는", "까지",
]);

function normalize(s: string): string {
  let t = s.toLowerCase().replace(/[×✕✖＊]/g, " x ").replace(/[，、]/g, ",").replace(/[（［]/g, "(").replace(/[）］]/g, ")");
  for (const [re, to] of KO) t = t.replace(re, to);
  for (const [re, to] of EN) t = t.replace(re, to);
  t = t.replace(/\b(sc|hdc|dc|tr|dtr|ch|slst|inc|dec|x|rep)(\d+)\b/g, "$1 $2").replace(/\b(\d+)(sc|hdc|dc|tr|dtr|ch|slst|inc|dec)\b/g, "$1 $2");
  t = t.replace(/\*\s*(\d+)/g, " x $1 ");
  return t;
}

type Tok = { t: "num"; v: number } | { t: "word"; v: string } | { t: "punct"; v: string };

function tokenize(s: string): Tok[] {
  const out: Tok[] = [];
  const re = /\d+|[a-z_@\-]+\d*|[가-힣]+|[()[\]{}*,;:]|\S/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(s))) {
    const v = m[0];
    if (/^\d+$/.test(v)) out.push({ t: "num", v: Number(v) });
    else if (/^[()[\]{}*,;:]$/.test(v)) out.push({ t: "punct", v });
    else if (/^[.\-–~=→>·]$/.test(v)) continue;
    else out.push({ t: "word", v });
  }
  return out;
}

// ---------- line parser ----------

class LineParser {
  i = 0;
  unknown: string[] = [];
  skip = 0;
  turn = false;
  constructor(private toks: Tok[]) {}
  peek(o = 0) {
    return this.toks[this.i + o];
  }
  isWord(t: Tok | undefined, ...ws: string[]) {
    return !!t && t.t === "word" && (ws.length === 0 || ws.includes(t.v));
  }
  isPunct(t: Tok | undefined, ...ps: string[]) {
    return !!t && t.t === "punct" && ps.includes(t.v);
  }
  num(): number | undefined {
    const t = this.peek();
    if (t?.t === "num") {
      this.i++;
      return t.v;
    }
    return undefined;
  }
  /** "x6", "x 6", "6 times" after an item */
  repeatCount(): number | undefined {
    const t = this.peek();
    if (this.isWord(t, "x") && this.peek(1)?.t === "num") {
      this.i += 2;
      return (this.toks[this.i - 1] as { v: number }).v;
    }
    if (t?.t === "word" && /^x\d+$/.test(t.v)) {
      this.i++;
      return Number(t.v.slice(1));
    }
    if (t?.t === "num" && this.isWord(this.peek(1), "times") && !this.isWord(this.peek(2), "rep")) {
      this.i += 2;
      return t.v;
    }
    return undefined;
  }

  seq(close?: string): Node[] {
    const items: Node[] = [];
    while (this.i < this.toks.length) {
      const t = this.peek()!;
      if (t.t === "punct") {
        if (close && t.v === close) {
          this.i++;
          return items;
        }
        if (t.v === "(" || t.v === "[" || t.v === "{") {
          this.i++;
          const inner = this.seq(t.v === "(" ? ")" : t.v === "[" ? "]" : "}");
          items.push(this.withRepeat({ k: "rep", nodes: inner, n: 1 }));
          continue;
        }
        if (t.v === "*") {
          this.i++;
          const inner = this.seq("*rep");
          items.push(this.starRepeat(inner));
          continue;
        }
        this.i++; // , ; : and stray closers
        continue;
      }
      // whole-sequence repeat: "rep 6 times", "6 times rep" (= 6번 반복)
      if (this.isWord(t, "rep") || (t.t === "num" && this.isWord(this.peek(1), "times") && this.isWord(this.peek(2), "rep"))) {
        if (close === "*rep") return items;
        let n: number | undefined;
        if (t.t === "num") {
          n = t.v;
          this.i += 3;
        } else {
          this.i++;
          while (this.isWord(this.peek(), "from") || this.isPunct(this.peek(), "*")) this.i++;
          n = this.num() ?? this.repeatCount();
          if (this.isWord(this.peek(), "x") && this.peek(1)?.t === "num") n = this.repeatCount();
          if (this.isWord(this.peek(), "times")) this.i++;
        }
        if (this.isWord(this.peek(), "around")) {
          this.i++;
          const last = items.length - 1;
          const g = [...items].reverse().find((x) => x.k === "rep");
          if (g) items[items.lastIndexOf(g)] = { k: "fill", node: g };
          else if (last >= 0) items.splice(0, items.length, { k: "fill", node: { k: "rep", nodes: [...items], n: 1 } });
          continue;
        }
        const times = n ?? 2;
        const g = [...items].reverse().find((x) => x.k === "rep") as Extract<Node, { k: "rep" }> | undefined;
        if (g) g.n = g.n * times;
        else if (items.length) items.splice(0, items.length, { k: "rep", nodes: [...items], n: times });
        continue;
      }
      const term = this.term(items);
      if (term) items.push(...term);
    }
    return items;
  }

  withRepeat(node: Node): Node {
    const n = this.repeatCount();
    if (n !== undefined && node.k === "rep") return { ...node, n: node.n * n };
    if (n !== undefined) return { k: "rep", nodes: [node], n };
    if (this.isWord(this.peek(), "around")) {
      this.i++;
      return { k: "fill", node };
    }
    return node;
  }

  starRepeat(inner: Node[]): Node {
    // after "*…" we stand on "rep"
    if (this.isWord(this.peek(), "rep")) this.i++;
    while (this.isWord(this.peek(), "from") || this.isPunct(this.peek(), "*")) this.i++;
    if (this.isWord(this.peek(), "around")) {
      this.i++;
      return { k: "fill", node: { k: "rep", nodes: inner, n: 1 } };
    }
    let n = this.num() ?? this.repeatCount() ?? 1;
    let more = false;
    while (this.isWord(this.peek(), "more", "times", "x")) {
      if (this.isWord(this.peek(), "more")) more = true;
      this.i++;
    }
    if (more) n += 1;
    return { k: "rep", nodes: inner, n: Math.max(1, n) };
  }

  /** One stitch term, e.g. "6 sc", "sc 6", "2 sc in next st", "sc inc x6", "ch 3", "mr". */
  term(prev: Node[]): Node[] | null {
    const a = this.num();
    let t = this.peek();
    if (!t || t.t !== "word") {
      // a lone number: right after a magic ring it is "6 sc in the ring", otherwise a repeat count
      if (a !== undefined) {
        const last = prev[prev.length - 1];
        if (last?.k === "ring") return [{ k: "st", sym: "sc", n: a }];
      }
      return null;
    }
    let mod: string | undefined;
    if (MOD[t.v] && this.peek(1)?.t === "word") {
      mod = t.v;
      this.i++;
      t = this.peek()!;
    }
    const w = (t as { v: string }).v;
    this.i++;

    if (w.startsWith("skip@")) {
      this.skip = Math.max(0, Number(w.slice(5)) - 1);
      return null;
    }
    if (w === "turn") {
      this.turn = true;
      return null;
    }
    if (w === "mr") {
      const out: Node[] = [{ k: "ring" }];
      const b = this.peek();
      if (b?.t === "num" && (!this.peek(1) || this.isPunct(this.peek(1), ",", ";", ")") || this.isWord(this.peek(1), "around"))) {
        this.i++;
        out.push({ k: "st", sym: "sc", n: b.v });
      }
      return out;
    }
    if (w === "ch") {
      const b = this.num();
      this.trail();
      return [this.withRepeat({ k: "ch", n: Math.max(1, b ?? a ?? 1) })];
    }
    const gatherWord = (x: string) => /^(inc|dec)(@\d)?$/.test(x);
    const gather = (word: string, leg: string, n: number): Extract<Node, { k: "inc" | "dec" }> => {
      const legs = word.includes("@") ? Math.max(2, Number(word.split("@")[1])) : 2;
      return word.startsWith("inc") ? { k: "inc", leg, legs, n } : { k: "dec", leg, legs, n };
    };
    if (gatherWord(w)) {
      const b = this.num();
      const tr = this.trail();
      const node = gather(w, "sc", Math.max(1, b ?? a ?? 1));
      return [tr.around ? { k: "fill", node: { ...node, n: 1 } } : this.withRepeat(node)];
    }
    let sym = ALIAS[w] ?? w;
    if (STITCH_IDS.has(sym)) {
      if (mod) sym = MOD[mod][sym] ?? sym;
      const nxt = this.peek();
      if (nxt?.t === "word" && gatherWord(nxt.v)) {
        this.i++;
        const b = this.num();
        const tr = this.trail();
        const node = gather(nxt.v, sym, Math.max(1, b ?? a ?? 1));
        return [tr.around ? { k: "fill", node: { ...node, n: 1 } } : this.withRepeat(node)];
      }
      const b = this.peek()?.t === "num" && !this.isWord(this.peek(1), "times") ? this.num() : undefined;
      const tr = this.trail();
      const out: Node[] = [];
      if (tr.ring) out.push({ k: "ring" });
      const count = b ?? a ?? 1;
      if (tr.around) {
        // "2 sc in each st around" is an increase in every stitch
        const node: Node = a && a >= 2 && b === undefined ? { k: "inc", leg: sym, legs: a, n: 1 } : { k: "st", sym, n: 1 };
        out.push({ k: "fill", node });
        return out;
      }
      if (tr.into && a && a >= 2 && b === undefined && !tr.ring && !tr.space) {
        out.push(this.withRepeat({ k: "inc", leg: sym, legs: Math.min(9, a), n: 1 }));
        return out;
      }
      out.push(this.withRepeat({ k: "st", sym, n: Math.max(1, count) }));
      return out;
    }
    if (w === "around") return null;
    if (!IGNORE.has(w) && !/^\d/.test(w)) this.unknown.push(w);
    return null;
  }

  /** Words after a stitch that say where it goes ("in next st", "in each st around", "in mr"). */
  trail() {
    const r = { around: false, into: false, ring: false, space: false };
    let prevTrail = false;
    while (this.i < this.toks.length) {
      const t = this.peek()!;
      if (t.t !== "word") break;
      if (t.v === "around") r.around = true;
      else if (t.v === "mr") r.ring = true;
      else if (t.v === "sp" || t.v === "space" || t.v === "corner") r.space = true;
      else if (t.v.startsWith("skip@")) this.skip = Math.max(0, Number(t.v.slice(5)) - 1);
      else if (t.v === "ch" && prevTrail) {
        /* "in next ch": the chain worked into */
      } else if (TRAIL.has(t.v)) {
        if (t.v === "in" || t.v === "into" || t.v === "next" || t.v === "same") r.into = true;
      } else break;
      prevTrail = true;
      this.i++;
    }
    return r;
  }
}

// ---------- labels and counts ----------

const LABEL_RES: RegExp[] = [
  /^\s*(?:r|rnd|rnds|round|rounds|row|rows)\s*\.?\s*(\d+)(?:\s*(?:-|–|~|to)\s*(\d+))?\s*[:.)\-–]?\s*/i,
  /^\s*(\d+)(?:\s*[-–~]\s*(\d+))?\s*(?:단|열|줄)\s*(?:째)?\s*[:.)\-–]?\s*/,
  /^\s*(\d+)(?:\s*[-–~]\s*(\d+))?\s*[:.)]\s+/,
];
const FOUNDATION_RE = /^\s*(?:기초\s*(?:사슬|코)?|바닥|시작\s*코|foundation(?:\s+chain)?|row\s*0|0\s*단)\s*[:.)\-–]?\s*/i;
const EXPECTED_RES: RegExp[] = [
  /[([]\s*(?:총\s*|=\s*)?(\d+)\s*(?:코|sts?|stitches|st\.?)?\s*[)\]]\s*[.。]?\s*$/i,
  /(?:=|→|->|—|–)\s*(\d+)\s*(?:코|sts?|stitches)?\s*[.。]?\s*$/i,
  /\s총\s*(\d+)\s*코\s*[.。]?\s*$/,
];

const ROW_WORDS = /\brows?\b|\bturn\b|뒤집/i;
const OVAL_WORDS = /other\s+side|반대\s*(?:쪽|편)|양\s*(?:쪽|끝)|타원|\boval\b/i;
const RING_WORDS = /\bjoin\b|연결|고리로|이어/i;

/** Parses a written pattern; `prevFor` lets callers continue from an existing round count. */
export function parsePattern(text: string, opts: { startCount?: number; startLabel?: number } = {}): ParseResult {
  const lines: LineResult[] = [];
  const rounds: Round[] = [];
  let prev = opts.startCount ?? 0;
  let nextLabel = opts.startLabel ?? 1;
  let foundation: number | null = null;
  let anyRing = false;
  let anyRow = false;

  text.split(/\r?\n/).forEach((raw, idx) => {
    const lineNo = idx + 1;
    const src = raw.trim();
    if (!src) return;
    let rest = src;
    let from: number | null = null, to: number | null = null;
    let isFoundation = false;
    if (FOUNDATION_RE.test(rest)) {
      isFoundation = true;
      rest = rest.replace(FOUNDATION_RE, "");
    } else {
      for (const re of LABEL_RES) {
        const m = rest.match(re);
        if (m) {
          from = Number(m[1]);
          to = m[2] ? Number(m[2]) : from;
          rest = rest.slice(m[0].length);
          break;
        }
      }
    }
    let expected: number | undefined;
    for (const re of EXPECTED_RES) {
      const m = rest.match(re);
      if (m) {
        expected = Number(m[1]);
        rest = rest.slice(0, m.index).trim();
        break;
      }
    }
    if (ROW_WORDS.test(src)) anyRow = true;
    const p = new LineParser(tokenize(normalize(rest)));
    const nodes = p.seq();
    const errors: string[] = [];
    const warnings: string[] = [];
    if (p.unknown.length) errors.push(`인식하지 못한 용어 ${p.unknown.length}개: ${[...new Set(p.unknown)].slice(0, 6).join(", ")}`);
    const hasStitch = nodes.length > 0;
    const chainOnly = hasStitch && nodes.every((n) => n.k === "ch");
    if (!hasStitch) {
      if (from !== null || isFoundation) lines.push({ line: lineNo, text: src, kind: "round", label: from !== null ? String(from) : "바닥", errors: errors.length ? errors : ["코 단위 정보를 찾지 못했어요"], warnings });
      else lines.push({ line: lineNo, text: src, kind: "skip", errors, warnings });
      return;
    }
    if (nodes.some((n) => n.k === "ring")) anyRing = true;
    // a bare chain line before the first round is the chain base
    if (isFoundation || (chainOnly && from === null && !rounds.some((r) => !r.foundation)) || (from === 0 && chainOnly)) {
      const n = nodes.reduce((s, x) => s + (x.k === "ch" ? x.n : 0), 0);
      foundation = n;
      const r: Round = { label: "0", nodes: [{ k: "ch", n }], foundation: true, expected };
      rounds.push(r);
      prev = n;
      lines.push({ line: lineNo, text: src, kind: "foundation", label: "바닥", produced: n, expected, errors, warnings });
      return;
    }
    const start = from ?? nextLabel;
    const end = Math.min(to ?? start, start + 60);
    for (let k = start; k <= end; k++) {
      const r: Round = { label: String(k), nodes: structuredClone(nodes), expected, skip: p.skip || undefined };
      const e = expandRound(r, prev);
      const w = [...warnings];
      const errs = [...errors];
      if (e.fillMissing) errs.push("앞 단 코 수를 알 수 없어 '한 바퀴'를 채우지 못했어요");
      if (expected !== undefined && expected !== e.produced) w.push(`${k}단 원문 ${expected} / 계산 ${e.produced}`);
      else if (prev > 0 && !e.chains && !e.fillMissing && e.consumed !== prev && !e.ring && rounds.length && !rounds[rounds.length - 1].foundation && !expandRound(rounds[rounds.length - 1], 0).chains)
        w.push(`이전 단 ${prev}코 위에 ${e.consumed}코를 떠요`);
      rounds.push(r);
      lines.push({ line: lineNo, text: src, kind: "round", label: String(k), produced: e.produced, expected, errors: errs, warnings: w });
      prev = e.produced;
    }
    nextLabel = end + 1;
  });

  const all = text;
  let layout: Layout = "radial";
  if (foundation !== null) {
    const firstRound = rounds.find((r) => !r.foundation);
    const firstCount = firstRound ? expandRound(firstRound, foundation).produced : 0;
    if (OVAL_WORDS.test(all) || firstCount >= foundation * 1.6) layout = "oval";
    else if (RING_WORDS.test(all) && !ROW_WORDS.test(all)) layout = "radial";
    else layout = "linear";
  } else if (anyRow && !anyRing) layout = "linear";
  return { lines, rounds, layout, ring: anyRing, foundation };
}
