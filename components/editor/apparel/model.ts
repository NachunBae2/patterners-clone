// Garment pattern drafting: measurements + ease + gauge → stitch-accurate pieces.
// Every number shown in the editor comes from here: cm are turned into stitches and rows with the
// gauge, shaping is spread evenly over the rows available, and each piece outline is traced from a
// row-by-row simulation of its edges, so the drawing is exactly what the instructions knit.
import type { ApparelData, ApparelFit, ApparelMeasure, ApparelPiece, ApparelSize, ApparelStyle } from "@/lib/types";

// ---------- presets ----------

type SizeRow = Pick<ApparelMeasure, "bust" | "bodyLength" | "shoulderWidth" | "armholeDepth" | "sleeveLength" | "upperArm" | "cuffWidth" | "neckWidth" | "frontNeckDepth" | "backNeckDepth">;

export const SIZES: Record<ApparelSize, SizeRow> = {
  S: { bust: 82, bodyLength: 58, shoulderWidth: 36, armholeDepth: 18, sleeveLength: 54, upperArm: 26, cuffWidth: 17, neckWidth: 16, frontNeckDepth: 7.5, backNeckDepth: 2 },
  M: { bust: 88, bodyLength: 60, shoulderWidth: 38, armholeDepth: 19, sleeveLength: 56, upperArm: 28, cuffWidth: 18, neckWidth: 17, frontNeckDepth: 8, backNeckDepth: 2 },
  L: { bust: 96, bodyLength: 62, shoulderWidth: 40, armholeDepth: 20, sleeveLength: 57, upperArm: 31, cuffWidth: 19, neckWidth: 18, frontNeckDepth: 8.5, backNeckDepth: 2.5 },
  XL: { bust: 104, bodyLength: 64, shoulderWidth: 42, armholeDepth: 21, sleeveLength: 58, upperArm: 34, cuffWidth: 20, neckWidth: 19, frontNeckDepth: 9, backNeckDepth: 2.5 },
};

export const FIT_EASE: Record<ApparelFit, ApparelData["ease"]> = {
  slim: { bust: 4, armhole: 1, upperArm: 2 },
  regular: { bust: 10, armhole: 2, upperArm: 4 },
  over: { bust: 24, armhole: 4, upperArm: 8 },
};

export const DEFAULT_GAUGE = { knit: { sts: 22, rows: 30 }, crochet: { sts: 18, rows: 20 } } as const;

/** V-neck front depth used when switching the neckline (kept when it is already deeper). */
export const V_NECK_EXTRA = 8;

// ---------- small math ----------

const even = (n: number) => Math.max(0, 2 * Math.round(n / 2));
const clampN = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export type Group = { every: number; sts: number; times: number };

/**
 * Spreads `n` single shapings over `R` rows as evenly as knitting allows:
 * intervals of `a` and `a+2` rows (shaping stays on right-side rows), or several stitches per
 * shaping row when there are fewer rows than shapings. Faster groups come first.
 */
export function spread(n: number, R: number, minEvery = 2): Group[] {
  n = Math.max(0, Math.round(n));
  R = Math.max(0, Math.floor(R));
  if (n === 0) return [];
  if (R < minEvery) return [{ every: Math.max(1, R), sts: n, times: 1 }];
  if (R >= n * minEvery) {
    const step = minEvery >= 2 ? 2 : 1;
    let a = Math.floor(R / n);
    if (step === 2 && a % 2) a -= 1;
    a = Math.max(minEvery, a);
    const y = clampN(Math.floor((R - n * a) / step), 0, n);
    return [
      { every: a, sts: 1, times: n - y },
      { every: a + step, sts: 1, times: y },
    ].filter((g) => g.times > 0);
  }
  const slots = Math.max(1, Math.floor(R / minEvery));
  const q = Math.floor(n / slots);
  const r = n % slots;
  return [
    { every: minEvery, sts: q + 1, times: r },
    { every: minEvery, sts: q, times: slots - r },
  ].filter((g) => g.times > 0 && g.sts > 0);
}

const groupSts = (gs: Group[]) => gs.reduce((s, g) => s + g.sts * g.times, 0);
export const notation = (g: Group) => `${g.every}-${g.sts}-${g.times}`;

// ---------- pieces ----------

