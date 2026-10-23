// Knitting chart symbols (Japanese/Korean chart convention), drawn as SVG markup.
// Glyphs are authored in a 24 × 24 box per stitch (a symbol `width` cells wide uses a
// 24·width × 24 box) and drawn with currentColor and non-scaling strokes, so the same
// markup serves the palette (22px icons), the chart canvas and exported SVGs.
// Families are parametric: cables of any width, 1→N increases, N-stitch decreases,
// twisted and purl variants are all generated from the id grammar.

export type KnitGroupId =
  | "basic"
  | "inc"
  | "dec2"
  | "dec3"
  | "dec45"
  | "dec68"
  | "twist"
  | "cross1"
  | "cross2"
  | "cross3"
  | "cross4"
  | "cross5"
  | "special"
  | "markers"
  | "short_rows"
  | "brioche"
  | "chars";

export type KnitSymbol = {
  id: string;
  name: string;
  group: KnitGroupId;
  /** cells (stitches) this symbol spans horizontally */
  width: number;
  /** symbol that this one becomes when the chart is flipped left↔right */
  mirror?: string;
  /** extra search words */
  keywords?: string;
};

type Glyph = {
  /** markup inside a 24·w × 24 box */
  svg: string;
  /** chart rendering: stretch to the cell box (wide/crossing symbols) or keep proportions */
  stretch?: boolean;
  /** replaces the glyph on the chart (e.g. 빈칸 = grey cell) */
  chart?: string;
};

const U = 24;
const f = (n: number) => Math.round(n * 100) / 100;
const L = (x1: number, y1: number, x2: number, y2: number) => `<path d="M${f(x1)} ${f(y1)}L${f(x2)} ${f(y2)}"/>`;
const P = (d: string, extra = "") => `<path d="${d}"${extra}/>`;
const C = (cx: number, cy: number, r: number, fill = false) =>
  `<circle cx="${f(cx)}" cy="${f(cy)}" r="${f(r)}"${fill ? ' fill="currentColor"' : ""}/>`;
const E = (cx: number, cy: number, rx: number, ry: number, fill = false) =>
  `<ellipse cx="${f(cx)}" cy="${f(cy)}" rx="${f(rx)}" ry="${f(ry)}"${fill ? ' fill="currentColor"' : ""}/>`;
const T = (x: number, y: number, s: string, size: number, weight = 600) =>
  `<text x="${f(x)}" y="${f(y)}" text-anchor="middle" dominant-baseline="central" font-size="${f(size)}" font-weight="${weight}" font-family="Pretendard, Arial, sans-serif" fill="currentColor" stroke="none">${s}</text>`;
/** part of a segment between t0 and t1 */
const seg = (x1: number, y1: number, x2: number, y2: number, t0: number, t1: number) =>
  L(x1 + (x2 - x1) * t0, y1 + (y2 - y1) * t0, x1 + (x2 - x1) * t1, y1 + (y2 - y1) * t1);
/** purl bar under a cell (or spanning several) */
const bar = (x0: number, x1: number, y = 19.5) => L(x0, y, x1, y);
const cx = (i: number) => (i + 0.5) * U;

// ---------- families ----------

/** V of a slipped stitch */
const vee = (x: number, top = 6, bot = 17, half = 5) => P(`M${f(x - half)} ${top}L${f(x)} ${bot}L${f(x + half)} ${top}`);

/** decrease: `legs` strands meet at the top; `over` leg continues past the apex */
function dec(legs: number, over: "left" | "right" | "center", o: { purl?: boolean; tbl?: boolean; digit?: boolean } = {}) {
  const top = o.tbl ? 8 : 5.5;
  const bot = o.purl ? 16 : 19;
  const ax = 12;
  let s = "";
  const xs = Array.from({ length: legs }, (_, i) => 5.5 + (13 * i) / (legs - 1));
  xs.forEach((x, i) => {
    const isOver = (over === "left" && i === 0) || (over === "right" && i === legs - 1);
    if (over === "center" && Math.abs(x - ax) < 0.01) {
      s += L(x, bot, x, top - 1.5);
      return;
    }
    if (isOver) {
      // the top stitch reaches a little past the apex
      const k = 0.38;
      s += L(x, bot, ax + (ax - x) * k, top - (bot - top) * k);
    } else s += L(x, bot, ax, top);
  });
  if (over === "center" && legs % 2 === 0) s += L(ax, top, ax, top - 2.5);
  if (o.tbl) s += P(`M${ax} ${top}C${ax - 4} ${top - 5} ${ax + 4} ${top - 5} ${ax} ${top}`);
  if (o.purl) s += bar(6, 18, 20);
  if (o.digit && legs > 3) s += T(19.5, 20.5, String(legs), 5.5);
  return s;
}

/** fan increase: 1 stitch becomes n */
function fan(n: number, o: { purl?: boolean; digit?: boolean; center?: boolean } = {}) {
  const bot = o.purl ? 15.5 : 18.5;
  let s = L(6, 6, 12, bot) + L(18, 6, 12, bot);
  if (o.center) s = L(12, 12, 6.5, 5.5) + L(12, 12, 17.5, 5.5) + L(12, 5, 12, bot);
  if (o.digit) s += T(12, 5.2, String(n), 5.5);
  if (o.purl) s += bar(6.5, 17.5, 19.5);
  return s;
}

/** knit-like lifted stitch: a stem with a branch to one side */
const lifted = (side: -1 | 1, purl = false) => {
  const bot = purl ? 16 : 19;
  return L(12, 8, 12, bot) + L(12, 12, 12 + side * 5, 6) + (purl ? bar(7, 17, 19.5) : "");
};

/** twisted loop (꼬아뜨기) */
const loop = (x: number, top = 5, bot = 19) => {
  const m = top + (bot - top) * 0.45;
  return P(`M${f(x - 4)} ${bot}L${f(x + 2.6)} ${f(m)}C${f(x + 6)} ${f(m - 4)} ${f(x + 3)} ${top} ${f(x)} ${top}C${f(x - 3)} ${top} ${f(x - 6)} ${f(m - 4)} ${f(x - 2.6)} ${f(m)}L${f(x + 4)} ${bot}`);
};

/**
 * Cable cross. `left` stitches start on the left and travel right, `right` start on the right and travel left,
 * `centre` stitches stay in the middle. `leftOver` = the left group lies on top (왼코 위).
 */
function cable(left: number, right: number, leftOver: boolean, o: { purl?: boolean; centre?: number; centrePurl?: boolean; twist?: boolean; thru?: boolean } = {}) {
  const c = o.centre ?? 0;
  const top = 3.5;
  const bot = 20.5;
  let under = "";
  let over = "";
  let mid = "";
  for (let k = 0; k < c; k++) {
    const x = cx(left + k);
    mid += o.centrePurl ? bar(x - 5, x + 5, 12) : L(x, 7, x, 17);
  }
  const strand = (x1: number, x2: number, isOver: boolean) => {
    if (isOver) {
      over += L(x1, bot, x2, top);
      if (o.twist) over += C(x2, top + 2.2, 1.6);
      return;
    }
    const endTop = o.purl ? top + 4.5 : top;
    const t1 = (bot - endTop) / (bot - top);
    // gap where the strand passes under
    under += seg(x1, bot, x2, top, 0, 0.36) + seg(x1, bot, x2, top, 0.64, t1);
    if (o.purl) under += bar(x2 - 4.5, x2 + 4.5, top);
  };
  for (let i = 0; i < left; i++) strand(cx(i), cx(right + c + i), leftOver);
  for (let j = 0; j < right; j++) strand(cx(left + c + j), cx(j), !leftOver);
  if (o.thru) over += C(cx(0) + (cx(left + right + c - 1) - cx(0)) / 2, 12, 2.4);
  return mid + under + over;
}

const arch = (x0: number, x1: number, y: number, h: number) => P(`M${f(x0)} ${f(y)}Q${f((x0 + x1) / 2)} ${f(y - h)} ${f(x1)} ${f(y)}`);

// ---------- parsing ids into glyphs ----------

