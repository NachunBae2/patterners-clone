// Written knitting instructions → chart grid. Deterministic, local, rule based.
//
//   "1단: 겉뜨기 3, 안뜨기 2 반복"      "Row 1 (RS): k2, p2; rep to end"
//   "2단: 안뜨기"                       "Row 2 and all WS rows: purl"
//   "(겉2, 안2)×3, 겉1"                 "*k1, yo, k2tog; rep from * to last st, k1"
//
// Rows are numbered from the bottom (row 1 = first row worked). Right-side rows are read right → left on the
// chart, wrong-side rows left → right, and a stitch worked on the wrong side is charted as it looks from the
// right side (purl on WS = knit square), as chart readers expect.
import { KNIT_SYMBOLS, knitSymbol } from "@/lib/symbols/knitting";
import type { KnitCell } from "@/lib/types";
import type { Block } from "./model";

export type Side = "RS" | "WS";
export type ParseOptions = {
  worked: "auto" | "flat" | "round";
  firstRowSide: Side;
  /** how right-side rows are read on the chart */
  readOrder: "rtl" | "ltr";
  /** stitch count to start with; null = from the text */
  width: number | null;
  /** user choices for terms the dictionary did not know */
  mapping: Record<string, string>;
};
export const DEFAULT_PARSE: ParseOptions = { worked: "auto", firstRowSide: "RS", readOrder: "rtl", width: null, mapping: {} };

export type RowReport = {
  row: number;
  side: Side;
  /** stitches on the needle before / after this row */
  before: number;
  after: number;
  cells: number;
  line: number | null;
  issues: string[];
};
export type LineReport = { line: number; text: string; kind: "row" | "rule" | "repeat" | "cast" | "note" | "error"; label: string; issues: string[] };
export type ParseResult = {
  block: Block | null;
  cols: number;
  rows: number;
  worked: "flat" | "round";
  firstRowSide: Side;
  lines: LineReport[];
  rowReports: RowReport[];
  unknown: string[];
  clamped: boolean;
};

const MAX = 400;

// ---------------- dictionary ----------------

type Term = { re: RegExp; id: (m: RegExpMatchArray) => string | null; /** counts that are part of the term itself (k2tog) */ fixed?: boolean };

const cableId = (a: number, b: number, rightCross: boolean, purl: boolean, centre?: number) => {
  // catalogue: "lc…" = 왼코 위 = RC, "rc…" = 오른코 위 = LC
  const base = rightCross ? "lc" : "rc";
  if (centre !== undefined) return `k_${base}${a}${centre}${b}${purl ? "cp" : "ck"}`;
  if (a === 1 && b === 1) return `k_${base}${purl ? "_p" : ""}`;
  return `k_${base}${a}${b}${purl ? "_p" : ""}`;
};

const B = "(?![a-z가-힣])";
const T = (src: string, id: string | ((m: RegExpMatchArray) => string | null), fixed = false): Term => ({ re: new RegExp("^(?:" + src + ")", "i"), id: typeof id === "string" ? () => id : id, fixed });

