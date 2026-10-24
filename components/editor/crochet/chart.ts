// Rounds / rows model shared by the templates, the written-pattern parser and the assistant.
// A round is a list of nodes ("짧은뜨기 6", "(짧은뜨기 1, 늘려뜨기 1) × 6"); expanding it gives slots
// (one placed symbol each), and laying the slots out on a ring or a row gives editable items.
import { uid } from "@/lib/id";
import type { CrochetItem, CrochetLayer, GatherItem, RoundGuide, StitchItem } from "@/lib/types";
import { STITCH_UNIT, defaultSpread, getSymbol } from "@/lib/symbols/crochet";
import { gatherItemGeom, geomFoot, stitchGeom, type Geom } from "./geometry";

const U = STITCH_UNIT;
const r2 = (n: number) => Math.round(n * 100) / 100;

// ---------- nodes ----------

export type Node =
  | { k: "st"; sym: string; n: number }
  | { k: "inc"; leg: string; legs: number; n: number }
  | { k: "dec"; leg: string; legs: number; n: number }
  | { k: "ch"; n: number }
  | { k: "ring" }
  | { k: "rep"; nodes: Node[]; n: number }
  /** "in each st around": repeated to use up the stitches of the round below */
  | { k: "fill"; node: Node };

export type Round = {
  label: string;
  nodes: Node[];
  /** stitch count written in the source ("(12)") */
  expected?: number;
  /** a chain base (기초 사슬): laid as a straight chain, or a joined chain ring for tubes */
  foundation?: boolean;
  /** foundation chains skipped before the first stitch ("in 2nd ch from hook") */
  skip?: number;
  /** weight units centred on the top of a ring (default: the first slot) */
  align?: number;
};

export type Layout = "radial" | "oval" | "square" | "hexagon" | "linear";

export const st = (sym: string, n = 1): Node => ({ k: "st", sym, n });
export const inc = (leg = "sc", n = 1, legs = 2): Node => ({ k: "inc", leg, legs, n });
export const dec = (leg = "sc", n = 1, legs = 2): Node => ({ k: "dec", leg, legs, n });
export const ch = (n: number): Node => ({ k: "ch", n });
export const rep = (nodes: Node[], n: number): Node => ({ k: "rep", nodes, n });

// ---------- slots ----------

export type Slot =
  | { k: "st"; sym: string }
  | { k: "gather"; kind: "increase" | "decrease"; leg: string; count: number }
  | { k: "ch" }
  /** standing / turning chain drawn as one stack of n chains */
  | { k: "stack"; n: number };

const NO_COUNT = new Set(["slst", "magic_ring", "start_mark", "end_mark", "marker", "shape_circle", "shape_ring", "shape_rect", "shape_triangle", "shape_star", "shape_line", "shape_arrow"]);

/** Stitches a node uses from the round below, per repetition. */
function consumption(n: Node): number {
  switch (n.k) {
    case "st":
      return n.sym === "slst" ? 0 : n.n;
    case "inc":
      return n.n;
    case "dec":
      return n.n * n.legs;
    case "rep":
      return n.n * n.nodes.reduce((s, c) => s + consumption(c), 0);
    case "fill":
      return 0;
    default:
      return 0;
  }
}
const fillUnit = (n: Node) => Math.max(1, consumption(n.k === "fill" ? n.node : n) || 1);

export type Expanded = { slots: Slot[]; ring: boolean; produced: number; consumed: number; chains: boolean; fillMissing: boolean };