function glyphOf(id: string): Glyph | null {
  const k = id.slice(2);
  let m: RegExpMatchArray | null;

  // ----- crossings -----
  if ((m = k.match(/^(lc|rc)(\d)(\d)(\d)(ck|cp)$/))) {
    const [a, b, c] = [+m[2], +m[3], +m[4]];
    return { svg: cable(a, c, m[1] === "lc", { centre: b, centrePurl: m[5] === "cp" }), stretch: true };
  }
  if ((m = k.match(/^(lc|rc)_k3$/))) return { svg: cable(1, 1, m[1] === "lc", { centre: 3 }), stretch: true };
  if ((m = k.match(/^(lc|rc)(22)?_twist(_p)?$/))) {
    const n = m[2] ? 2 : 1;
    return { svg: cable(n, n, m[1] === "lc", { twist: true, purl: !!m[3] }), stretch: true };
  }
  if ((m = k.match(/^(lc|rc)_thru$/))) return { svg: cable(1, 1, m[1] === "lc", { thru: true }), stretch: true };
  if (k === "lc12_p_slip") return { svg: cable(1, 2, true, { purl: true }), stretch: true };
  if (k === "rc12_slip_p") return { svg: cable(2, 1, false, { purl: true }), stretch: true };
  if ((m = k.match(/^(lc|rc)(?:(\d)(\d))?(_p)?$/))) {
    const lc = m[1] === "lc";
    const F = m[2] ? +m[2] : 1;
    const B = m[3] ? +m[3] : 1;
    // lc: the left F stitches lie on top; rc: the right F stitches lie on top
    return { svg: lc ? cable(F, B, true, { purl: !!m[4] }) : cable(B, F, false, { purl: !!m[4] }), stretch: true };
  }

  // ----- increases -----
  if ((m = k.match(/^inc1to(\d+)(p)?$/))) return { svg: fan(+m[1], { purl: !!m[2], digit: true }) };
  if (k === "kfb") return { svg: fan(2, { digit: true }) };
  if (k === "pfb") return { svg: fan(2, { digit: true, purl: true }) };
  if (k === "kfbf") return { svg: fan(3, { digit: true }) };
  if (k === "cdi3") return { svg: fan(3, { center: true }) };
  if ((m = k.match(/^m1(l|r)(p)?$/))) return { svg: T(12, m[2] ? 9.5 : 12, m[1] === "l" ? "ML" : "MR", 7) + (m[2] ? bar(7, 17, 16) : "") };
  if ((m = k.match(/^(l|r)li(p)?$/))) return { svg: lifted(m[1] === "l" ? -1 : 1, !!m[2]) };

  // ----- decreases -----
  if ((m = k.match(/^(ssk|ssp|cdd|cddp)(\d)?(_tbl)?$/))) {
    const purl = m[1] === "ssp" || m[1] === "cddp";
    return { svg: dec(m[2] ? +m[2] : 2, m[1].startsWith("cdd") ? "center" : "right", { purl, tbl: !!m[3], digit: true }) };
  }
  if ((m = k.match(/^(k|p)(\d)tog(_tbl)?$/))) return { svg: dec(+m[2], "left", { purl: m[1] === "p", tbl: !!m[3], digit: true }) };
  if (k === "sk2p") return { svg: dec(3, "right") + arch(15, 7, 7, 4) };
  if (k === "bed" || k === "bebd") {
    const a = k === "bed";
    return { svg: `<g>${dec(2, a ? "left" : "right")}</g><g transform="translate(24 0)">${dec(2, a ? "right" : "left")}</g>`, stretch: true };
  }
  if (k === "beyo" || k === "bebyo") {
    const a = k === "beyo";
    return { svg: `<g>${dec(2, a ? "left" : "right")}</g>${C(36, 12, 4.5)}<g transform="translate(48 0)">${dec(2, a ? "right" : "left")}</g>`, stretch: true };
  }

  // ----- brioche -----
  if ((m = k.match(/^sl(\d)yo$/))) {
    const n = +m[1];
    let s = "";
    for (let i = 0; i < n; i++) s += vee(cx(i), 9, 19, 4.5);
    return { svg: s + arch(4, n * U - 4, 7.5, 5), stretch: n > 1 };
  }
  if ((m = k.match(/^br(k|p)$/))) return { svg: arch(6, 18, 10, 8) + L(12, 6.2, 12, m[1] === "p" ? 15 : 19) + (m[1] === "p" ? bar(6, 18, 19) : "") };
  if (k === "brk_tbl") return { svg: arch(6, 18, 10, 8) + loop(12, 8, 19) };
  if (k === "brkyobrk") return { svg: arch(6, 18, 9, 7) + fan(3, { digit: false }) };
  if ((m = k.match(/^br(k|p)(\d)tog$/))) return { svg: dec(+m[2], "left", { purl: m[1] === "p" }) + arch(7, 17, 22.5, 3) };
  if ((m = k.match(/^br(sss|ss)(k|p)$/))) return { svg: dec(m[1] === "sss" ? 3 : 2, "right", { purl: m[2] === "p" }) + arch(7, 17, 22.5, 3) };
  if ((m = k.match(/^brcdd(p)?$/))) return { svg: dec(3, "center", { purl: !!m[1] }) + arch(7, 17, 22.5, 3) };

  // ----- characters -----
  if ((m = k.match(/^char_([0-9a-z])$/))) return { svg: T(12, 12.5, m[1].toUpperCase(), 14) };

  return BASIC[k] ?? null;
}