export type Role = "hem" | "side" | "armhole" | "neck" | "shoulder" | "raglan" | "cap" | "sleeveSeam" | "cuff" | "edge";

export type Step =
  | { kind: "castOn"; row: 0; sts: number }
  | { kind: "rib"; from: number; to: number; rows: number; role: Role }
  | { kind: "straight"; from: number; to: number; rows: number; role: Role }
  | { kind: "bindOff"; from: number; to: number; sts: number; role: Role }
  | { kind: "center"; from: number; to: number; sts: number; role: Role }
  | { kind: "shape"; from: number; to: number; role: Role; dir: "dec" | "inc"; groups: Group[] }
  | { kind: "top"; from: number; to: number; sts: number; role: Role };

export type Pt = [number, number]; // stitches, rows

export type Piece = {
  id: ApparelPiece;
  name: string;
  count: number; // pieces to knit
  symmetric: boolean; // drawn mirrored around x = 0
  castOn: number;
  rows: number; // total rows
  widest: number; // stitches
  /** outline of one half in stitch/row units (x right, y up; mirrored when symmetric) */
  outline: Pt[];
  outerLine: Pt[];
  /** inner (neck / centre) edge of the half */
  neckLine: Pt[];
  steps: Step[];
  /** notable rows for dimension lines */
  marks: { underarm: number; shoulder: number; neck: number; rib: number; capTop?: number };
  /** half widths in stitches at those marks */
  widths: { hem: number; bust: number; shoulder: number; neck: number; top: number };
  sidesNote: "both" | "half";
};

/** Edge changes by row; `jog` rows are bind-offs (drawn as a horizontal step), `anchor` rows end a straight run. */
type Ev = Map<number, number> & { jog: Set<number>; anchor: Set<number> };
const newEv = (): Ev => Object.assign(new Map<number, number>(), { jog: new Set<number>(), anchor: new Set<number>() });
const addEv = (m: Ev, row: number, delta: number) => {
  m.set(row, (m.get(row) ?? 0) + delta);
  m.jog.add(row);
};

/** Writes groups as events starting after `start`; returns the last row used. */
function putGroups(m: Ev, start: number, groups: Group[], sign: 1 | -1) {
  let r = start;
  if (groups.length) m.anchor.add(start);
  for (const g of groups)
    for (let t = 0; t < g.times; t++) {
      r += g.every;
      m.set(r, (m.get(r) ?? 0) + sign * g.sts);
    }
  return r;
}

/** Row-by-row edges of one half; stops when the outer edge meets the inner one. */
function simulate(maxRows: number, outer0: number, outerEv: Ev, innerEv: Ev) {
  const outer = [outer0];
  const inner = [0];
  let o = outer0;
  let i = 0;
  let top = maxRows;
  for (let r = 1; r <= maxRows; r++) {
    o += outerEv.get(r) ?? 0;
    i += innerEv.get(r) ?? 0;
    if (o < i) o = i;
    outer.push(o);
    inner.push(i);
    if (o <= i) {
      top = r;
      break;
    }
  }
  return { outer, inner, top };
}

/** Polyline of an edge: bind-offs make a horizontal jog, spread shapings a slope. */
function edgeLine(vals: number[], top: number, ev?: Ev): Pt[] {
  const pts: Pt[] = [[vals[0], 0]];
  for (let r = 1; r <= top; r++) {
    const prev = vals[r - 1];
    const v = vals[r];
    if (v !== prev) {
      if (r === top) pts.push([prev, r], [v, r]);
      else if (ev?.jog.has(r)) pts.push([prev, r - 1], [v, r - 1]);
      else pts.push([v, r]);
    }
    if (ev?.anchor.has(r) && pts[pts.length - 1][1] < r) pts.push([v, r]);
  }
  const last = pts[pts.length - 1];
  if (last[1] !== top) pts.push([vals[top], top]);
  return pts;
}

function halfOutline(outer: number[], inner: number[], top: number, oj?: Ev, ij?: Ev) {
  const o = edgeLine(outer, top, oj);
  const full = edgeLine(inner, top, ij);
  // the part of the inner edge that runs along the centre line (or a cardigan's front edge)
  let k = 0;
  while (k + 1 < full.length && full[k + 1][0] === 0) k++;
  return { o, i: full.slice(k), full };
}