/** Expands a round's nodes into slots. `prev` = stitches of the round below (for "around"). */
export function expandRound(r: Round, prev: number): Expanded {
  let ring = false;
  let fillMissing = false;
  const fills: Node[] = [];
  const scan = (ns: Node[]) => ns.forEach((n) => (n.k === "fill" ? fills.push(n) : n.k === "rep" ? scan(n.nodes) : n.k === "ring" ? (ring = true) : null));
  scan(r.nodes);
  const other = r.nodes.reduce((s, n) => s + consumption(n), 0) + (r.skip ?? 0);
  const left = Math.max(0, prev - other);
  if (fills.length && prev <= 0) fillMissing = true;
  const fillTimes = new Map<Node, number>();
  fills.forEach((f, i) => {
    const share = Math.floor(left / fills.length) + (i < left % fills.length ? 1 : 0);
    fillTimes.set(f, Math.max(fillMissing ? 1 : 0, Math.floor(share / fillUnit(f))));
  });

  const slots: Slot[] = [];
  const emit = (n: Node) => {
    switch (n.k) {
      case "st":
        for (let i = 0; i < n.n; i++) slots.push({ k: "st", sym: n.sym });
        return;
      case "inc":
      case "dec":
        for (let i = 0; i < n.n; i++) slots.push({ k: "gather", kind: n.k === "inc" ? "increase" : "decrease", leg: n.leg, count: n.legs });
        return;
      case "ch":
        // a chain that opens a round is its standing / turning chain
        if (!r.foundation && !slots.length && r.nodes.some((x) => x.k !== "ch" && x.k !== "ring")) slots.push({ k: "stack", n: n.n });
        else for (let i = 0; i < n.n; i++) slots.push({ k: "ch" });
        return;
      case "rep":
        for (let i = 0; i < n.n; i++) n.nodes.forEach(emit);
        return;
      case "fill": {
        const t = fillTimes.get(n) ?? 0;
        for (let i = 0; i < t; i++) emit(n.node);
        return;
      }
    }
  };
  r.nodes.forEach(emit);

  const chainOnly = slots.every((s) => s.k === "ch");
  let produced = 0, consumed = 0, chains = false;
  slots.forEach((s, i) => {
    if (s.k === "st") {
      if (!NO_COUNT.has(s.sym)) produced += 1;
      if (s.sym !== "slst" || i < slots.length - 1) consumed += s.sym === "slst" ? 1 : NO_COUNT.has(s.sym) ? 0 : 1;
    } else if (s.k === "gather") {
      produced += s.kind === "increase" ? s.count : 1;
      consumed += s.kind === "increase" ? 1 : s.count;
    } else if (s.k === "ch") {
      chains = true;
      if (chainOnly) produced += 1;
    } else {
      chains = true;
      if (s.n >= 2) produced += 1;
    }
  });
  return { slots, ring, produced, consumed: consumed + (r.skip ?? 0), chains, fillMissing };
}

/** Stitches each round makes (chains of a chain space are not counted, a chain base is). */
export function roundCounts(rounds: Round[]): number[] {
  const out: number[] = [];
  let prev = 0;
  for (const r of rounds) {
    const e = expandRound(r, prev);
    out.push(e.produced);
    prev = e.produced;
  }
  return out;
}

// ---------- ring geometry: offset of a convex core polygon ----------

type Piece =
  | { k: "arc"; c: [number, number]; a0: number; len: number }
  | { k: "line"; p0: [number, number]; p1: [number, number]; n: [number, number]; len: number };

function normalOf(a: [number, number], b: [number, number]): [number, number] {
  const ex = b[0] - a[0], ey = b[1] - a[1];
  const l = Math.hypot(ex, ey) || 1;
  return [ey / l, -ex / l];
}