const BASIC: Record<string, Glyph> = {
  empty: { svg: P("M5.5 5.5H18.5V18.5H5.5Z"), chart: "" },
  blank: {
    svg: P("M5 5H19V19H5Z") + L(5, 10.5, 10.5, 5) + L(5, 15.5, 15.5, 5) + L(6.5, 19, 19, 6.5) + L(11.5, 19, 19, 11.5),
    chart: '<rect x="0" y="0" width="24" height="24" fill="#d4d4d8" stroke="none"/>',
  },
  knit: { svg: L(12, 5.5, 12, 18.5) },
  purl: { svg: L(5.5, 12, 18.5, 12) },
  yo: { svg: C(12, 12, 5) },
  yo_tbl: { svg: C(12, 9, 3.6) + L(9.4, 11.5, 15, 19) + L(14.6, 11.5, 9, 19) },
  yo2: { svg: C(18.5, 12, 5) + C(29.5, 12, 5) },
  yo3: { svg: C(25, 12, 5) + C(36, 12, 5) + C(47, 12, 5) },
  slip: { svg: vee(12, 6, 18, 5.5) },
  slip_p: { svg: vee(12, 5, 15, 5) + bar(5.5, 18.5, 12) },
  slip_p2: { svg: vee(cx(0), 5, 15, 5) + vee(cx(1), 5, 15, 5) + bar(6.5, 41.5, 12), stretch: true },
  slip_p3: { svg: vee(cx(0), 5, 15, 5) + vee(cx(1), 5, 15, 5) + vee(cx(2), 5, 15, 5) + bar(6.5, 65.5, 12), stretch: true },
  slip_k: { svg: vee(12, 8, 19, 5) + T(16.5, 5.5, "k", 6, 500) },
  bind_off: { svg: E(12, 12, 6.2, 3.2, true) },
  bind_off_p: { svg: E(12, 10, 6.2, 3, true) + bar(6, 18, 16.5) },
  bo_last: { svg: P("M8.5 5.5H11.5V15.5H16.5V18.5H8.5Z", ' fill="currentColor"') },
  cast_on: { svg: P("M6 18.5C9.5 18.5 16 15 15 9.5C14.3 6 9.7 6 9.2 9.5C8.6 13.6 13 18.5 18 18.5") },
  twist_k: { svg: loop(12) },
  twist_p: { svg: loop(12, 5, 16) + bar(6, 18, 19.5) },
  bobble: { svg: E(12, 12, 5.5, 6.5) },
  bobble3: { svg: E(12, 12, 5.5, 6.5) + T(12, 12.3, "3", 6.5) },
  bobble5: { svg: E(12, 12, 5.5, 6.5) + T(12, 12.3, "5", 6.5) },
  bobble7: { svg: E(12, 12, 5.5, 6.5) + T(12, 12.3, "7", 6.5) },
  nupp3: { svg: arch(5.5, 18.5, 15, 11) + T(12, 17.5, "3", 6) },
  nupp: { svg: arch(5.5, 18.5, 15, 11) + T(12, 17.5, "5", 6) },
  nupp7: { svg: arch(5.5, 18.5, 15, 11) + T(12, 17.5, "7", 6) },
  knit_below: { svg: L(12, 5, 12, 14) + P("M8.5 14.5Q12 21 15.5 14.5") },
  purl_below: { svg: bar(6, 18, 9) + P("M8.5 14.5Q12 21 15.5 14.5") },
  tuck: { svg: L(12, 4.5, 12, 9) + P("M8 9V16Q12 21.5 16 16V9") },
  tuck3: { svg: L(12, 4.5, 12, 8) + P("M8 8V16Q12 21.5 16 16V8") + T(12, 12.5, "3", 5.5) },
  tuck4: { svg: L(12, 4.5, 12, 8) + P("M8 8V16Q12 21.5 16 16V8") + T(12, 12.5, "4", 5.5) },
  tuck_twist: { svg: loop(12, 4.5, 11) + P("M8 11V16Q12 21.5 16 16V11") },
  tuck_twist3: { svg: loop(12, 4.5, 11) + P("M8 11V16Q12 21.5 16 16V11") + T(19.5, 20, "3", 5) },
  tuck_twist4: { svg: loop(12, 4.5, 11) + P("M8 11V16Q12 21.5 16 16V11") + T(19.5, 20, "4", 5) },
  dip_purl2: { svg: bar(6, 18, 6) + P("M8 9V16Q12 21.5 16 16V9") + T(12, 12.5, "2", 5) },
  slip_tall2: { svg: vee(12, 4, 20, 5) + T(17.5, 16, "2", 5) },
  slip_p_tall2: { svg: vee(12, 4, 16, 5) + bar(6, 18, 19.5) + T(17.5, 13, "2", 5) },
  psso3: { svg: L(cx(0), 6, cx(0), 19) + C(cx(1), 13, 4.5) + L(cx(2), 6, cx(2), 19) + P(`M${cx(2)} 6C${cx(2) - 4} -1 ${cx(0) + 4} -1 ${cx(0)} 6`), stretch: true },
  elong2: { svg: L(12, 4.5, 12, 19.5) + C(12, 9.5, 2) + C(12, 14.5, 2) },
  elong3: { svg: L(12, 4.5, 12, 19.5) + C(12, 8, 1.7) + C(12, 12, 1.7) + C(12, 16, 1.7) },
  elong4: { svg: L(12, 4, 12, 20) + C(12, 7, 1.4) + C(12, 10.3, 1.4) + C(12, 13.6, 1.4) + C(12, 16.9, 1.4) },
  elong2p: { svg: L(12, 4.5, 12, 15.5) + C(12, 8, 1.8) + C(12, 12.5, 1.8) + bar(6, 18, 19) },
  elong3p: { svg: L(12, 4.5, 12, 15.5) + C(12, 7, 1.5) + C(12, 10, 1.5) + C(12, 13, 1.5) + bar(6, 18, 19) },
  elong4p: { svg: L(12, 4.5, 12, 16) + C(12, 6.5, 1.2) + C(12, 9, 1.2) + C(12, 11.5, 1.2) + C(12, 14, 1.2) + bar(6, 18, 19) },
  wrap2: { svg: L(cx(0), 5, cx(0), 19) + L(cx(1), 5, cx(1), 19) + E(24, 12, 19, 4.5), stretch: true },
  wrap3: { svg: L(cx(0), 5, cx(0), 19) + L(cx(1), 5, cx(1), 19) + L(cx(2), 5, cx(2), 19) + E(36, 12, 30, 4.5), stretch: true },
  wrap4: { svg: [0, 1, 2, 3].map((i) => L(cx(i), 5, cx(i), 19)).join("") + E(48, 12, 42, 4.5), stretch: true },
  gather2: { svg: L(cx(0), 19, 24, 12) + L(cx(1), 19, 24, 12) + L(24, 12, cx(0), 5) + L(24, 12, cx(1), 5) + C(24, 12, 1.8, true), stretch: true },
  gather3: {
    svg: [0, 1, 2].map((i) => L(cx(i), 19, 36, 12) + L(36, 12, cx(i), 5)).join("") + C(36, 12, 1.8, true),
    stretch: true,
  },
  drop: { svg: P("M12 4.5V15", ' stroke-dasharray="2.2 2"') + P("M8.5 15L12 19.5L15.5 15") },
  pickup: { svg: L(12, 5, 12, 16) + C(12, 18.5, 2, true) },
  bead: { svg: P("M12 5.5L17 12L12 18.5L7 12Z") },
  bead_p: { svg: P("M12 4.5L16 9.5L12 14.5L8 9.5Z") + bar(6, 18, 19) },
  pm: { svg: L(12, 3.5, 12, 20.5) + P("M12 5H18L16 7.5L18 10H12", ' fill="currentColor"') },
  sm: { svg: L(12, 3.5, 12, 20.5) + C(12, 12, 3.6) },
  sm_l: { svg: L(15, 3.5, 15, 20.5) + P("M12 12H5M8 9L5 12L8 15") },
  sm_r: { svg: L(9, 3.5, 9, 20.5) + P("M12 12H19M16 9L19 12L16 15") },
  wrap_turn: { svg: P("M17 19V10.5A5 5 0 0 0 7 10.5V15") + P("M4.5 12.5L7 15.5L9.5 12.5") },
  wrap_turn_ws: { svg: P("M7 16V9.5A5 5 0 0 1 17 9.5V13") + P("M14.5 10.5L17 13.5L19.5 10.5") + bar(6, 18, 20) },
  double_st: { svg: T(12, 12.5, "DS", 8.5) },
  turn_rs: { svg: P("M18 17H10A4.5 4.5 0 0 1 10 8H14") + P("M12 5.5L14.5 8L12 10.5") },
  turn_ws: { svg: P("M6 17H14A4.5 4.5 0 0 0 14 8H10") + P("M12 5.5L9.5 8L12 10.5") },
  srl: { svg: P("M18 12H6M9.5 8.5L6 12L9.5 15.5") + L(18, 7, 18, 17) },
  srr: { svg: P("M6 12H18M14.5 8.5L18 12L14.5 15.5") + L(6, 7, 6, 17) },
};

const MIRROR_SIMPLE: Record<string, string> = {
  m1l: "m1r",
  m1r: "m1l",
  m1lp: "m1rp",
  m1rp: "m1lp",
  lli: "rli",
  rli: "lli",
  llip: "rlip",
  rlip: "llip",
  sm_l: "sm_r",
  sm_r: "sm_l",
  srl: "srr",
  srr: "srl",
  turn_rs: "turn_ws",
  turn_ws: "turn_rs",
  bed: "bebd",
  bebd: "bed",
  beyo: "bebyo",
  bebyo: "beyo",
  lc12_p_slip: "rc12_slip_p",
  rc12_slip_p: "lc12_p_slip",
  ssk: "k2tog",
  k2tog: "ssk",
  ssp: "p2tog",
  p2tog: "ssp",
  ssk_tbl: "k2tog_tbl",
  k2tog_tbl: "ssk_tbl",
  ssp_tbl: "p2tog_tbl",
  p2tog_tbl: "ssp_tbl",
  brssk: "brk2tog",
  brk2tog: "brssk",
  brssp: "brp2tog",
  brp2tog: "brssp",
  brsssk: "brk3tog",
  brk3tog: "brsssk",
  brsssp: "brp3tog",
  brp3tog: "brsssp",
};