export function polyLength(pts: Pt[], gs: number, gr: number, fromRow = -Infinity, toRow = Infinity) {
  let len = 0;
  for (let k = 1; k < pts.length; k++) {
    const [x0, y0] = pts[k - 1];
    const [x1, y1] = pts[k];
    if (Math.max(y0, y1) <= fromRow || Math.min(y0, y1) >= toRow) continue;
    len += Math.hypot((x1 - x0) / gs, (y1 - y0) / gr);
  }
  return len;
}

// ---------- drafting ----------

export type Draft = {
  pieces: Piece[];
  finished: { bust: number; armhole: number; upperArm: number; length: number };
  gs: number; // stitches per cm
  gr: number; // rows per cm
  bands: { neck: { cm: number; sts: number }; armhole?: { cm: number; sts: number }; front?: { cm: number; sts: number; rows: number; holes: number[]; holeRow: number } };
  warnings: string[];
  raglanRows?: number;
};

type Half = {
  outer0: number;
  outerEv: Ev;
  innerEv: Ev;
  steps: Step[];
  maxRows: number;
  marks: Piece["marks"];
};

export function draft(d: ApparelData): Draft {
  const m = d.measure;
  const gs = Math.max(1, d.gauge.sts) / 10;
  const gr = Math.max(1, d.gauge.rows) / 10;
  const st = (cm: number) => Math.round(cm * gs);
  const rw = (cm: number) => Math.round(cm * gr);
  const warnings: string[] = [];
  const style: ApparelStyle = d.style;

  const B = m.bust + d.ease.bust;
  const AH = m.armholeDepth + d.ease.armhole + (style === "vest" ? 2 : 0);
  const UA = m.upperArm + d.ease.upperArm;
  const L = m.bodyLength;

  const W = Math.max(8, even(st(B / 2)));
  const ribRows = Math.max(0, rw(m.hemRib));
  const T = Math.max(ribRows + 10, rw(L));
  const SR = Math.max(0, rw(m.shoulderDrop));
  const raglan = style === "raglan";
  const RR = raglan ? Math.max(6, rw(AH + 3)) : 0;
  const A = raglan ? T - RR : Math.max(ribRows + 2, T - SR - rw(AH)); // last row below the underarm
  const N = Math.max(4, even(st(m.neckWidth)));
  const S = style === "dropShoulder" ? W : Math.min(W, Math.max(N + 4, even(st(style === "vest" ? m.shoulderWidth - 2 : m.shoulderWidth))));
  const bandSts = d.cardigan ? even(st(d.bandWidth)) : 0;
  const shoulderStart = T - SR; // first shoulder bind-off happens after this row

  // ---- body half (shared by back and front) ----
  const armholeB0 = raglan ? Math.max(1, st(2)) : style === "dropShoulder" ? 0 : Math.round(((W - S) / 2) * 0.4);

  const bodyHalf = (front: boolean): Half & { b0: number } => {
    const half0 = front && d.cardigan ? Math.max(4, Math.round((W - bandSts) / 2)) : W / 2;
    const outerEv = newEv();
    const innerEv = newEv();
    const steps: Step[] = [];
    if (ribRows) steps.push({ kind: "rib", from: 1, to: ribRows, rows: ribRows, role: "hem" });
    steps.push({ kind: "straight", from: ribRows + 1, to: A, rows: A - ribRows, role: "side" });
    let outerNow = half0;
    // centre offset: a cardigan half starts at the front edge, past the band
    const centreShift = front && d.cardigan ? bandSts / 2 : 0;

    if (raglan) {
      const topHalf = Math.max(2, even(st(m.neckWidth * 0.75)) / 2);
      addEv(outerEv, A + 1, -armholeB0);
      steps.push({ kind: "bindOff", from: A + 1, to: A + 1, sts: armholeB0, role: "armhole" });
      const dec = Math.max(0, outerNow - armholeB0 - topHalf - (front && d.cardigan ? 0 : 0));
      const groups = spread(dec, RR - 2);
      const end = putGroups(outerEv, A + 1, groups, -1);
      if (groups.length) steps.push({ kind: "shape", from: A + 2, to: end, role: "raglan", dir: "dec", groups });
      outerNow = outerNow - armholeB0 - groupSts(groups);
      if (!front) {
        if (end < T - 1) steps.push({ kind: "straight", from: end + 1, to: T - 1, rows: T - 1 - end, role: "raglan" });
        addEv(outerEv, T, -outerNow);
        steps.push({ kind: "top", from: T, to: T, sts: outerNow * 2, role: "neck" });
        return { outer0: half0, outerEv, innerEv, steps, maxRows: T, marks: { underarm: A, shoulder: T, neck: T, rib: ribRows }, b0: armholeB0 };
      }
      // front neck inside the raglan
      const F = Math.max(A + 2, T - rw(m.frontNeckDepth));
      const target = outerNow; // inner edge must reach the raglan top
      const v = d.neckline === "v";
      const c0 = v ? 0 : Math.round(target * 0.4);
      if (c0 > 0) {
        addEv(innerEv, F, c0);
        steps.push({ kind: "center", from: F, to: F, sts: d.cardigan ? c0 : c0 * 2, role: "neck" });
      }
      const k = Math.max(0, target - c0);
      const ng = spread(k, T - F - 1);
      const nEnd = putGroups(innerEv, F, ng, 1);
      if (ng.length) steps.push({ kind: "shape", from: F + 1, to: nEnd, role: "neck", dir: "dec", groups: ng });
      return { outer0: half0, outerEv, innerEv, steps, maxRows: T + 2, marks: { underarm: A, shoulder: T, neck: F, rib: ribRows }, b0: armholeB0 };
    }

    // set-in / vest armhole
    let armEnd = A;
    if (style !== "dropShoulder") {
      const a = Math.max(0, outerNow - S / 2);
      if (armholeB0 > 0) {
        addEv(outerEv, A + 1, -armholeB0);
        steps.push({ kind: "bindOff", from: A + 1, to: A + 1, sts: armholeB0, role: "armhole" });
      }
      const groups = spread(a - armholeB0, Math.max(2, rw(AH * 0.35)));
      armEnd = putGroups(outerEv, A + 1, groups, -1);
      if (groups.length) steps.push({ kind: "shape", from: A + 2, to: armEnd, role: "armhole", dir: "dec", groups });
      outerNow -= armholeB0 + groupSts(groups);
    }
    if (armEnd < shoulderStart) steps.push({ kind: "straight", from: armEnd + 1, to: shoulderStart, rows: shoulderStart - armEnd, role: "armhole" });

    // neck
    const neckHalf = N / 2;
    const v = d.neckline === "v" && front;
    const depthRows = front ? Math.max(2, rw(m.frontNeckDepth)) : Math.max(2, rw(m.backNeckDepth));
    const F = T - depthRows + 1; // first neck row
    const kShare = front ? 0.3 : 0.12;
    const k = v ? Math.max(0, neckHalf - centreShift) : clampN(Math.round(neckHalf * kShare * 2), 1, neckHalf);
    const centreHalf = v ? 0 : Math.max(0, neckHalf - k);
    const c0 = Math.max(0, centreHalf - centreShift);
    if (c0 > 0) {
      addEv(innerEv, F, c0);
      steps.push({ kind: "center", from: F, to: F, sts: front && d.cardigan ? c0 : c0 * 2, role: "neck" });
    }
    const kk = v ? k : Math.max(0, neckHalf - centreShift - c0);
    const neckRows = v ? Math.max(1, T - F - rw(2)) : Math.max(1, Math.round((T - F) * (front ? 0.65 : 1)));
    const ng = spread(kk, neckRows);
    const nEnd = putGroups(innerEv, v ? F - 1 : F, ng, 1);
    if (ng.length) steps.push({ kind: "shape", from: v ? F : F + 1, to: nEnd, role: "neck", dir: "dec", groups: ng });

    // shoulder slope
    const sh = Math.max(0, outerNow - (neckHalf - centreShift));
    const stepsN = Math.max(1, Math.floor(SR / 2));
    if (SR >= 2 && sh > 0) {
      const sg = sh >= stepsN ? spreadBulk(sh, stepsN) : spread(sh, stepsN * 2);
      putGroups(outerEv, T - stepsN * 2, sg, -1);
      steps.push({ kind: "shape", from: T - stepsN * 2 + 1, to: T, role: "shoulder", dir: "dec", groups: sg });
    } else if (sh > 0) {
      addEv(outerEv, T, -sh);
      steps.push({ kind: "top", from: T, to: T, sts: sh, role: "shoulder" });
    }
    return { outer0: half0, outerEv, innerEv, steps, maxRows: T + 2, marks: { underarm: A, shoulder: shoulderStart, neck: F - 1, rib: ribRows }, b0: armholeB0 };
  };

  const finishBody = (id: ApparelPiece, name: string, h: Half, count: number, symmetric: boolean): Piece => {
    const sim = simulate(h.maxRows, h.outer0, h.outerEv, h.innerEv);
    const { o, i, full } = halfOutline(sim.outer, sim.inner, sim.top, h.outerEv, h.innerEv);
    // a cardigan half keeps its front edge (x = 0) in the outline
    const outline: Pt[] = [...o, ...(symmetric ? i : full).slice().reverse()];
    const at = (r: number) => sim.outer[Math.min(r, sim.top)] ?? 0;
    const inn = (r: number) => sim.inner[Math.min(r, sim.top)] ?? 0;
    const widestHalf = Math.max(...sim.outer.slice(0, sim.top + 1));
    const castOn = symmetric ? h.outer0 * 2 : h.outer0;
    const shoulderRow = Math.min(h.marks.shoulder, sim.top);
    return {
      id,
      name,
      count,
      symmetric,
      castOn,
      rows: sim.top,
      widest: symmetric ? widestHalf * 2 : widestHalf,
      outline,
      outerLine: o,
      neckLine: i,
      steps: h.steps.slice().sort((a, b) => (a.kind === "castOn" ? 0 : a.from) - (b.kind === "castOn" ? 0 : b.from)),
      marks: { ...h.marks, shoulder: shoulderRow },
      widths: { hem: at(0), bust: at(h.marks.underarm), shoulder: at(shoulderRow), neck: inn(sim.top), top: at(sim.top) },
      sidesNote: symmetric ? "both" : "half",
    };
  };

  const pieces: Piece[] = [];
  const back = finishBody("back", "뒤판", bodyHalf(false), 1, true);
  pieces.push(back);
  const front = finishBody("front", d.cardigan ? "앞판 (반쪽)" : "앞판", bodyHalf(true), d.cardigan ? 2 : 1, !d.cardigan);
  pieces.push(front);

  // ---- sleeve ----
  const backArmholeLen = polyLength(back.outerLine, gs, gr, back.marks.underarm, back.marks.shoulder);
  const hasSleeve = style !== "vest";
  let raglanRows: number | undefined;
  if (hasSleeve) {
    const C = Math.max(4, even(st(m.cuffWidth)));
    const U = Math.max(C, even(st(UA)));
    const cuffRows = Math.max(0, rw(m.cuffRib));

    type SleeveHalf = Half & { capStart: number };
    /** Cap (or raglan) shaping above `start`: underarm bind-off, even decreases, flat top. */
    const capEvents = (outerEv: Ev, steps: Step[], start: number, capRows: number, half: number, topSts: number) => {
      const role: Role = raglan ? "raglan" : "cap";
      if (armholeB0 > 0) {
        addEv(outerEv, start + 1, -armholeB0);
        steps.push({ kind: "bindOff", from: start + 1, to: start + 1, sts: armholeB0, role });
        half -= armholeB0;
      }
      const top = start + capRows;
      const cg = spread(Math.max(0, half - topSts / 2), capRows - 2);
      const cEnd = putGroups(outerEv, start + 1, cg, -1);
      if (cg.length) steps.push({ kind: "shape", from: start + 2, to: cEnd, role, dir: "dec", groups: cg });
      half -= groupSts(cg);
      if (cEnd < top - 1) steps.push({ kind: "straight", from: cEnd + 1, to: top - 1, rows: top - 1 - cEnd, role });
      addEv(outerEv, top, -half);
      steps.push({ kind: "top", from: top, to: top, sts: half * 2, role: raglan ? "neck" : "cap" });
      return top;
    };
    /** Cuff rib, even increases to the upper arm, straight to the underarm. */
    const lowerSleeve = (outerEv: Ev, steps: Step[], upper: number, underRows: number) => {
      if (cuffRows) steps.push({ kind: "rib", from: 1, to: cuffRows, rows: cuffRows, role: "cuff" });
      const groups = spread(Math.max(0, (upper - C) / 2), Math.max(2, underRows - cuffRows - rw(3)), 2).reverse(); // slower first
      const incEnd = putGroups(outerEv, cuffRows, groups, 1);
      if (groups.length) steps.push({ kind: "shape", from: cuffRows + 1, to: incEnd, role: "sleeveSeam", dir: "inc", groups });
      if (incEnd < underRows) steps.push({ kind: "straight", from: incEnd + 1, to: underRows, rows: underRows - incEnd, role: "sleeveSeam" });
    };
    const marksFor = (underRows: number, top: number) => ({ underarm: underRows, shoulder: top, neck: top, rib: cuffRows, capTop: top });

    let sleeveHalf: SleeveHalf;
    if (style === "dropShoulder") {
      // the dropped shoulder replaces the cap: sleeve top = armhole circumference
      const top = Math.max(U, even(st(AH * 2)));
      const drop = Math.max(0, W / gs / 2 - m.shoulderWidth / 2);
      const underRows = Math.max(cuffRows + 6, rw(m.sleeveLength - drop));
      const outerEv = newEv();
      const steps: Step[] = [];
      lowerSleeve(outerEv, steps, top, underRows - 1);
      addEv(outerEv, underRows, -top / 2);
      steps.push({ kind: "top", from: underRows, to: underRows, sts: top, role: "cap" });
      sleeveHalf = { outer0: C / 2, outerEv, innerEv: newEv(), steps, maxRows: underRows, marks: marksFor(underRows, underRows), capStart: underRows - 1 };
    } else {
      const topS = raglan ? Math.max(2, even(st(4))) : Math.max(4, even(Math.max(st(7), U * 0.3)));
      let capRows: number;
      if (raglan) {
        capRows = RR; // same rows as the body raglan so the seams match
        raglanRows = RR;
      } else {
        // set-in cap: the cap height whose edge length matches the back armhole edge
        const capLen = (rows: number) => {
          const ev = newEv();
          const top = capEvents(ev, [], 0, rows, U / 2, topS);
          const sim = simulate(top, U / 2, ev, newEv());
          // the underarm bind-off is sewn to the body bind-off, so it is not part of the cap edge
          return polyLength(edgeLine(sim.outer, sim.top, ev), gs, gr, 0.5);
        };
        let lo = Math.max(4, rw(AH * 0.35));
        let hi = Math.max(lo + 1, rw(AH));
        while (hi - lo > 1) {
          const mid = (lo + hi) >> 1;
          if (capLen(mid) < backArmholeLen) lo = mid;
          else hi = mid;
        }
        capRows = Math.abs(capLen(lo) - backArmholeLen) <= Math.abs(capLen(hi) - backArmholeLen) ? lo : hi;
      }
      const underRows = Math.max(cuffRows + 6, raglan ? rw(m.sleeveLength - AH * 0.65) : rw(m.sleeveLength) - capRows);
      const outerEv = newEv();
      const steps: Step[] = [];
      lowerSleeve(outerEv, steps, U, underRows);
      const top = capEvents(outerEv, steps, underRows, capRows, U / 2, topS);
      sleeveHalf = { outer0: C / 2, outerEv, innerEv: newEv(), steps, maxRows: top, marks: marksFor(underRows, top), capStart: underRows };
    }

    const sim = simulate(sleeveHalf.maxRows, sleeveHalf.outer0, sleeveHalf.outerEv, sleeveHalf.innerEv);
    const { o, i } = halfOutline(sim.outer, sim.inner, sim.top, sleeveHalf.outerEv, sleeveHalf.innerEv);
    const capStart = sleeveHalf.capStart;
    pieces.push({
      id: "sleeve",
      name: "소매",
      count: 2,
      symmetric: true,
      castOn: sleeveHalf.outer0 * 2,
      rows: sim.top,
      widest: Math.max(...sim.outer.slice(0, sim.top + 1)) * 2,
      outline: [...o, ...i.slice().reverse()],
      outerLine: o,
      neckLine: i,
      steps: sleeveHalf.steps,
      marks: sleeveHalf.marks,
      widths: { hem: sim.outer[0], bust: sim.outer[Math.min(capStart, sim.top)], shoulder: sim.outer[Math.min(capStart, sim.top)], neck: 0, top: sim.outer[Math.max(0, sim.top - 1)] },
      sidesNote: "both",
    });
  }

  // ---- bands ----
  // neck edge: inner edges of back and front (both halves), plus raglan tops
  const sleeve = pieces.find((p) => p.id === "sleeve");
  const topSts = (p?: Piece) => p?.steps.reduce((v, s) => (s.kind === "top" && s.role === "neck" ? s.sts : v), 0) ?? 0;
  const neckRaw = polyLength(back.neckLine, gs, gr) * 2 + polyLength(front.neckLine, gs, gr) * 2 + (raglan ? (topSts(back) + topSts(sleeve) * 2) / gs : 0);
  const neckCm = cm1(neckRaw);
  const bands: Draft["bands"] = { neck: { cm: neckCm, sts: even(st(neckCm) * 0.9) } };
  if (style === "vest") {
    const fa = polyLength(front.outerLine, gs, gr, front.marks.underarm, front.marks.shoulder);
    const cm = cm1(backArmholeLen + fa);
    bands.armhole = { cm, sts: even(st(cm) * 0.9) };
  }
  if (d.cardigan) {
    const cm = Math.round((front.marks.neck / gr) * 10) / 10;
    const sts = Math.max(4, Math.round(st(cm) * 0.85));
    const rows = Math.max(2, rw(d.bandWidth));
    const n = Math.max(0, Math.round(d.buttons));
    const first = Math.round(st(1.5));
    const last = Math.max(first, sts - Math.round(st(1.5)));
    const holes = n <= 0 ? [] : n === 1 ? [first] : Array.from({ length: n }, (_, k) => Math.round(first + ((last - first) * k) / (n - 1)));
    bands.front = { cm, sts, rows, holes, holeRow: Math.max(1, Math.ceil(rows / 2)) };
  }

  if (S >= W && style !== "dropShoulder") warnings.push("어깨너비가 가슴 너비보다 넓어 진동 줄임이 없어요.");
  if (!raglan && front.rows < T - Math.max(2, SR)) warnings.push("앞목이 깊어 어깨가 일찍 끝나요. 앞목 깊이를 확인해 주세요.");

  return { pieces, finished: { bust: B, armhole: AH, upperArm: UA, length: L }, gs, gr, bands, warnings, raglanRows };
}