/** Clockwise (on screen) path at distance d around the core; vertex 0 → 1 must be the top edge. */
export function ringPath(core: [number, number][], d: number) {
  const pieces: Piece[] = [];
  if (core.length <= 1) {
    const c = core[0] ?? [0, 0];
    pieces.push({ k: "arc", c, a0: -Math.PI / 2, len: 2 * Math.PI * d });
  } else {
    const N = core.length;
    for (let i = 0; i < N; i++) {
      const prev = core[(i - 1 + N) % N], cur = core[i], next = core[(i + 1) % N];
      const nIn = normalOf(prev, cur), nOut = normalOf(cur, next);
      const a0 = Math.atan2(nIn[1], nIn[0]);
      let a1 = Math.atan2(nOut[1], nOut[0]);
      while (a1 < a0 - 1e-9) a1 += 2 * Math.PI;
      pieces.push({ k: "arc", c: cur, a0, len: (a1 - a0) * d });
      const p0: [number, number] = [cur[0] + nOut[0] * d, cur[1] + nOut[1] * d];
      const p1: [number, number] = [next[0] + nOut[0] * d, next[1] + nOut[1] * d];
      pieces.push({ k: "line", p0, p1, n: nOut, len: Math.hypot(p1[0] - p0[0], p1[1] - p0[1]) });
    }
  }
  const P = pieces.reduce((s, p) => s + p.len, 0);
  const sTop = core.length <= 1 ? 0 : pieces[0].len + pieces[1].len / 2;
  const sCorner = core.length <= 1 ? 0 : pieces[0].len / 2;
  const at = (s0: number) => {
    let s = ((s0 % P) + P) % P;
    for (const p of pieces) {
      if (s <= p.len || p === pieces[pieces.length - 1]) {
        if (p.k === "arc") {
          const a = p.a0 + (d > 0 ? s / d : 0);
          const nx = Math.cos(a), ny = Math.sin(a);
          return { x: p.c[0] + nx * d, y: p.c[1] + ny * d, nx, ny };
        }
        const t = p.len ? s / p.len : 0;
        return { x: p.p0[0] + (p.p1[0] - p.p0[0]) * t, y: p.p0[1] + (p.p1[1] - p.p0[1]) * t, nx: p.n[0], ny: p.n[1] };
      }
      s -= p.len;
    }
    return { x: 0, y: -d, nx: 0, ny: -1 };
  };
  return { P, sTop, sCorner, at };
}

/** Core polygon (relative to the centre) for a layout at foot distance d. */
function coreFor(layout: Layout, d: number, alpha: number, L: number): [number, number][] {
  if (layout === "oval") return [[-L, 0], [L, 0]];
  if (layout === "square") {
    const a = alpha * d;
    return [[-a, -a], [a, -a], [a, a], [-a, a]];
  }
  if (layout === "hexagon") {
    const p = alpha * d;
    return [-120, -60, 0, 60, 120, 180].map((deg) => [r2(p * Math.cos((deg * Math.PI) / 180)), r2(p * Math.sin((deg * Math.PI) / 180))] as [number, number]);
  }
  return [[0, 0]];
}

/** Core perimeter per unit of d (polygons grow with their round). */
const corePerUnit = (layout: Layout, alpha: number) => (layout === "square" ? 8 * alpha : layout === "hexagon" ? 6 * alpha : 0);

// ---------- items for slots ----------

function slotWeight(s: Slot): number {
  if (s.k === "st") {
    if (s.sym === "slst") return 0.7;
    const sym = getSymbol(s.sym);
    return Math.max(0.8, (sym?.w ?? U) / U);
  }
  if (s.k === "gather") return Math.max(1, s.count * 0.85);
  return s.k === "ch" ? 0.8 : 1;
}

type Made = { item: CrochetItem; h: number };

/** Builds the item for a slot whose foot is at (x, y) with outward normal (nx, ny). */
function makeItem(s: Slot, x: number, y: number, nx: number, ny: number): Made {
  const rot = r2((Math.atan2(nx, -ny) * 180) / Math.PI);
  const place = <T extends CrochetItem & { x: number; y: number }>(it: T, h: number, foot = h / 2): Made => {
    it.x = r2(x + nx * foot);
    it.y = r2(y + ny * foot);
    return { item: it, h };
  };
  const placeGeom = <T extends CrochetItem & { x: number; y: number }>(it: T, g: Geom) => place(it, g.h, geomFoot(g));
  if (s.k === "st") {
    const it: StitchItem = { id: uid(), type: "stitch", symbol: s.sym, x: 0, y: 0, rotation: rot };
    return s.sym === "slst" ? place(it, 8) : placeGeom(it, stitchGeom(it));
  }
  if (s.k === "gather") {
    const it: GatherItem = { id: uid(), type: "gather", kind: s.kind, symbol: s.leg, count: s.count, spread: defaultSpread(s.leg, s.count), x: 0, y: 0, rotation: rot };
    return placeGeom(it, gatherItemGeom(it));
  }
  if (s.k === "ch") {
    const it: StitchItem = { id: uid(), type: "stitch", symbol: "ch", x: 0, y: 0, rotation: rot };
    const m = place(it, U * 0.5);
    return { item: m.item, h: 0 };
  }
  const len = U * s.n;
  const it: StitchItem = { id: uid(), type: "stitch", symbol: "ch", x: 0, y: 0, rotation: r2(rot - 90), ...(s.n > 1 ? { scale: s.n } : {}) };
  const m = place(it, len);
  return { item: m.item, h: 0 };
}