function mirrorOf(id: string): string | undefined {
  const k = id.slice(2);
  if (MIRROR_SIMPLE[k]) return "k_" + MIRROR_SIMPLE[k];
  let m: RegExpMatchArray | null;
  if ((m = k.match(/^(lc|rc)(.*)$/))) {
    // centre crosses mirror their outer counts too (A/B/C → C/B/A); plain F/B crosses keep the numbers
    return `k_${m[1] === "lc" ? "rc" : "lc"}${m[2]}`;
  }
  if ((m = k.match(/^ssk(\d)(_tbl)?$/))) return `k_k${m[1]}tog${m[2] ?? ""}`;
  if ((m = k.match(/^k(\d)tog(_tbl)?$/))) return `k_ssk${m[1]}${m[2] ?? ""}`;
  if ((m = k.match(/^ssp(\d)(_tbl)?$/))) return `k_p${m[1]}tog${m[2] ?? ""}`;
  if ((m = k.match(/^p(\d)tog(_tbl)?$/))) return `k_ssp${m[1]}${m[2] ?? ""}`;
  return undefined;
}

/** cells a symbol spans */
function widthOf(id: string): number {
  const k = id.slice(2);
  let m: RegExpMatchArray | null;
  if ((m = k.match(/^(lc|rc)(\d)(\d)(\d)(ck|cp)$/))) return +m[2] + +m[3] + +m[4];
  if (/^(lc|rc)_k3$/.test(k)) return 5;
  if ((m = k.match(/^(lc|rc)(22)?_twist/))) return m[2] ? 4 : 2;
  if (/^(lc|rc)_thru$/.test(k)) return 2;
  if (k === "lc12_p_slip" || k === "rc12_slip_p") return 3;
  if ((m = k.match(/^(lc|rc)(?:(\d)(\d))?(_p)?$/))) return m[2] ? +m[2] + +m[3] : 2;
  if ((m = k.match(/^sl(\d)yo$/))) return +m[1];
  if ((m = k.match(/^(?:yo|slip_p|wrap|gather)(\d)$/))) return +m[1];
  if (k === "bed" || k === "bebd") return 2;
  if (k === "beyo" || k === "bebyo" || k === "psso3") return 3;
  return 1;
}

const ORDINAL_SIDE = (lc: boolean) => (lc ? "왼코" : "오른코");

/** Korean name for parametric ids that are not in the catalogue (same templates as the palette). */
export function knitLabel(id: string): string {
  const hit = LABELS.get(id);
  if (hit) return hit;
  const k = id.slice(2);
  let m: RegExpMatchArray | null;
  if ((m = k.match(/^(lc|rc)(\d)(\d)(\d)(ck|cp)$/))) {
    const lc = m[1] === "lc";
    return `${ORDINAL_SIDE(lc)} 위 ${m[2]}코 교차뜨기, 가운데 ${m[5] === "ck" ? "겉뜨기" : "안뜨기"} ${m[3]}코 (${m[2]}/${m[3]}/${m[4]} ${lc ? "R" : "L"}${m[5] === "cp" ? "P" : ""}C)`;
  }
  if ((m = k.match(/^(lc|rc)(\d)(\d)(_p)?$/))) {
    const lc = m[1] === "lc";
    return `${ORDINAL_SIDE(lc)} 위 ${m[2]}코 교차뜨기${m[4] ? ", 안뜨기 바탕" : ""} (${m[2]}/${m[3]} ${lc ? "R" : "L"}${m[4] ? "P" : ""}C)`;
  }
  if ((m = k.match(/^inc1to(\d+)(p)?$/))) return `1코에 ${m[1]}코 떠내기${m[2] ? " (안뜨기)" : ""}`;
  if ((m = k.match(/^(ssk|ssp|cdd|cddp)(\d)(_tbl)?$/))) {
    const base = m[1].startsWith("cdd") ? "중심" : "오른코 겹쳐";
    const purl = m[1] === "ssp" || m[1] === "cddp";
    return `${base} ${m[2]}코 모아${purl ? " 안" : ""}뜨기${m[3] ? " (꼬아)" : ""}`;
  }
  if ((m = k.match(/^(k|p)(\d)tog(_tbl)?$/))) return `왼코 겹쳐 ${m[2]}코 모아${m[1] === "p" ? " 안" : ""}뜨기${m[3] ? " (꼬아)" : ""}`;
  if ((m = k.match(/^sl(\d)yo$/))) return `걸러뜨기 ${m[1]}코+바늘비우기 (sl${m[1]}yo)`;
  return id;
}

// ---------- reference inventory: 17 groups, 328 ids, palette order and names ----------

const KNIT_GROUP_LIST: [KnitGroupId, string][] = [["basic", "기본"], ["inc", "코 늘리기"], ["dec2", "2코 모아뜨기"], ["dec3", "3코 모아뜨기"], ["dec45", "4·5코 모아뜨기"], ["dec68", "6~8코 모아뜨기"], ["twist", "꼬아뜨기"], ["cross1", "교차 2·3코 너비"], ["cross2", "교차 4·5코 너비 (꽈배기)"], ["cross3", "교차 6코 너비"], ["cross4", "교차 7·8코 너비"], ["cross5", "교차 9코 이상 너비"], ["special", "특수 뜨기"], ["markers", "마커"], ["short_rows", "되돌아뜨기"], ["brioche", "브리오슈"], ["chars", "글자·숫자"]];