/** Bind-offs over `steps` shaping rows (every 2 rows), larger first. */
function spreadBulk(sts: number, steps: number): Group[] {
  const q = Math.floor(sts / steps);
  const r = sts % steps;
  return [
    { every: 2, sts: q + 1, times: r },
    { every: 2, sts: q, times: steps - r },
  ].filter((g) => g.times > 0 && g.sts > 0);
}


// ---------- words ----------

export const ROLE_LABEL: Record<Role, string> = {
  hem: "밑단",
  side: "옆선",
  armhole: "진동",
  neck: "목",
  shoulder: "어깨",
  raglan: "래글런선",
  cap: "소매산",
  sleeveSeam: "소매 옆선",
  cuff: "소매부리",
  edge: "가장자리",
};

export function stepText(s: Step, craft: "knit" | "crochet"): string {
  const off = craft === "crochet" ? "뜨지 않고 남기기" : "코막음";
  switch (s.kind) {
    case "castOn":
      return craft === "crochet" ? `사슬 ${s.sts + 1}코로 시작해 ${s.sts}코` : `${s.sts}코 잡기`;
    case "rib":
      return s.role === "cuff"
        ? craft === "crochet"
          ? `소매 테두리 ${s.rows}단`
          : `소매 고무뜨기 ${s.rows}단`
        : craft === "crochet"
          ? `밑단 테두리 ${s.rows}단`
          : `밑단 고무뜨기 ${s.rows}단`;
    case "straight":
      return `${s.rows}단 평단`;
    case "bindOff":
      return `${s.sts}코 ${off}`;
    case "center":
      return `${s.from}단에서 가운데 ${s.sts}코 ${off}, 이후 한쪽씩`;
    case "top":
      return `마지막 단: 남은 ${s.sts}코 모두 ${off}`;
    case "shape":
      return s.groups
        .map((g) =>
          s.dir === "inc"
            ? g.sts > 1
              ? `${g.every}단마다 ${g.sts}코씩 ${g.times}번 코 만들어 늘리기`
              : `${g.every}단마다 ${g.sts}코씩 ${g.times}번 늘리기`
            : s.role === "shoulder" || g.sts > 1
              ? `${g.every}단마다 ${g.sts}코씩 ${g.times}번 ${off}`
              : `${g.every}단마다 ${g.sts}코씩 ${g.times}번 줄이기`,
        )
        .join(", ");
  }
}