const TERMS: Term[] = [
  // ----- English: decreases, increases and cables first (they contain k/p) -----
  T(`k(\\d)\\s*tog\\s*tbl${B}`, (m) => `k_k${m[1]}tog_tbl`, true),
  T(`p(\\d)\\s*tog\\s*tbl${B}`, (m) => `k_p${m[1]}tog_tbl`, true),
  T(`k(\\d)\\s*tog${B}`, (m) => `k_k${m[1]}tog`, true),
  T(`p(\\d)\\s*tog${B}`, (m) => `k_p${m[1]}tog`, true),
  T(`sssk${B}`, "k_ssk3", true),
  T(`sssp${B}`, "k_ssp3", true),
  T(`ssk${B}`, "k_ssk", true),
  T(`ssp${B}`, "k_ssp", true),
  T(`skp${B}|sl\\s*1,?\\s*k\\s*1,?\\s*psso${B}`, "k_ssk", true),
  T(`sk2p${B}|sl\\s*1,?\\s*k2tog,?\\s*psso${B}`, "k_sk2p", true),
  T(`s2kp2?${B}|cdd${B}|centered double decrease${B}`, "k_cdd3", true),
  T(`kfbf${B}`, "k_kfbf", true),
  T(`kfb${B}|k1fb${B}`, "k_kfb", true),
  T(`pfb${B}`, "k_pfb", true),
  T(`m1lp${B}`, "k_m1lp", true),
  T(`m1rp${B}`, "k_m1rp", true),
  T(`m1r${B}`, "k_m1r", true),
  T(`m1l?${B}|make one${B}`, "k_m1l", true),
  T(`lli${B}`, "k_lli", true),
  T(`rli${B}`, "k_rli", true),
  T(`(\\d)\\/(\\d)\\/(\\d)\\s*(r|l)(p)?c${B}`, (m) => cableId(+m[1], +m[3], m[4].toLowerCase() === "r", !!m[5], +m[2]), true),
  T(`(\\d)\\/(\\d)\\s*(r|l)(p)?c${B}`, (m) => cableId(+m[1], +m[2], m[3].toLowerCase() === "r", !!m[4]), true),
  T(`c(\\d{1,2})\\s*([bf])${B}`, (m) => {
    const n = +m[1];
    return cableId(Math.ceil(n / 2), Math.floor(n / 2), m[2].toLowerCase() === "b", false);
  }, true),
  T(`rt${B}|right twist${B}`, "k_lc", true),
  T(`lt${B}|left twist${B}`, "k_rc", true),
  T(`yo2${B}|double yo${B}`, "k_yo2", true),
  T(`yo${B}|yarn\\s*over${B}|yfwd${B}`, "k_yo"),
  T(`k\\s*tbl${B}|k(?=\\d+\\s*tbl)`, "k_twist_k"),
  T(`p\\s*tbl${B}|p(?=\\d+\\s*tbl)`, "k_twist_p"),
  T(`sl(?:ip)?\\s*(?=\\d*\\s*(?:sts?\\s*)?(?:p-?wise\\s*)?wyif)`, "k_slip_p"),
  T(`sl(?:ip)?\\s*(?=\\d*\\s*(?:sts?\\s*)?k-?wise)`, "k_slip_k"),
  T(`sl(?:ip)?${B}|sl(?=\\d)`, "k_slip"),
  T(`bo${B}|bind[- ]?off${B}|cast[- ]?off${B}`, "k_bind_off"),
  T(`mb${B}|make bobble${B}|bobble${B}`, "k_bobble"),
  T(`pm${B}|place marker${B}`, "k_pm", true),
  T(`sm${B}|slip marker${B}`, "k_sm", true),
  T(`w&t${B}|wrap and turn${B}`, "k_wrap_turn", true),
  T(`no stitch${B}|ns${B}`, "k_blank"),
  T(`knit${B}|k${B}|k(?=\\d)`, "k_knit"),
  T(`purl${B}|p${B}|p(?=\\d)`, "k_purl"),

  // ----- Korean -----
  T(`왼코\\s*겹쳐\\s*(\\d)\\s*코\\s*모아\\s*안\\s*뜨기`, (m) => `k_p${m[1]}tog`, true),
  T(`오른코\\s*겹쳐\\s*(\\d)\\s*코\\s*모아\\s*안\\s*뜨기`, (m) => (m[1] === "2" ? "k_ssp" : `k_ssp${m[1]}`), true),
  T(`왼코\\s*겹쳐\\s*(\\d)\\s*코\\s*모아\\s*뜨기`, (m) => `k_k${m[1]}tog`, true),
  T(`오른코\\s*겹쳐\\s*(\\d)\\s*코\\s*모아\\s*뜨기`, (m) => (m[1] === "2" ? "k_ssk" : `k_ssk${m[1]}`), true),
  T(`중심\\s*(\\d)\\s*코\\s*모아\\s*안\\s*뜨기`, (m) => `k_cddp${m[1]}`, true),
  T(`중심\\s*(\\d)\\s*코\\s*모아\\s*뜨기`, (m) => `k_cdd${m[1]}`, true),
  T(`(\\d)\\s*코\\s*모아\\s*안\\s*뜨기`, (m) => `k_p${m[1]}tog`, true),
  T(`(\\d)\\s*코\\s*모아\\s*뜨기`, (m) => `k_k${m[1]}tog`, true),
  T(`왼코\\s*위\\s*(\\d)\\s*코\\s*교차\\s*뜨기`, (m) => cableId(+m[1], +m[1], true, false), true),
  T(`오른코\\s*위\\s*(\\d)\\s*코\\s*교차\\s*뜨기`, (m) => cableId(+m[1], +m[1], false, false), true),
  T(`왼코\\s*늘리기`, "k_m1l", true),
  T(`오른코\\s*늘리기`, "k_m1r", true),
  T(`코\\s*늘리기|돌려\\s*늘리기`, "k_m1l", true),
  T(`바늘\\s*비우기|걸기\\s*코`, "k_yo"),
  T(`걸러\\s*뜨기`, "k_slip"),
  T(`꼬아\\s*안\\s*뜨기|안\\s*뜨기\\s*꼬아\\s*뜨기`, "k_twist_p"),
  T(`꼬아\\s*(?:겉)?\\s*뜨기|겉\\s*뜨기\\s*꼬아\\s*뜨기`, "k_twist_k"),
  T(`방울\\s*뜨기|방울`, "k_bobble"),
  T(`덮어\\s*씌우기|코\\s*막음|코\\s*막기`, "k_bind_off"),
  T(`빈\\s*칸|코\\s*없음`, "k_blank"),
  T(`안\\s*뜨기|안(?=\\s*\\d|\\s*$|\\s*[,;)\\]])`, "k_purl"),
  T(`겉\\s*뜨기|메리야스\\s*뜨기|겉(?=\\s*\\d|\\s*$|\\s*[,;)\\]])`, "k_knit"),
];

/** names and abbreviations from the symbol catalogue, matched as a whole piece ("SSK", "2/2 RC", "바늘비우기 꼬아뜨기 (yo tbl)") */
const NAMES = (() => {
  const m = new Map<string, string>();
  const norm = (s: string) => s.toLowerCase().replace(/\s+/g, "");
  for (const s of KNIT_SYMBOLS) {
    if (s.group === "chars" || s.id === "k_empty") continue;
    const full = s.name;
    const head = full.replace(/\s*\(.*\)\s*$/, "");
    const paren = /\(([^()]+)\)\s*$/.exec(full)?.[1];
    for (const n of [full, head, paren]) if (n && !m.has(norm(n))) m.set(norm(n), s.id);
  }
  return { get: (s: string) => m.get(norm(s)) };
})();

// ---------------- instruction tree ----------------

type Count = number | "fill" | { last: number };
type Node = { t: "st"; id: string; n: Count } | { t: "group"; items: Node[]; n: Count };