const CATALOG: Record<KnitGroupId, [string, string][]> = {
  basic: [["empty", "지우기"], ["blank", "빈칸 (코 없음)"], ["knit", "겉뜨기"], ["purl", "안뜨기"], ["yo", "바늘비우기"], ["yo_tbl", "바늘비우기 꼬아뜨기 (yo tbl)"], ["yo2", "바늘비우기 2번 (2회 감기)"], ["yo3", "바늘비우기 3번 (3회 감기)"], ["slip", "걸러뜨기 (sl1)"], ["slip_p", "걸러뜨기 (실 앞에 두고, sl1 wyif)"], ["slip_p2", "걸러뜨기 (실 앞에 두고, 2코, sl2 wyif)"], ["slip_p3", "걸러뜨기 (실 앞에 두고, 3코, sl3 wyif)"], ["slip_k", "겉뜨기 방향 걸러뜨기 (sl1 kwise)"], ["bind_off", "덮어씌우기"], ["bind_off_p", "안뜨기 코막음"], ["bo_last", "코막음 후 오른바늘에 남은 코"], ["cast_on", "감아코"]],
  inc: [["m1l", "왼코 늘리기 (M1L)"], ["m1r", "오른코 늘리기 (M1R)"], ["m1lp", "왼코 늘리기 안뜨기 (M1LP)"], ["m1rp", "오른코 늘리기 안뜨기 (M1RP)"], ["lli", "왼코 끌어올려 늘리기 (LLI)"], ["rli", "오른코 끌어올려 늘리기 (RLI)"], ["llip", "왼코 끌어올려 늘리기 안뜨기 (LLIP)"], ["rlip", "오른코 끌어올려 늘리기 안뜨기 (RLIP)"], ["kfb", "겉뜨기 코늘리기 (kfb)"], ["pfb", "안뜨기 코늘리기 (pfb)"], ["cdi3", "중심 3코 늘리기"], ["kfbf", "겉뜨기 앞·뒤·앞 코늘리기 (kfbf, 1코→3코)"], ["inc1to3p", "1코에 3코 떠내기 (안뜨기)"], ["inc1to4", "1코에 4코 떠내기"], ["inc1to4p", "1코에 4코 떠내기 (안뜨기)"], ["inc1to5", "1코에 5코 떠내기"], ["inc1to5p", "1코에 5코 떠내기 (안뜨기)"], ["inc1to6", "1코에 6코 떠내기"], ["inc1to6p", "1코에 6코 떠내기 (안뜨기)"], ["inc1to7", "1코에 7코 떠내기"], ["inc1to7p", "1코에 7코 떠내기 (안뜨기)"], ["inc1to8", "1코에 8코 떠내기"], ["inc1to8p", "1코에 8코 떠내기 (안뜨기)"]],
  dec2: [["ssk", "SSK (오른코 겹쳐 2코 모아뜨기)"], ["k2tog", "k2tog (왼코 겹쳐 2코 모아뜨기)"], ["ssp", "SSP (오른코 겹쳐 2코 모아 안뜨기)"], ["p2tog", "p2tog (왼코 겹쳐 2코 모아 안뜨기)"], ["cdd2", "중심 2코 모아뜨기"], ["cddp2", "중심 2코 모아 안뜨기"], ["ssk_tbl", "꼬아 오른코 겹쳐 2코 모아뜨기"], ["k2tog_tbl", "꼬아 왼코 겹쳐 2코 모아뜨기 (k2tog tbl)"], ["ssp_tbl", "오른코 겹쳐 2코 모아 안뜨기 (꼬아)"], ["p2tog_tbl", "왼코 겹쳐 2코 모아 안뜨기 (꼬아)"]],
  dec3: [["cdd3", "중심 3코 모아뜨기"], ["cddp3", "중심 3코 모아 안뜨기"], ["ssk3", "오른코 겹쳐 3코 모아뜨기"], ["sk2p", "1코 걸러 2코 모아뜨고 덮어씌우기 (sk2p)"], ["ssp3", "오른코 겹쳐 3코 모아 안뜨기"], ["k3tog", "왼코 겹쳐 3코 모아뜨기"], ["p3tog", "왼코 겹쳐 3코 모아 안뜨기"], ["ssk3_tbl", "오른코 겹쳐 3코 모아뜨기 (꼬아)"], ["k3tog_tbl", "왼코 겹쳐 3코 모아뜨기 (꼬아)"], ["ssp3_tbl", "오른코 겹쳐 3코 모아 안뜨기 (꼬아)"], ["p3tog_tbl", "왼코 겹쳐 3코 모아 안뜨기 (꼬아)"], ["bed", "토끼 귀 줄이기 (BED, 3코→2코)"], ["bebd", "토끼 귀 뒤로 줄이기 (BEBD, 3코→2코)"], ["beyo", "토끼 귀 줄이기+바늘비우기 (BEYO, 3코→3코)"], ["bebyo", "토끼 귀 뒤로 줄이기+바늘비우기 (BEBYO, 3코→3코)"]],
  dec45: [["ssk4", "오른코 겹쳐 4코 모아뜨기"], ["k4tog", "왼코 겹쳐 4코 모아뜨기"], ["ssp4", "오른코 겹쳐 4코 모아 안뜨기"], ["p4tog", "왼코 겹쳐 4코 모아 안뜨기"], ["cdd4", "중심 4코 모아뜨기"], ["cddp4", "중심 4코 모아 안뜨기"], ["ssk5", "오른코 겹쳐 5코 모아뜨기"], ["k5tog", "왼코 겹쳐 5코 모아뜨기"], ["ssp5", "오른코 겹쳐 5코 모아 안뜨기"], ["p5tog", "왼코 겹쳐 5코 모아 안뜨기"], ["cdd5", "중심 5코 모아뜨기"], ["cddp5", "중심 5코 모아 안뜨기"]],
  dec68: [["ssk6", "오른코 겹쳐 6코 모아뜨기"], ["k6tog", "왼코 겹쳐 6코 모아뜨기"], ["ssp6", "오른코 겹쳐 6코 모아 안뜨기"], ["p6tog", "왼코 겹쳐 6코 모아 안뜨기"], ["cdd6", "중심 6코 모아뜨기"], ["cddp6", "중심 6코 모아 안뜨기"], ["ssk7", "오른코 겹쳐 7코 모아뜨기"], ["k7tog", "왼코 겹쳐 7코 모아뜨기"], ["ssp7", "오른코 겹쳐 7코 모아 안뜨기"], ["p7tog", "왼코 겹쳐 7코 모아 안뜨기"], ["cdd7", "중심 7코 모아뜨기"], ["cddp7", "중심 7코 모아 안뜨기"], ["ssk8", "오른코 겹쳐 8코 모아뜨기"], ["k8tog", "왼코 겹쳐 8코 모아뜨기"], ["ssp8", "오른코 겹쳐 8코 모아 안뜨기"], ["p8tog", "왼코 겹쳐 8코 모아 안뜨기"], ["cdd8", "중심 8코 모아뜨기"], ["cddp8", "중심 8코 모아 안뜨기"]],
  twist: [["twist_k", "겉뜨기 꼬아뜨기"], ["twist_p", "안뜨기 꼬아뜨기"], ["lc_twist", "왼코 위 꼬아뜨기 교차뜨기"], ["rc_twist", "오른코 위 꼬아뜨기 교차뜨기"], ["lc_twist_p", "왼코 위 꼬아뜨기 교차뜨기 (뒤쪽 안뜨기)"], ["rc_twist_p", "오른코 위 꼬아뜨기 교차뜨기 (뒤쪽 안뜨기)"], ["lc22_twist", "왼코 위 2코 꼬아뜨기 교차뜨기 (2/2 RT)"], ["rc22_twist", "오른코 위 2코 꼬아뜨기 교차뜨기 (2/2 LT)"], ["lc22_twist_p", "왼코 위 2코 꼬아뜨기 교차뜨기 (뒤쪽 안뜨기) (2/2 RPT)"], ["rc22_twist_p", "오른코 위 2코 꼬아뜨기 교차뜨기 (뒤쪽 안뜨기) (2/2 LPT)"]],
  cross1: [["lc", "왼코 위 1코 교차뜨기 (1/1 RC)"], ["rc", "오른코 위 1코 교차뜨기 (1/1 LC)"], ["lc_p", "왼코 위 1코 교차뜨기, 안뜨기 바탕 (1/1 RPC)"], ["rc_p", "오른코 위 1코 교차뜨기, 안뜨기 바탕 (1/1 LPC)"], ["lc_thru", "왼코 통과 교차뜨기"], ["rc_thru", "오른코 통과 교차뜨기"], ["lc21", "왼코 위 2코 교차뜨기 (2/1 RC)"], ["rc21", "오른코 위 2코 교차뜨기 (2/1 LC)"], ["lc21_p", "왼코 위 2코 교차뜨기, 안뜨기 바탕 (2/1 RPC)"], ["rc21_p", "오른코 위 2코 교차뜨기, 안뜨기 바탕 (2/1 LPC)"], ["lc12", "왼코 위 1코 교차뜨기 (1/2 RC)"], ["rc12", "오른코 위 1코 교차뜨기 (1/2 LC)"], ["lc12_p", "왼코 위 1코 교차뜨기, 안뜨기 바탕 (1/2 RPC)"], ["rc12_p", "오른코 위 1코 교차뜨기, 안뜨기 바탕 (1/2 LPC)"], ["lc12_p_slip", "왼코 1코 위 교차뜨기 (뒤쪽 안뜨기 1코·겉뜨기 1코)"], ["rc12_slip_p", "오른코 1코 위 교차뜨기 (뒤쪽 겉뜨기 1코·안뜨기 1코)"], ["lc111ck", "왼코 위 1코 교차뜨기, 가운데 겉뜨기 1코 (1/1/1 RC)"], ["rc111ck", "오른코 위 1코 교차뜨기, 가운데 겉뜨기 1코 (1/1/1 LC)"], ["lc111cp", "왼코 위 1코 교차뜨기, 가운데 안뜨기 1코 (1/1/1 RPC)"], ["rc111cp", "오른코 위 1코 교차뜨기, 가운데 안뜨기 1코 (1/1/1 LPC)"]],
  cross2: [["lc22", "왼코 위 2코 교차뜨기 (2/2 RC)"], ["rc22", "오른코 위 2코 교차뜨기 (2/2 LC)"], ["lc22_p", "왼코 위 2코 교차뜨기, 안뜨기 바탕 (2/2 RPC)"], ["rc22_p", "오른코 위 2코 교차뜨기, 안뜨기 바탕 (2/2 LPC)"], ["lc31", "왼코 위 3코 교차뜨기 (3/1 RC)"], ["rc31", "오른코 위 3코 교차뜨기 (3/1 LC)"], ["lc31_p", "왼코 위 3코 교차뜨기, 안뜨기 바탕 (3/1 RPC)"], ["rc31_p", "오른코 위 3코 교차뜨기, 안뜨기 바탕 (3/1 LPC)"], ["lc13", "왼코 위 1코 교차뜨기 (1/3 RC)"], ["rc13", "오른코 위 1코 교차뜨기 (1/3 LC)"], ["lc13_p", "왼코 위 1코 교차뜨기, 안뜨기 바탕 (1/3 RPC)"], ["rc13_p", "오른코 위 1코 교차뜨기, 안뜨기 바탕 (1/3 LPC)"], ["lc121ck", "왼코 위 1코 교차뜨기, 가운데 겉뜨기 2코 (1/2/1 RC)"], ["rc121ck", "오른코 위 1코 교차뜨기, 가운데 겉뜨기 2코 (1/2/1 LC)"], ["lc121cp", "왼코 위 1코 교차뜨기, 가운데 안뜨기 2코 (1/2/1 RPC)"], ["rc121cp", "오른코 위 1코 교차뜨기, 가운데 안뜨기 2코 (1/2/1 LPC)"], ["lc212ck", "왼코 위 2코 교차뜨기, 가운데 겉뜨기 1코 (2/1/2 RC)"], ["rc212ck", "오른코 위 2코 교차뜨기, 가운데 겉뜨기 1코 (2/1/2 LC)"], ["lc212cp", "왼코 위 2코 교차뜨기, 가운데 안뜨기 1코 (2/1/2 RPC)"], ["rc212cp", "오른코 위 2코 교차뜨기, 가운데 안뜨기 1코 (2/1/2 LPC)"], ["lc32", "왼코 위 3코 교차뜨기 (3/2 RC)"], ["rc32", "오른코 위 3코 교차뜨기 (3/2 LC)"], ["lc32_p", "왼코 위 3코 교차뜨기, 안뜨기 바탕 (3/2 RPC)"], ["rc32_p", "오른코 위 3코 교차뜨기, 안뜨기 바탕 (3/2 LPC)"], ["lc23", "왼코 위 2코 교차뜨기 (2/3 RC)"], ["rc23", "오른코 위 2코 교차뜨기 (2/3 LC)"], ["lc23_p", "왼코 위 2코 교차뜨기, 안뜨기 바탕 (2/3 RPC)"], ["rc23_p", "오른코 위 2코 교차뜨기, 안뜨기 바탕 (2/3 LPC)"], ["lc41", "왼코 위 4코 교차뜨기 (4/1 RC)"], ["rc41", "오른코 위 4코 교차뜨기 (4/1 LC)"], ["lc41_p", "왼코 위 4코 교차뜨기, 안뜨기 바탕 (4/1 RPC)"], ["rc41_p", "오른코 위 4코 교차뜨기, 안뜨기 바탕 (4/1 LPC)"], ["lc14", "왼코 위 1코 교차뜨기 (1/4 RC)"], ["rc14", "오른코 위 1코 교차뜨기 (1/4 LC)"], ["lc14_p", "왼코 위 1코 교차뜨기, 안뜨기 바탕 (1/4 RPC)"], ["rc14_p", "오른코 위 1코 교차뜨기, 안뜨기 바탕 (1/4 LPC)"], ["lc_k3", "왼교차 (가운데 겉뜨기 3코)"], ["rc_k3", "오른교차 (가운데 겉뜨기 3코)"], ["lc131cp", "왼코 위 1코 교차뜨기, 가운데 안뜨기 3코 (1/3/1 RPC)"], ["rc131cp", "오른코 위 1코 교차뜨기, 가운데 안뜨기 3코 (1/3/1 LPC)"]],
  cross3: [["lc33", "왼코 위 3코 교차뜨기 (3/3 RC)"], ["rc33", "오른코 위 3코 교차뜨기 (3/3 LC)"], ["lc33_p", "왼코 위 3코 교차뜨기, 안뜨기 바탕 (3/3 RPC)"], ["rc33_p", "오른코 위 3코 교차뜨기, 안뜨기 바탕 (3/3 LPC)"], ["lc42", "왼코 위 4코 교차뜨기 (4/2 RC)"], ["rc42", "오른코 위 4코 교차뜨기 (4/2 LC)"], ["lc42_p", "왼코 위 4코 교차뜨기, 안뜨기 바탕 (4/2 RPC)"], ["rc42_p", "오른코 위 4코 교차뜨기, 안뜨기 바탕 (4/2 LPC)"], ["lc24", "왼코 위 2코 교차뜨기 (2/4 RC)"], ["rc24", "오른코 위 2코 교차뜨기 (2/4 LC)"], ["lc24_p", "왼코 위 2코 교차뜨기, 안뜨기 바탕 (2/4 RPC)"], ["rc24_p", "오른코 위 2코 교차뜨기, 안뜨기 바탕 (2/4 LPC)"], ["lc222ck", "왼코 위 2코 교차뜨기, 가운데 겉뜨기 2코 (2/2/2 RC)"], ["rc222ck", "오른코 위 2코 교차뜨기, 가운데 겉뜨기 2코 (2/2/2 LC)"], ["lc222cp", "왼코 위 2코 교차뜨기, 가운데 안뜨기 2코 (2/2/2 RPC)"], ["rc222cp", "오른코 위 2코 교차뜨기, 가운데 안뜨기 2코 (2/2/2 LPC)"]],
  cross4: [["lc43", "왼코 위 4코 교차뜨기 (4/3 RC)"], ["rc43", "오른코 위 4코 교차뜨기 (4/3 LC)"], ["lc43_p", "왼코 위 4코 교차뜨기, 안뜨기 바탕 (4/3 RPC)"], ["rc43_p", "오른코 위 4코 교차뜨기, 안뜨기 바탕 (4/3 LPC)"], ["lc34", "왼코 위 3코 교차뜨기 (3/4 RC)"], ["rc34", "오른코 위 3코 교차뜨기 (3/4 LC)"], ["lc34_p", "왼코 위 3코 교차뜨기, 안뜨기 바탕 (3/4 RPC)"], ["rc34_p", "오른코 위 3코 교차뜨기, 안뜨기 바탕 (3/4 LPC)"], ["lc313ck", "왼코 위 3코 교차뜨기, 가운데 겉뜨기 1코 (3/1/3 RC)"], ["rc313ck", "오른코 위 3코 교차뜨기, 가운데 겉뜨기 1코 (3/1/3 LC)"], ["lc313cp", "왼코 위 3코 교차뜨기, 가운데 안뜨기 1코 (3/1/3 RPC)"], ["rc313cp", "오른코 위 3코 교차뜨기, 가운데 안뜨기 1코 (3/1/3 LPC)"], ["lc232ck", "왼코 위 2코 교차뜨기, 가운데 겉뜨기 3코 (2/3/2 RC)"], ["rc232ck", "오른코 위 2코 교차뜨기, 가운데 겉뜨기 3코 (2/3/2 LC)"], ["lc232cp", "왼코 위 2코 교차뜨기, 가운데 안뜨기 3코 (2/3/2 RPC)"], ["rc232cp", "오른코 위 2코 교차뜨기, 가운데 안뜨기 3코 (2/3/2 LPC)"], ["lc44", "왼코 위 4코 교차뜨기 (4/4 RC)"], ["rc44", "오른코 위 4코 교차뜨기 (4/4 LC)"], ["lc44_p", "왼코 위 4코 교차뜨기, 안뜨기 바탕 (4/4 RPC)"], ["rc44_p", "오른코 위 4코 교차뜨기, 안뜨기 바탕 (4/4 LPC)"], ["lc323ck", "왼코 위 3코 교차뜨기, 가운데 겉뜨기 2코 (3/2/3 RC)"], ["rc323ck", "오른코 위 3코 교차뜨기, 가운데 겉뜨기 2코 (3/2/3 LC)"], ["lc323cp", "왼코 위 3코 교차뜨기, 가운데 안뜨기 2코 (3/2/3 RPC)"], ["rc323cp", "오른코 위 3코 교차뜨기, 가운데 안뜨기 2코 (3/2/3 LPC)"]],
  cross5: [["lc333ck", "왼코 위 3코 교차뜨기, 가운데 겉뜨기 3코 (3/3/3 RC)"], ["rc333ck", "오른코 위 3코 교차뜨기, 가운데 겉뜨기 3코 (3/3/3 LC)"], ["lc333cp", "왼코 위 3코 교차뜨기, 가운데 안뜨기 3코 (3/3/3 RPC)"], ["rc333cp", "오른코 위 3코 교차뜨기, 가운데 안뜨기 3코 (3/3/3 LPC)"], ["lc414ck", "왼코 위 4코 교차뜨기, 가운데 겉뜨기 1코 (4/1/4 RC)"], ["rc414ck", "오른코 위 4코 교차뜨기, 가운데 겉뜨기 1코 (4/1/4 LC)"], ["lc414cp", "왼코 위 4코 교차뜨기, 가운데 안뜨기 1코 (4/1/4 RPC)"], ["rc414cp", "오른코 위 4코 교차뜨기, 가운데 안뜨기 1코 (4/1/4 LPC)"], ["lc55", "왼코 위 5코 교차뜨기 (5/5 RC)"], ["rc55", "오른코 위 5코 교차뜨기 (5/5 LC)"], ["lc55_p", "왼코 위 5코 교차뜨기, 안뜨기 바탕 (5/5 RPC)"], ["rc55_p", "오른코 위 5코 교차뜨기, 안뜨기 바탕 (5/5 LPC)"], ["lc66", "왼코 위 6코 교차뜨기 (6/6 RC)"], ["rc66", "오른코 위 6코 교차뜨기 (6/6 LC)"], ["lc66_p", "왼코 위 6코 교차뜨기, 안뜨기 바탕 (6/6 RPC)"], ["rc66_p", "오른코 위 6코 교차뜨기, 안뜨기 바탕 (6/6 LPC)"], ["lc444ck", "왼코 위 4코 교차뜨기, 가운데 겉뜨기 4코 (4/4/4 RC)"], ["rc444ck", "오른코 위 4코 교차뜨기, 가운데 겉뜨기 4코 (4/4/4 LC)"], ["lc444cp", "왼코 위 4코 교차뜨기, 가운데 안뜨기 4코 (4/4/4 RPC)"], ["rc444cp", "오른코 위 4코 교차뜨기, 가운데 안뜨기 4코 (4/4/4 LPC)"]],
  special: [["bobble", "방울뜨기"], ["bobble3", "3코 방울뜨기"], ["bobble5", "5코 방울뜨기"], ["bobble7", "7코 방울뜨기"], ["nupp3", "누프 (nupp, 3코)"], ["nupp", "누프 (nupp, 5코)"], ["nupp7", "누프 (nupp, 7코)"], ["knit_below", "아랫코에 겉뜨기"], ["purl_below", "아랫코에 안뜨기 (p1b)"], ["tuck", "끌어올려뜨기 (2단 引上げ目)"], ["tuck3", "끌어올려뜨기 (3단)"], ["tuck4", "끌어올려뜨기 (4단)"], ["tuck_twist", "꼬아 끌어올려뜨기"], ["tuck_twist3", "꼬아 끌어올려뜨기 (3단)"], ["tuck_twist4", "꼬아 끌어올려뜨기 (4단)"], ["dip_purl2", "안뜨기 끌어올려뜨기 (2단, 1/2 dip purl)"], ["slip_tall2", "2단 걸러뜨기 (1/2 sl)"], ["slip_p_tall2", "2단 걸러뜨기, 실 앞에 두고 (1/2 sl wyif)"], ["psso3", "코 씌우기 (겉1·바늘비우기·겉1 위로 씌움)"], ["elong2", "실 2번 감아 겉뜨기 (늘어뜨리기)"], ["elong3", "실 3번 감아 겉뜨기 (늘어뜨리기)"], ["elong4", "실 4번 감아 겉뜨기 (늘어뜨리기)"], ["elong2p", "실 2번 감아 안뜨기 (늘어뜨리기)"], ["elong3p", "실 3번 감아 안뜨기 (늘어뜨리기)"], ["elong4p", "실 4번 감아 안뜨기 (늘어뜨리기)"], ["wrap2", "2코 감싸뜨기 (wrap 2)"], ["wrap3", "3코 감싸뜨기 (wrap 3)"], ["wrap4", "4코 감싸뜨기 (wrap 4)"], ["gather2", "에스토니안 모아뜨기 2-2 (gathered 2-2)"], ["gather3", "에스토니안 모아뜨기 3-3 (gathered 3-3)"], ["drop", "코 풀어내리기 (드롭 스티치)"], ["pickup", "코줍기 (pick up and knit)"], ["bead", "비즈 넣기"], ["bead_p", "비즈 넣고 안뜨기 (PB purl)"]],
  markers: [["pm", "마커 걸기 (PM)"], ["sm", "마커 옮기기 (SM)"], ["sm_l", "마커 왼쪽으로 옮기기"], ["sm_r", "마커 오른쪽으로 옮기기"]],
  short_rows: [["wrap_turn", "감아 돌리기 (W&T, 되돌아뜨기)"], ["wrap_turn_ws", "감아 돌리기 (안면, W&T)"], ["double_st", "더블 스티치 (독일식 되돌아뜨기 DS)"], ["turn_rs", "돌리기 (겉면)"], ["turn_ws", "돌리기 (안면)"], ["srl", "왼쪽 되돌아뜨기 (SRL)"], ["srr", "오른쪽 되돌아뜨기 (SRR)"]],
  brioche: [["brk", "브리오슈 겉뜨기 (brk)"], ["brp", "브리오슈 안뜨기 (brp)"], ["brk_tbl", "브리오슈 겉뜨기 꼬아뜨기 (brk tbl)"], ["sl1yo", "걸러뜨기+바늘비우기 (sl1yo)"], ["sl2yo", "걸러뜨기 2코+바늘비우기 (sl2yo)"], ["sl3yo", "걸러뜨기 3코+바늘비우기 (sl3yo)"], ["sl4yo", "걸러뜨기 4코+바늘비우기 (sl4yo)"], ["sl5yo", "걸러뜨기 5코+바늘비우기 (sl5yo)"], ["sl6yo", "걸러뜨기 6코+바늘비우기 (sl6yo)"], ["sl7yo", "걸러뜨기 7코+바늘비우기 (sl7yo)"], ["sl8yo", "걸러뜨기 8코+바늘비우기 (sl8yo)"], ["brkyobrk", "브리오슈 겉-바늘비우기-겉 (brk-yo-brk, 1코→3코)"], ["brk2tog", "브리오슈 왼코 겹쳐 2코 모아뜨기 (brk2tog)"], ["brk3tog", "브리오슈 왼코 겹쳐 3코 모아뜨기 (brk3tog)"], ["brp2tog", "브리오슈 왼코 겹쳐 2코 모아 안뜨기 (brp2tog)"], ["brp3tog", "브리오슈 왼코 겹쳐 3코 모아 안뜨기 (brp3tog)"], ["brssk", "브리오슈 오른코 겹쳐 2코 모아뜨기 (brssk)"], ["brssp", "브리오슈 오른코 겹쳐 2코 모아 안뜨기 (brssp)"], ["brsssk", "브리오슈 오른코 겹쳐 3코 모아뜨기 (brsssk)"], ["brsssp", "브리오슈 오른코 겹쳐 3코 모아 안뜨기 (brsssp)"], ["brcdd", "브리오슈 중심 3코 모아뜨기 (brCDD)"], ["brcddp", "브리오슈 중심 3코 모아 안뜨기 (brCDDp)"]],
  chars: [["char_0", "숫자 0"], ["char_1", "숫자 1"], ["char_2", "숫자 2"], ["char_3", "숫자 3"], ["char_4", "숫자 4"], ["char_5", "숫자 5"], ["char_6", "숫자 6"], ["char_7", "숫자 7"], ["char_8", "숫자 8"], ["char_9", "숫자 9"], ["char_a", "글자 A"], ["char_b", "글자 B"], ["char_c", "글자 C"], ["char_d", "글자 D"], ["char_e", "글자 E"], ["char_f", "글자 F"], ["char_g", "글자 G"], ["char_h", "글자 H"], ["char_i", "글자 I"], ["char_j", "글자 J"], ["char_k", "글자 K"], ["char_l", "글자 L"], ["char_m", "글자 M"], ["char_n", "글자 N"], ["char_o", "글자 O"], ["char_p", "글자 P"], ["char_q", "글자 Q"], ["char_r", "글자 R"], ["char_s", "글자 S"], ["char_t", "글자 T"], ["char_u", "글자 U"], ["char_v", "글자 V"], ["char_w", "글자 W"], ["char_x", "글자 X"], ["char_y", "글자 Y"], ["char_z", "글자 Z"]],
};