// ---------- layout ----------

export type BuiltRound = { label: string; items: CrochetItem[]; guide: RoundGuide; produced: number; expected?: number; foundation?: boolean };

export type LayoutOpts = {
  layout: Layout;
  cx: number;
  cy: number;
  /** extra gap between rounds (world units) */
  roundGap?: number;
  /** stitch spacing multiplier (1 = one chain width per stitch) */
  spacing?: number;
  /** put a magic ring in the centre of a radial chart without one */
  ring?: boolean;
  /** continue after an existing round */
  after?: RoundGuide;
  /** stitches of the round below `after` */
  prevCount?: number;
};

/** Lays rounds out into items. The magic ring (if any) joins the first round. */
export function buildChart(rounds: Round[], o: LayoutOpts): BuiltRound[] {
  const gap = o.roundGap ?? 4;
  const sp = o.spacing ?? 1;
  const out: BuiltRound[] = [];
  let prevCount = o.prevCount ?? 0;
  const linear = o.layout === "linear";
  const alpha = o.after?.kind === "round" && o.after.alpha ? o.after.alpha : o.layout === "square" ? 1.15 : o.layout === "hexagon" ? 1.1 : 1;
  // ring state
  let cx = o.cx, cy = o.cy;
  let prevTop: number | null = null;
  let L = 0;
  // row state
  let foot = o.cy;
  let dir: 1 | -1 = -1;
  if (o.after?.kind === "round") {
    cx = o.after.cx;
    cy = o.after.cy;
    prevTop = o.after.top;
    if (o.after.layout === "oval") L = Math.abs(o.after.core[0]?.[0] ?? 0);
  } else if (o.after?.kind === "row") {
    cx = o.after.cx;
    foot = o.after.top - gap;
    dir = o.after.dir === 1 ? -1 : 1;
  }
  const foundation = rounds.find((r) => r.foundation);
  if (o.layout === "oval" && !o.after) {
    const n = foundation ? expandRound(foundation, 0).produced : Math.max(4, Math.round((expandRound(rounds[0] ?? { label: "", nodes: [] }, 0).produced - 6) / 2) + 2);
    L = Math.max(U / 2, ((n - 2) * U * sp) / 2);
  }

  let ringPending = false;
  rounds.forEach((r, idx) => {
    const e = expandRound(r, prevCount);
    if (e.ring || (idx === 0 && o.ring && !linear && !foundation && !o.after)) ringPending = true;
    const items: CrochetItem[] = [];

    if (r.foundation && (linear || o.layout === "oval")) {
      // straight chain base, centred
      const n = e.slots.length;
      const step = U * sp;
      const y = linear ? foot : cy;
      for (let i = 0; i < n; i++) {
        const x = cx - ((n - 1) * step) / 2 + i * step;
        items.push({ id: uid(), type: "stitch", symbol: "ch", x: r2(x), y: r2(y - U * 0.25), rotation: 0 });
      }
      const top = y - U * 0.5;
      const guide: RoundGuide = linear ? { kind: "row", cx, foot: y, top, dir: 1 } : { kind: "round", layout: "oval", cx, cy, core: coreFor("oval", 0, alpha, L), d: 0, top: U * 0.25 };
      if (linear) {
        foot = top - gap;
        dir = -1;
      } else prevTop = U * 0.25;
      out.push({ label: r.label, items, guide, produced: e.produced, expected: r.expected, foundation: true });
      prevCount = e.produced;
      return;
    }

    const weights = e.slots.map(slotWeight);
    const W = weights.reduce((s, w) => s + w, 0) || 1;

    if (linear) {
      const step = U * sp;
      const total = W * step;
      const start = dir < 0 ? cx + total / 2 : cx - total / 2;
      let cum = 0, maxH = 0;
      e.slots.forEach((s, i) => {
        const x = start + dir * (cum + weights[i] / 2) * step;
        cum += weights[i];
        const m = makeItem(s, x, foot, 0, -1);
        maxH = Math.max(maxH, m.h);
        items.push(m.item);
      });
      if (!maxH) maxH = U * 0.5;
      const top = foot - maxH;
      out.push({ label: r.label, items, guide: { kind: "row", cx, foot, top, dir }, produced: e.produced, expected: r.expected });
      foot = top - gap;
      dir = dir === 1 ? -1 : 1;
      prevCount = e.produced;
      return;
    }

    // rings
    const layout = o.layout;
    const cpu = corePerUnit(layout, alpha);
    const need = W * U * sp * (layout === "square" || layout === "hexagon" ? 0.95 : 0.78);
    let minD = layout === "oval" ? (need - 4 * L) / (2 * Math.PI) : need / (cpu + 2 * Math.PI);
    if (layout === "radial" && r.foundation) minD = (W * U * sp) / (2 * Math.PI);
    const first = prevTop === null;
    const startD = ringPending && first ? 16 : layout === "oval" ? U * 0.5 : 14;
    const d = Math.max(first ? startD : prevTop! + gap, minD, 6);
    const core = coreFor(layout, d, alpha, L);
    const path = ringPath(core, d);
    const k = path.P / W;
    let startS: number;
    const trailing = (() => {
      let w = 0;
      for (let i = e.slots.length - 1; i >= 0 && e.slots[i].k === "ch"; i--) w += weights[i];
      return w;
    })();
    if ((layout === "square" || layout === "hexagon") && trailing > 0) startS = path.sCorner + (trailing / 2) * k;
    else startS = path.sTop - (r.align ?? (weights[0] ?? 0) / 2) * k;
    let cum = 0, maxH = 0;
    e.slots.forEach((s, i) => {
      const pt = path.at(startS + (cum + weights[i] / 2) * k);
      cum += weights[i];
      const m = makeItem(s, cx + pt.x, cy + pt.y, pt.nx, pt.ny);
      maxH = Math.max(maxH, m.h);
      items.push(m.item);
    });
    if (!maxH) maxH = U * 0.5;
    if (ringPending && first) {
      items.unshift({ id: uid(), type: "stitch", symbol: "magic_ring", x: r2(cx), y: r2(cy), rotation: 0 });
      ringPending = false;
    }
    const top = d + maxH;
    out.push({ label: r.label, items, guide: { kind: "round", layout: layout as Exclude<Layout, "linear">, cx, cy, core, d: r2(d), top: r2(top), alpha }, produced: e.produced, expected: r.expected, foundation: r.foundation });
    prevTop = top;
    prevCount = e.produced;
  });
  return out;
}