const FILL_WORDS = /^(?:to end|across|to the end|until end|all(?: sts| stitches)?|끝까지|나머지(?:\s*코)?(?:\s*(?:모두|전부))?|남은\s*코\s*(?:모두|전부)?|모두|전부|전체)$/i;
const LAST_RE = /^(?:to last|until last|to the last)\s*(\d+)?\s*(?:sts?|stitches)?$|^마지막\s*(\d+)\s*코\s*(?:남을\s*때까지|전까지)$/i;

/** count text right after a term */
function readCount(rest: string): { n: Count | null; rest: string } {
  const s = rest.trimStart();
  let m: RegExpMatchArray | null;
  if ((m = s.match(/^[x×*]?\s*(\d{1,3})\s*(?:코|번|회|sts?|stitches|times)?(?![\d/])/i))) return { n: +m[1], rest: s.slice(m[0].length) };
  if ((m = s.match(/^(to end|across|to the end|끝까지|나머지|모두|전부)/i))) return { n: "fill", rest: s.slice(m[0].length) };
  if ((m = s.match(/^(?:to last|until last|to the last)\s*(\d+)?\s*(?:sts?|stitches)?/i))) return { n: { last: +(m[1] ?? 1) }, rest: s.slice(m[0].length) };
  return { n: null, rest: s };
}

export class TermError extends Error {
  constructor(public term: string) {
    super(term);
  }
}

/** one comma-separated piece → stitches (it may hold several, e.g. "k2 p2") */
function parsePiece(piece: string, mapping: Record<string, string>): Node[] {
  const out: Node[] = [];
  let s = piece.trim().replace(/[.。]$/, "");
  if (!s) return out;
  // whole piece is a fill word for the previous stitch ("k to end" splits as "k", "to end" only when typed with a comma)
  const mapped = mapping[s.toLowerCase()];
  if (mapped) return [{ t: "st", id: mapped, n: 1 }];
  // "3코 겉뜨기" / "3 knit"
  let lead: number | null = null;
  const lm = s.match(/^(\d{1,3})\s*(?:코|sts?)\s+/i);
  if (lm) {
    lead = +lm[1];
    s = s.slice(lm[0].length);
  }
  const whole = NAMES.get(s.replace(/\s*\d+\s*(?:코)?$/, ""));
  if (whole && !/^(k|p)$/i.test(s)) {
    const cnt = s.match(/\s(\d+)\s*(?:코)?$/);
    const node: Node & { bare?: boolean } = { t: "st", id: whole, n: lead ?? (cnt ? +cnt[1] : 1) };
    if (lead === null && !cnt) node.bare = true;
    return [node];
  }
  let guard = 0;
  while (s && guard++ < 40) {
    let hit: { id: string; len: number; fixed: boolean } | null = null;
    for (const term of TERMS) {
      const m = s.match(term.re);
      if (!m) continue;
      const id = term.id(m);
      if (id && knitSymbol(id)) {
        hit = { id: knitSymbol(id)!.id, len: m[0].length, fixed: !!term.fixed };
        break;
      }
    }
    if (!hit) {
      const word = s.split(/[\s,]/)[0];
      const key = word.toLowerCase();
      if (mapping[key]) {
        s = s.slice(word.length);
        const c = readCount(s);
        out.push({ t: "st", id: mapping[key], n: lead ?? c.n ?? 1 });
        s = c.rest.trim();
        lead = null;
        continue;
      }
      throw new TermError(s.trim().split(/\s+/).slice(0, 3).join(" "));
    }
    s = s.slice(hit.len);
    const c = readCount(s);
    out.push({ t: "st", id: hit.id, n: lead ?? c.n ?? (hit.fixed ? 1 : null) ?? 1 });
    // remember whether a count was written at all: a lone "purl" fills the row
    if (c.n === null && lead === null && !hit.fixed) (out[out.length - 1] as { bare?: boolean }).bare = true;
    s = c.rest.replace(/^[\s,;·]+/, "");
    lead = null;
  }
  return out;
}

/** splits on commas / semicolons outside brackets */
function splitTop(s: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let cur = "";
  for (const ch of s) {
    if ("([{".includes(ch)) depth++;
    if (")]}".includes(ch)) depth = Math.max(0, depth - 1);
    if (depth === 0 && /[,;、，；]/.test(ch)) {
      out.push(cur);
      cur = "";
    } else cur += ch;
  }
  out.push(cur);
  return out.map((x) => x.trim()).filter(Boolean);
}

/** repeat count written after a group: "x3", "×3", "3 times", "3번 반복", "반복" (= to end), "rep to end" */
function readRepeat(rest: string): { n: Count | null; rest: string } {
  const s = rest.trim();
  let m: RegExpMatchArray | null;
  if ((m = s.match(/^[x×*]\s*(\d{1,3})(?:\s*(?:번|회|times))?(?:\s*반복)?/i))) return { n: +m[1], rest: s.slice(m[0].length) };
  if ((m = s.match(/^(\d{1,3})\s*(?:번|회|times)(?:\s*반복)?/i))) return { n: +m[1], rest: s.slice(m[0].length) };
  if ((m = s.match(/^(?:(?:끝까지|나머지)\s*)?반복|^(?:rep(?:eat)?)?\s*(?:to end|across)|^rep(?:eat)?(?=\s*$)/i))) return { n: "fill", rest: s.slice(m[0].length) };
  if ((m = s.match(/^(?:rep(?:eat)?\s*)?(?:to last|until last)\s*(\d+)?\s*(?:sts?|stitches)?/i))) return { n: { last: +(m[1] ?? 1) }, rest: s.slice(m[0].length) };
  return { n: null, rest: s };
}