// ---------- catalogue ----------

const GROUP_IDS = Object.keys(CATALOG) as KnitGroupId[];

export const KNIT_GROUPS: { id: KnitGroupId; label: string }[] = KNIT_GROUP_LIST.map(([id, label]) => ({ id, label }));

const LABELS = new Map<string, string>();
for (const g of GROUP_IDS) for (const [k, name] of CATALOG[g]) LABELS.set(`k_${k}`, name);

export const KNIT_SYMBOLS: KnitSymbol[] = GROUP_IDS.flatMap((group) =>
  CATALOG[group].map(([k, name]) => {
    const id = `k_${k}`;
    const mirror = mirrorOf(id);
    return { id, name, group, width: widthOf(id), mirror: mirror && LABELS.has(mirror) ? mirror : undefined, keywords: k.replace(/_/g, " ") };
  }),
);

/** ids used by documents saved before the full catalogue */
const ALIAS: Record<string, string> = {
  k: "k_knit",
  k0: "k_knit",
  p: "k_purl",
  sl: "k_slip",
  yo: "k_yo",
  bo: "k_bind_off",
  ns: "k_blank",
  m1r: "k_m1r",
  m1l: "k_m1l",
  co: "k_cast_on",
  ktbl: "k_twist_k",
  ptbl: "k_twist_p",
  c1r: "k_rc",
  c1l: "k_lc",
  c1rp: "k_rc_p",
  c1lp: "k_lc_p",
  c21r: "k_rc21",
  c21l: "k_lc21",
  c2r: "k_rc22",
  c2l: "k_lc22",
  c32r: "k_rc32",
  c32l: "k_lc32",
  c3r: "k_rc33",
  c3l: "k_lc33",
  bob: "k_bobble",
  slp: "k_slip_p",
  wrap3: "k_wrap3",
  k2tog: "k_k2tog",
  ssk: "k_ssk",
  p2tog: "k_p2tog",
  cdd: "k_cdd3",
  k3tog: "k_k3tog",
  sssk: "k_ssk3",
  mkv: "k_pm",
  mkh: "k_pm",
  mks: "k_pm",
  mkc: "k_sm",
  chx: "k_char_x",
  ...Object.fromEntries(Array.from({ length: 9 }, (_, i) => [`n${i + 1}`, `k_char_${i + 1}`])),
};
/** canonical id for a stored symbol id (old ids map to the catalogue) */
export const canonicalSymbol = (id: string) => ALIAS[id] ?? id;