export const stepNotation = (s: Step) =>
  s.kind === "shape" ? s.groups.map(notation).join(" · ") : s.kind === "straight" ? `${s.rows}-평` : s.kind === "bindOff" || s.kind === "top" || s.kind === "center" ? `${s.sts}-막음` : "";

export const stepRange = (s: Step) => (s.kind === "castOn" ? "" : s.from === s.to ? `${s.from}단` : `${s.from}–${s.to}단`);

export const cm1 = (v: number) => Math.round(v * 10) / 10;

/** Plain-text instructions for every piece (서술). */
export function writtenPattern(d: ApparelData, dr: Draft, title: string): string {
  const lines: string[] = [];
  const craftLabel = d.craft === "crochet" ? "코바늘" : "대바늘";
  lines.push(title);
  lines.push(`${STYLE_LABEL[d.style]}${d.cardigan ? " 가디건" : ""} · ${d.neckline === "v" ? "브이넥" : "라운드넥"} · ${craftLabel} · 사이즈 ${d.size} · ${FIT_LABEL[d.fit]}`);
  lines.push(`게이지 10cm = ${d.gauge.sts}코 × ${d.gauge.rows}단`);
  lines.push(`완성 가슴둘레 ${cm1(dr.finished.bust)}cm · 옷길이 ${cm1(dr.finished.length)}cm · 진동 ${cm1(dr.finished.armhole)}cm`);
  lines.push("");
  lines.push("바텀업: 밑단에서 코를 잡아 위로 떠요. 앞판·뒤판·소매를 따로 떠서 이어요.");
  lines.push("2-1-3은 2단마다 1코씩 3번이라는 뜻이에요. 시작 코부터 위로 읽어요.");
  for (const p of dr.pieces) {
    lines.push("");
    lines.push(`■ ${p.name}${p.count > 1 ? ` ×${p.count}` : ""}  (시작 ${p.castOn}코 · 총 ${p.rows}단)`);
    lines.push(`  ${stepText({ kind: "castOn", row: 0, sts: p.castOn }, d.craft)}`);
    for (const s of p.steps) {
      const label = s.kind === "castOn" ? "" : ROLE_LABEL[s.role];
      lines.push(`  ${stepRange(s)} [${label}] ${stepText(s, d.craft)}`);
    }
    lines.push(p.sidesNote === "both" ? "  양쪽 똑같이 떠요. 한쪽 기준으로 적었어요." : "  왼쪽·오른쪽 앞판을 좌우 대칭으로 떠요.");
  }
  lines.push("");
  lines.push("■ 마무리 고무단");
  lines.push(`  목둘레 ${dr.bands.neck.cm}cm: ${dr.bands.neck.sts}코 줍기`);
  if (dr.bands.armhole) lines.push(`  진동 둘레 ${dr.bands.armhole.cm}cm: 한쪽에 ${dr.bands.armhole.sts}코 줍기`);
  if (dr.bands.front) {
    const f = dr.bands.front;
    lines.push(`  앞단 ${f.cm}cm: 한쪽에 ${f.sts}코 줍기`);
    if (f.holes.length) lines.push(`  단춧구멍 ${f.holes.length}개: 앞단 ${f.rows}단 중 ${f.holeRow}단째, 밑단에서 ${f.holes.join("·")}코째`);
  }
  return lines.join("\n");
}

export const STYLE_LABEL: Record<ApparelStyle, string> = { setIn: "셋인 소매", dropShoulder: "드롭숄더", vest: "베스트", raglan: "래글런" };
export const FIT_LABEL: Record<ApparelFit, string> = { slim: "슬림", regular: "레귤러", over: "오버" };