function parseSeq(body: string, mapping: Record<string, string>): Node[] {
  let s = body.trim();
  // "*k1, p1; rep from * to end" / "*겉1, 안1* 반복"
  const star = s.match(/^(.*?)\*(.+?)(?:\*|;|,)\s*(?:rep(?:eat)?\s*(?:from\s*\*)?|반복)\s*(.*)$/i);
  if (star && s.includes("*")) {
    const before = star[1];
    const inner = star[2];
    let tail = star[3].trim();
    let n: Count = "fill";
    let m: RegExpMatchArray | null;
    if ((m = tail.match(/^(\d+)\s*(more\s+)?times?/i))) {
      n = +m[1] + (m[2] ? 1 : 0);
      tail = tail.slice(m[0].length);
    } else if ((m = tail.match(/^(?:to last|until last)\s*(\d+)?\s*(?:sts?|stitches)?/i))) {
      n = { last: +(m[1] ?? 1) };
      tail = tail.slice(m[0].length);
    } else if ((m = tail.match(/^(?:to end|across|끝까지)/i))) tail = tail.slice(m[0].length);
    tail = tail.replace(/^[\s,;.]+/, "");
    return [...(before.trim() ? parseSeq(before.replace(/[,;]\s*$/, ""), mapping) : []), { t: "group", items: parseSeq(inner, mapping), n }, ...(tail ? parseSeq(tail, mapping) : [])];
  }
  const out: Node[] = [];
  let groupStart = 0;
  for (let piece of splitTop(s)) {
    // bracket group
    const g = piece.match(/^[([{](.+)[)\]}](.*)$/);
    if (g) {
      const r = readRepeat(g[2]);
      out.push({ t: "group", items: parseSeq(g[1], mapping), n: r.n ?? 1 });
      if (r.rest.trim()) out.push(...parseSeq(r.rest, mapping));
      continue;
    }
    if (FILL_WORDS.test(piece) && out.length) {
      const last = out[out.length - 1];
      last.n = "fill";
      continue;
    }
    const lm = piece.match(LAST_RE);
    if (lm && out.length) {
      out[out.length - 1].n = { last: +(lm[1] ?? lm[2] ?? 1) };
      continue;
    }
    // "k to last 2 sts" inside one piece
    const inl = piece.match(/^(.*?)\s+(?:to last|until last)\s*(\d+)?\s*(?:sts?|stitches)?$/i);
    if (inl) {
      const nodes = parsePiece(inl[1], mapping);
      if (nodes.length) nodes[nodes.length - 1].n = { last: +(inl[2] ?? 1) };
      out.push(...nodes);
      continue;
    }
    // "겉뜨기 3, 안뜨기 2 반복(, 겉뜨기 4)": everything since the last group repeats to fill the row
    let rep: Count | null = null;
    piece = piece
      .replace(/\s*(?:끝까지\s*|나머지\s*)?반복$/, () => ((rep = "fill"), ""))
      .replace(/\s*;?\s*rep(?:eat)?\s*(?:to end|across)?$/i, () => ((rep = "fill"), ""))
      .replace(/\s*;?\s*rep(?:eat)?\s*(?:to last|until last)\s*(\d+)?\s*(?:sts?|stitches)?$/i, (_, n) => ((rep = { last: +(n ?? 1) }), ""));
    if (piece.trim()) out.push(...parsePiece(piece, mapping));
    if (rep !== null && out.length > groupStart) {
      const items = out.splice(groupStart);
      out.push({ t: "group", items, n: rep });
      groupStart = out.length;
    }
  }
  return out;
}

// ---------------- stitch arithmetic ----------------

/** stitches a symbol uses from the needle and leaves on it */
function stitchMath(id: string): { use: number; make: number } {
  const k = id.slice(2);
  let m: RegExpMatchArray | null;
  if ((m = k.match(/^(?:k|p)(\d)tog/)) || (m = k.match(/^(?:ssk|ssp|cdd|cddp)(\d)/))) return { use: +m[1], make: 1 };
  if (/^(ssk|ssp)(_tbl)?$/.test(k)) return { use: 2, make: 1 };
  if (k === "sk2p") return { use: 3, make: 1 };
  if (/^(m1[lr]p?|[lr]lip?)$/.test(k)) return { use: 0, make: 1 };
  if (k === "yo" || k === "yo_tbl") return { use: 0, make: 1 };
  if ((m = k.match(/^yo(\d)$/))) return { use: 0, make: 1 };
  if (k === "kfb" || k === "pfb") return { use: 1, make: 2 };
  if (k === "kfbf" || k === "cdi3") return { use: 1, make: 3 };
  if ((m = k.match(/^inc1to(\d)/))) return { use: 1, make: +m[1] };
  if (k === "bind_off" || k === "bind_off_p") return { use: 1, make: 0 };
  if (k === "blank" || k === "pm" || k === "sm" || k === "sm_l" || k === "sm_r" || k === "wrap_turn") return { use: 0, make: 0 };
  const w = knitSymbol(id)?.width ?? 1;
  return { use: w, make: w };
}