const BY_ID = new Map(KNIT_SYMBOLS.map((s) => [s.id, s]));
const DYN = new Map<string, KnitSymbol | null>();
const GLYPHS = new Map<string, Glyph | null>();
const glyph = (id: string) => {
  if (!GLYPHS.has(id)) GLYPHS.set(id, glyphOf(id));
  return GLYPHS.get(id) ?? null;
};

/** looks up a symbol; parametric ids outside the catalogue (e.g. k_lc77) are generated on demand */
export const knitSymbol = (raw: string | undefined): KnitSymbol | undefined => {
  if (!raw) return undefined;
  const id = canonicalSymbol(raw);
  const hit = BY_ID.get(id);
  if (hit) return hit;
  if (!DYN.has(id)) {
    const g = id.startsWith("k_") ? glyph(id) : null;
    DYN.set(id, g ? { id, name: knitLabel(id), group: "special", width: widthOf(id), mirror: mirrorOf(id) } : null);
  }
  return DYN.get(id) ?? undefined;
};
export const MAX_SYMBOL_WIDTH = Math.max(...KNIT_SYMBOLS.map((s) => s.width));

/** the eraser tool and the "no stitch" cell */
export const ERASE_ID = "k_empty";
export const BLANK_ID = "k_blank";

const ATTRS = 'fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke"';
/** applies non-scaling strokes to every element of a glyph */
const nonScaling = (svg: string) => svg.replace(/<(path|circle|ellipse|line|polyline|polygon|rect)\b/g, '<$1 vector-effect="non-scaling-stroke"');