/** Layers for built rounds (one 단 per round). */
export function roundLayers(built: BuiltRound[], folderId?: string): CrochetLayer[] {
  return built.map((b) => ({
    id: uid(),
    name: b.foundation ? "바닥" : `${b.label}단`,
    visible: true,
    items: b.items,
    guide: b.guide,
    ...(folderId ? { folderId } : {}),
  }));
}

// ---------- counting placed items ----------

/** Stitches an item makes (increase n → n, decrease → 1, chains and marks → 0 unless `chains`). */
export function itemStitches(it: CrochetItem, chains = false): number {
  if (it.type === "gather") return it.kind === "increase" ? it.count : 1;
  if (it.type !== "stitch") return 0;
  if (it.symbol === "ch") return chains ? Math.max(1, Math.round(it.scale ?? 1)) : 0;
  const s = getSymbol(it.symbol);
  if (!s || NO_COUNT.has(s.id)) return 0;
  return 1;
}

/** Stitch count of a placed round: a chain-only round (chain base / chain ring) counts its chains. */
export function layerStitches(items: CrochetItem[]): number {
  const placed = items.filter((it) => it.type === "stitch" || it.type === "gather");
  const chainOnly = placed.length > 0 && placed.every((it) => it.type === "stitch" && it.symbol === "ch");
  return placed.reduce((s, it) => s + itemStitches(it, chainOnly), 0);
}