const WS_SWAP: [RegExp, (m: RegExpMatchArray) => string][] = [
  [/^k_knit$/, () => "k_purl"],
  [/^k_purl$/, () => "k_knit"],
  [/^k_k(\d)tog(_tbl)?$/, (m) => `k_p${m[1]}tog${m[2] ?? ""}`],
  [/^k_p(\d)tog(_tbl)?$/, (m) => `k_k${m[1]}tog${m[2] ?? ""}`],
  [/^k_ssk(\d?)(_tbl)?$/, (m) => `k_ssp${m[1]}${m[2] ?? ""}`],
  [/^k_ssp(\d?)(_tbl)?$/, (m) => `k_ssk${m[1]}${m[2] ?? ""}`],
  [/^k_cdd(\d)$/, (m) => `k_cddp${m[1]}`],
  [/^k_cddp(\d)$/, (m) => `k_cdd${m[1]}`],
  [/^k_twist_k$/, () => "k_twist_p"],
  [/^k_twist_p$/, () => "k_twist_k"],
  [/^k_bind_off$/, () => "k_bind_off_p"],
  [/^k_bind_off_p$/, () => "k_bind_off"],
  [/^k_m1([lr])$/, (m) => `k_m1${m[1]}p`],
  [/^k_m1([lr])p$/, (m) => `k_m1${m[1]}`],
  [/^k_kfb$/, () => "k_pfb"],
  [/^k_pfb$/, () => "k_kfb"],
];
/** the chart symbol for a stitch worked on the wrong side */
export function wsSymbol(id: string): string {
  for (const [re, f] of WS_SWAP) {
    const m = id.match(re);
    if (m) {
      const n = f(m);
      return knitSymbol(n) ? n : id;
    }
  }
  return id;
}

/** expands nodes for `avail` stitches; returns symbol ids in working order */
function expand(nodes: Node[], avail: number | null, issues: string[]): { ids: string[]; use: number } {
  const useOf = (ns: Node[]): { fixed: number; flex: Node | null } => {
    let fixed = 0;
    let flex: Node | null = null;
    for (const n of ns) {
      if (n.n === "fill" || typeof n.n === "object") {
        if (!flex) flex = n;
        else issues.push("끝까지 반복이 두 번 있어 앞의 것만 썼어요");
        if (typeof n.n === "object") fixed += n.n.last;
        if (flex !== n) fixed += unitUse(n);
        continue;
      }
      fixed += unitUse(n) * n.n;
    }
    return { fixed, flex };
  };
  const unitUse = (n: Node): number => (n.t === "st" ? stitchMath(n.id).use : n.items.reduce((a, x) => a + unitUse(x) * (typeof x.n === "number" ? x.n : 1), 0));
  const { fixed, flex } = useOf(nodes);
  let reps = 0;
  if (flex) {
    const unit = unitUse(flex);
    if (avail === null) {
      reps = 1;
    } else if (unit <= 0) {
      reps = 1;
    } else {
      const room = avail - fixed;
      reps = Math.max(0, Math.floor(room / unit));
      const left = room - reps * unit;
      if (left > 0) issues.push(`반복하고 ${left}코가 남아요`);
      if (room < 0) issues.push(`코가 ${-room}코 모자라요`);
    }
  }
  const ids: string[] = [];
  let use = 0;
  const emit = (n: Node, times: number) => {
    for (let t = 0; t < times; t++) {
      if (n.t === "st") {
        ids.push(n.id);
        use += stitchMath(n.id).use;
      } else for (const x of n.items) emit(x, typeof x.n === "number" ? x.n : 1);
    }
  };
  for (const n of nodes) {
    if (n === flex) {
      emit(n, reps);
      continue;
    }
    emit(n, typeof n.n === "number" ? n.n : 1);
  }
  return { ids, use };
}

// ---------------- lines ----------------

/** copy = these rows repeat rows from–to of the pattern ("3~4단: 1~2단 반복") */
type RowSpec = { rows: number[]; side?: Side; nodes: Node[] | "asis"; line: number; copy?: { from: number; to: number } };
type Rule = { which: "even" | "odd" | "RS" | "WS"; nodes: Node[] | "asis"; line: number };

const SIDE_WORD: Record<string, Side> = { rs: "RS", ws: "WS", 겉면: "RS", 안면: "WS", 겉: "RS", 안: "WS", "right side": "RS", "wrong side": "WS" };
/** a row body that repeats earlier rows: "1~2단 반복", "1-2단을 반복", "1단과 2단 반복", "1단과 같이", "rep rows 1-2", "work as row 1" */
const KO_COPY = /^(\d+)\s*(?:단)?\s*(?:(?:[-~]|부터|과|와|및|,)\s*(\d+)\s*)?단\s*(?:까지)?\s*(?:을|를|과|와)?\s*(?:반복|똑같이|같이|같게|처럼|대로)(?:\s*(?:뜨기|떠요|떠\s*주세요|해요|합니다|하기))?\.?$/;
const EN_COPY = /^(?:rep(?:eat)?|work(?:\s+as)?|as|same as)\s*rows?\s*(\d+)(?:\s*(?:-|to|and|&)\s*(\d+))?\.?$/i;
const ASIS = /^(?:knit the knits and purl the purls|k the k sts and p the p sts|work (?:all )?sts as they (?:appear|present)|코\s*모양대로(?:\s*뜨기)?|보이는\s*대로(?:\s*뜨기)?|겉은\s*겉(?:뜨기)?\s*,?\s*안은\s*안(?:뜨기)?(?:으로)?(?:\s*뜨기)?)\.?$/i;

function rangeOf(a: string, b?: string): number[] {
  const x = +a;
  const y = b ? +b : x;
  const out: number[] = [];
  for (let i = Math.min(x, y); i <= Math.max(x, y) && out.length < MAX; i++) out.push(i);
  return out;
}