export const symbolStroke = 1.3;

/** inner markup of a symbol for a 24·w × 24 box */
export function glyphMarkup(id: string, chart = false): string {
  const s = knitSymbol(id);
  if (!s) return "";
  const g = glyph(s.id);
  if (!g) return "";
  return nonScaling(chart && g.chart !== undefined ? g.chart : g.svg);
}

/**
 * `<symbol>` definitions for <use href="#prefix-id" width height>; each symbol keeps a 24-per-stitch viewBox
 * and is stretched (crossings) or centred (single stitches) inside the chart cell.
 */
export function symbolDefs(_cw: number, _ch: number, prefix = "ks", only?: Set<string>, strokeWidth = symbolStroke) {
  let out = "";
  const ids = only ? [...only].map(canonicalSymbol) : KNIT_SYMBOLS.map((s) => s.id);
  for (const id of new Set(ids)) {
    const s = knitSymbol(id);
    if (!s) continue;
    const g = glyph(s.id);
    if (!g) continue;
    const ar = g.stretch || g.chart !== undefined ? "none" : "xMidYMid meet";
    out += `<symbol id="${prefix}-${s.id}" viewBox="0 0 ${s.width * U} ${U}" preserveAspectRatio="${ar}" overflow="visible"><g ${ATTRS} stroke-width="${strokeWidth}">${glyphMarkup(s.id, true)}</g></symbol>`;
  }
  return out;
}

/** Standalone SVG string of one symbol at chart size (for raster caches). */
export function symbolSvg(id: string, cw: number, ch: number, color = "#222") {
  const s = knitSymbol(id);
  if (!s) return "";
  const g = glyph(s.id);
  if (!g) return "";
  const w = cw * s.width;
  const ar = g.stretch || g.chart !== undefined ? "none" : "xMidYMid meet";
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${f(w)}" height="${f(ch)}" viewBox="0 0 ${s.width * U} ${U}" preserveAspectRatio="${ar}" color="${color}"><g ${ATTRS} stroke-width="${symbolStroke}">${glyphMarkup(s.id, true)}</g></svg>`;
}

/** palette size of a symbol: one stitch 22×22, two 44×22, wider ones fit 52px wide */
export function paletteSize(width: number) {
  if (width <= 1) return { w: 22, h: 22 };
  if (width === 2) return { w: 44, h: 22 };
  return { w: 52, h: 52 / width };
}

/** Palette preview of a symbol (same sizing as the reference palette). */
export function KnitSymbolIcon({ id, className, scale = 1 }: { id: string; className?: string; scale?: number }) {
  const s = knitSymbol(id);
  if (!s) return null;
  const { w, h } = paletteSize(s.width);
  return (
    <svg
      width={w * scale}
      height={h * scale}
      viewBox={`0 0 ${s.width * U} ${U}`}
      preserveAspectRatio="xMidYMid meet"
      overflow="visible"
      fill="none"
      className={className ?? "shrink-0 overflow-visible text-fg-neutral"}
      aria-hidden="true"
      style={{ overflow: "visible" }}
    >
      <g
        stroke="currentColor"
        strokeWidth={1.2}
        strokeLinecap="round"
        strokeLinejoin="round"
        dangerouslySetInnerHTML={{ __html: glyphMarkup(s.id) }}
      />
    </svg>
  );
}