export function parseWritten(text: string, opt: ParseOptions = DEFAULT_PARSE): ParseResult {
  const lines: LineReport[] = [];
  const specs: RowSpec[] = [];
  const rules: Rule[] = [];
  const repeats: { from: number; to: number; times: number; line: number }[] = [];
  const unknown = new Set<string>();
  let castOn: number | null = null;
  let roundHint = false;
  let autoRow = 0;

  const src = text.replace(/\r/g, "").split("\n");
  src.forEach((raw, i) => {
    const lineNo = i + 1;
    let s = raw.replace(/[：]/g, ":").replace(/[（]/g, "(").replace(/[）]/g, ")").replace(/[–—]/g, "-").replace(/\s+/g, " ").trim();
    if (!s) return;
    const rep: LineReport = { line: lineNo, text: raw.trim(), kind: "note", label: "", issues: [] };
    lines.push(rep);
    let m: RegExpMatchArray | null;

    // cast on
    if ((m = s.match(/^(?:cast on|co)\s*(\d+)\s*(?:sts?|stitches)?\.?$/i)) || (m = s.match(/^(?:일반코\s*|시작코\s*|코\s*잡기\s*:?\s*)?(\d+)\s*코\s*(?:만들기|잡기|잡아요|만들어요|기초코)\.?$/))) {
      castOn = Math.min(MAX, +m[1]);
      rep.kind = "cast";
      rep.label = `시작 ${castOn}코`;
      return;
    }
    // repeat rows: "Rep rows 1-4 3 more times" / "1~4단을 3번 더 반복"
    if ((m = s.match(/^rep(?:eat)?\s*rows?\s*(\d+)\s*(?:-|to|and)\s*(\d+)\s*(?:(\d+)\s*(more\s+)?times?)?/i)) || (m = s.match(/^(\d+)\s*(?:단)?\s*(?:[-~]|과|와|및|,)\s*(\d+)\s*단(?:을|를)?\s*(?:(\d+)\s*(?:번|회)\s*(더\s*)?)?반복/)) || (m = s.match(/^(\d+)()\s*단(?:을|를)?\s*(?:(\d+)\s*(?:번|회)\s*(더\s*)?)?반복/))) {
      if (!m[2]) m[2] = m[1];
      const times = m[3] ? +m[3] + (m[4] ? 0 : -1) : 1;
      repeats.push({ from: Math.min(+m[1], +m[2]), to: Math.max(+m[1], +m[2]), times: Math.max(1, times), line: lineNo });
      rep.kind = "repeat";
      rep.label = `${+m[1] === +m[2] ? `${m[1]}단` : `${Math.min(+m[1], +m[2])}–${Math.max(+m[1], +m[2])}단`} ${Math.max(1, times)}번 더`;
      return;
    }

    // row label
    let rows: number[] | null = null;
    let side: Side | undefined;
    let rule: Rule["which"] | null = null;
    const sideRe = /^\s*\(?\s*(rs|ws|right side|wrong side|겉면|안면|겉|안)\s*\)?/i;
    if ((m = s.match(/^(?:rows?|rnds?|rounds?|r)\s*(\d+)(?:\s*(?:-|to|&|and|through)\s*(\d+))?/i))) {
      if (/^rnd|^round/i.test(s)) roundHint = true;
      rows = rangeOf(m[1], m[2]);
      s = s.slice(m[0].length);
      // "Row 2 and all WS rows"
      const all = s.match(/^\s*(?:and|&)\s*all\s*(rs|ws|even|odd)(?:[- ]numbered)?\s*rows?/i);
      if (all) {
        rule = all[1].toLowerCase() === "even" ? "even" : all[1].toLowerCase() === "odd" ? "odd" : (all[1].toUpperCase() as Side);
        s = s.slice(all[0].length);
      }
    } else if ((m = s.match(/^(?:제\s*)?(\d+)\s*(?:단|번째\s*단|라운드)?\s*(?:[-~]\s*(\d+)\s*)?(?:단|라운드)/)) || (m = s.match(/^(\d+)\s*(?:[-~]\s*(\d+))?\s*(?=[:.)]\s*)/))) {
      if (/라운드/.test(m[0])) roundHint = true;
      rows = rangeOf(m[1], m[2]);
      s = s.slice(m[0].length);
    } else if ((m = s.match(/^(?:all\s*|모든\s*)?(짝수|홀수|even|odd|rs|ws|겉면|안면)(?:[- ]numbered)?\s*(?:단|rows?)(?:은|는)?(?:\s*모두)?/i))) {
      const w = m[1].toLowerCase();
      rule = w === "짝수" || w === "even" ? "even" : w === "홀수" || w === "odd" ? "odd" : SIDE_WORD[w];
      s = s.slice(m[0].length);
    }
    const sm = s.match(sideRe);
    if (sm && (rows || rule) && SIDE_WORD[sm[1].toLowerCase()]) {
      // only treat "겉"/"안" as a side marker when it is bracketed or followed by ":"
      const word = sm[1].toLowerCase();
      if (sm[0].includes("(") || word.length > 1 || /^\s*[:.]/.test(s.slice(sm[0].length))) {
        side = SIDE_WORD[word];
        s = s.slice(sm[0].length);
      }
    }
    s = s.replace(/^\s*(?:단)?\s*[:.)\-]\s*/, "").trim();
    if (!rows && !rule) {
      // a line of stitches without a label continues the numbering
      rows = [autoRow + 1];
    }
    if (!s) {
      rep.kind = "error";
      rep.issues.push("뜨는 방법이 없어요");
      return;
    }
    const cp = s.match(KO_COPY) ?? s.match(EN_COPY);
    if (cp && rows) {
      const from = Math.min(+cp[1], +(cp[2] ?? cp[1]));
      const to = Math.max(+cp[1], +(cp[2] ?? cp[1]));
      specs.push({ rows, side, nodes: [], line: lineNo, copy: { from, to } });
      autoRow = Math.max(autoRow, ...rows);
      rep.kind = "row";
      const lab = rows.length > 1 ? `${rows[0]}–${rows[rows.length - 1]}단` : `${rows[0]}단`;
      rep.label = `${lab} = ${from === to ? `${from}단` : `${from}–${to}단`}`;
      return;
    }
    let nodes: Node[] | "asis";
    if (ASIS.test(s)) nodes = "asis";
    else {
      try {
        nodes = parseSeq(s, opt.mapping);
        if (!nodes.length) throw new TermError(s);
      } catch (e) {
        if (e instanceof TermError) {
          unknown.add(e.term.toLowerCase());
          rep.kind = "error";
          rep.issues.push(`인식하지 못한 용어: ${e.term}`);
          if (rows) autoRow = Math.max(autoRow, ...rows);
          return;
        }
        throw e;
      }
      // a single stitch with no count fills the row ("2단: 안뜨기")
      if (nodes.length === 1 && nodes[0].t === "st" && (nodes[0] as { bare?: boolean }).bare) nodes[0].n = "fill";
    }
    if (rule) {
      rules.push({ which: rule, nodes, line: lineNo });
      rep.kind = "rule";
      rep.label = { even: "짝수단 모두", odd: "홀수단 모두", RS: "겉면 단 모두", WS: "안면 단 모두" }[rule];
    }
    if (rows) {
      specs.push({ rows, side, nodes, line: lineNo });
      autoRow = Math.max(autoRow, ...rows);
      rep.kind = "row";
      const lab = rows.length > 1 ? `${rows[0]}–${rows[rows.length - 1]}단` : `${rows[0]}단`;
      rep.label = rule ? `${lab} + ${rep.label}` : lab;
    }
  });

  const worked: "flat" | "round" = opt.worked === "auto" ? (roundHint ? "round" : "flat") : opt.worked;
  // row 1 labelled WS flips the default
  const first = specs.find((sp) => sp.rows.includes(1));
  const firstRowSide: Side = first?.side ?? opt.firstRowSide;
  const sideOf = (row: number): Side => (worked === "round" ? "RS" : (row % 2 === 1) === (firstRowSide === "RS") ? "RS" : "WS");

  // row number → instruction
  const byRow = new Map<number, RowSpec>();
  for (const sp of specs) for (const r of sp.rows) byRow.set(r, sp);
  // rows that repeat earlier rows take those rows' instructions, cycling through the range
  for (const r of [...byRow.keys()].sort((a, b) => a - b)) {
    const sp = byRow.get(r)!;
    if (!sp.copy) continue;
    const len = sp.copy.to - sp.copy.from + 1;
    const src = sp.copy.from + (sp.rows.indexOf(r) % len);
    const from = src < r ? byRow.get(src) : undefined;
    const lr = lines.find((l) => l.line === sp.line);
    if (!from || from.copy) {
      byRow.delete(r);
      if (lr && !lr.issues.some((x) => x.startsWith(`${src}단`))) lr.issues.push(src >= r ? `${src}단은 이 단보다 앞에 있어야 반복할 수 있어요` : `${src}단 설명이 없어 반복할 수 없어요`);
      continue;
    }
    byRow.set(r, { ...from, rows: [r], side: sp.side, line: sp.line, copy: undefined });
  }
  let maxRow = byRow.size ? Math.max(...byRow.keys()) : 0;
  for (const rp of repeats) {
    const len = rp.to - rp.from + 1;
    let at = Math.max(maxRow, rp.to);
    for (let t = 0; t < rp.times && at + len <= MAX; t++) {
      for (let r = rp.from; r <= rp.to; r++) {
        const sp = byRow.get(r);
        if (sp) byRow.set(at + (r - rp.from) + 1, sp);
      }
      at += len;
    }
    maxRow = Math.max(maxRow, at);
  }
  // rules only matter for rows up to the last numbered one
  const ruleFor = (row: number) =>
    rules.find((ru) => (ru.which === "even" && row % 2 === 0) || (ru.which === "odd" && row % 2 === 1) || ru.which === sideOf(row));
  let clamped = maxRow > MAX;
  maxRow = Math.min(MAX, maxRow);

  // ----- walk rows bottom-up, tracking the stitch count -----
  const rowReports: RowReport[] = [];
  const rowsCells: string[][] = []; // chart order (left → right), per row number - 1
  let avail: number | null = opt.width ?? castOn;
  if (avail === null) {
    // first row without a flexible repeat gives the width; otherwise one repeat of row 1 (at least 12 stitches)
    for (let r = 1; r <= maxRow; r++) {
      const sp = byRow.get(r) ?? (ruleFor(r) ? { nodes: ruleFor(r)!.nodes } : null);
      if (!sp || sp.nodes === "asis") continue;
      const iss: string[] = [];
      const flexy = hasFlex(sp.nodes);
      if (!flexy) {
        avail = expand(sp.nodes, null, iss).use;
        // walk back to row 1 is not needed: rows before only had flexible repeats
        break;
      }
    }
    if (avail === null) {
      const sp = byRow.get(1);
      if (sp && sp.nodes !== "asis") {
        const one = expand(sp.nodes, null, []).use;
        avail = one > 0 ? one * Math.max(1, Math.ceil(12 / one)) : 12;
        // a remainder of a "to last N" or fixed part keeps working; make it a multiple of the repeat
        const unit = flexUnit(sp.nodes);
        if (unit > 0) {
          const fixed = one - unit;
          avail = fixed + unit * Math.max(1, Math.ceil((12 - fixed) / unit));
        }
      } else avail = 12;
    }
  }
  avail = Math.max(1, Math.min(MAX, avail));

  let prevChart: string[] | null = null;
  for (let r = 1; r <= maxRow; r++) {
    const sp = byRow.get(r);
    const ru = sp ? null : ruleFor(r);
    const side = sp?.side ?? sideOf(r);
    const issues: string[] = [];
    const before: number = avail!;
    let ids: string[];
    let use: number;
    const nodes = sp ? sp.nodes : ru ? ru.nodes : null;
    if (nodes === "asis") {
      ids = prevChart ? (side === "WS" ? [...prevChart] : [...prevChart].reverse()) : Array(before).fill("k_knit");
      // chart order → working order; symbols stay as they appear (already RS view)
      use = before;
      const chartOrder = side === "RS" ? [...ids].reverse() : ids;
      rowsCells.push(alignChart(chartOrder, side, opt));
      prevChart = chartOrder;
      rowReports.push({ row: r, side, before, after: before, cells: widthOf(chartOrder), line: sp?.line ?? ru?.line ?? null, issues });
      continue;
    }
    if (!nodes) {
      issues.push("설명이 없어 겉뜨기로 채웠어요");
      ids = Array(before).fill(side === "WS" && worked === "flat" ? "k_purl" : "k_knit");
    } else {
      const ex = expand(nodes, before, issues);
      ids = ex.ids;
      use = ex.use;
      if (use !== before && !issues.some((x) => x.includes("코"))) issues.push(`${r}단은 ${before}코인데 입력은 ${use}코예요. 확인해 주세요.`);
    }
    let after = 0;
    for (const id of ids) after += stitchMath(id).make;
    if (!nodes) after = before;
    // chart symbols as seen from the right side
    const chartIds = side === "WS" && worked === "flat" ? ids.map(wsSymbol) : ids;
    // working order → chart order (left → right)
    const rtl = (side === "RS") === (opt.readOrder === "rtl");
    const chartOrder = rtl ? [...chartIds].reverse() : chartIds;
    const cells = alignChart(chartOrder, side, opt);
    rowsCells.push(cells);
    prevChart = chartOrder;
    rowReports.push({ row: r, side, before, after, cells: widthOf(cells), line: sp?.line ?? ru?.line ?? null, issues });
    avail = Math.max(0, Math.min(MAX, after));
    if (avail === 0 && r < maxRow) {
      issues.push("코가 모두 없어졌어요");
      avail = before;
    }
  }

  // attach row issues to their source lines
  for (const rr of rowReports) {
    if (!rr.issues.length || rr.line === null) continue;
    const lr = lines.find((l) => l.line === rr.line);
    if (lr) for (const x of rr.issues) lr.issues.push(rr.issues.length && lr.label.includes("–") ? `${rr.row}단: ${x}` : x);
  }

  // ----- build the block (row 0 = top = last row) -----
  let cols = 0;
  for (const c of rowsCells) cols = Math.max(cols, widthOf(c));
  if (cols > MAX) {
    cols = MAX;
    clamped = true;
  }
  const rows = rowsCells.length;
  if (!rows || !cols) return { block: null, cols: 0, rows: 0, worked, firstRowSide, lines, rowReports, unknown: [...unknown], clamped };
  const cells: KnitCell[] = Array(cols * rows).fill(null);
  for (let i = 0; i < rows; i++) {
    const y = rows - 1 - i;
    const list = rowsCells[i];
    // right-aligned: missing stitches on the left become "no stitch"
    const w = widthOf(list);
    let x = cols - w;
    for (let k = 0; k < x && k < cols; k++) cells[y * cols + k] = { symbol: "k_blank" };
    for (const id of list) {
      const sw = knitSymbol(id)?.width ?? 1;
      if (x >= 0 && x + sw <= cols) cells[y * cols + x] = id === "k_knit" ? null : { symbol: id };
      x += sw;
    }
  }
  return { block: { cols, rows, cells }, cols, rows, worked, firstRowSide, lines, rowReports, unknown: [...unknown], clamped };
}

function widthOf(list: string[]) {
  let w = 0;
  for (const id of list) w += knitSymbol(id)?.width ?? 1;
  return w;
}
// no-op hook for future alignment choices (kept separate so ws/rs rows align the same way)
function alignChart(chartOrder: string[], _side: Side, _opt: ParseOptions) {
  return chartOrder;
}
function hasFlex(nodes: Node[]): boolean {
  return nodes.some((n) => n.n === "fill" || typeof n.n === "object" || (n.t === "group" && hasFlex(n.items)));
}
function flexUnit(nodes: Node[]): number {
  const unitUse = (n: Node): number => (n.t === "st" ? stitchMath(n.id).use : n.items.reduce((a, x) => a + unitUse(x) * (typeof x.n === "number" ? x.n : 1), 0));
  const f = nodes.find((n) => n.n === "fill" || typeof n.n === "object");
  return f ? unitUse(f) : 0;
}

/** symbols offered when mapping an unknown term */
export const MAP_CHOICES = ["k_knit", "k_purl", "k_yo", "k_k2tog", "k_ssk", "k_cdd3", "k_slip", "k_twist_k", "k_m1l", "k_m1r", "k_kfb", "k_bobble", "k_lc", "k_rc", "k_lc22", "k_rc22", "k_bind_off", "k_blank"];

export const WRITTEN_EXAMPLE = `24코 만들기
1단 (겉면): 겉뜨기 3, 안뜨기 2 반복, 겉뜨기 4
2단: 코 모양대로 뜨기
3단: (겉2, 안2)×6
4단: 안뜨기
Row 5 (RS): *k1, yo, k2tog; rep from * to end
Row 6: purl`;
