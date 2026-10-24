// Crochet chart symbols (Japanese / Korean convention), drawn as vector primitives.
//
// Every symbol lives in a local box of `w × h` world units centred on (0, 0).
// One chain unit is STITCH_UNIT (28) world units: a stitch that is N chains tall
// (짧은뜨기 1, 긴뜨기 2, 한길 긴뜨기 3 …) gets a box N × 28 tall.
// The stitch "foot" (where it is worked into) is the bottom-centre (0, h/2);
// the head is the top (0, -h/2).
// Drawing functions take the chain unit `u` so the same glyph can be drawn at
// world scale (u = 28) and as a 24-unit palette icon (u = 24, height clamped).
// Primitives are plain data so the same drawing feeds React (canvas, palette)
// and the standalone SVG string used for export / thumbnails.

import type { ReactNode } from "react";

export type Prim =
  | { t: "path"; d: string; fill?: boolean; dash?: string }
  | { t: "ellipse"; cx: number; cy: number; rx: number; ry: number; rot?: number; fill?: boolean }
  | { t: "circle"; cx: number; cy: number; r: number; fill?: boolean; dash?: string }
  | { t: "g"; transform: string; children: Prim[] };

export type SymbolGroup = "basic" | "tall" | "incdec" | "cluster" | "post" | "blo" | "loop" | "special" | "extra";

/** Palette order and labels (Maker.crochetGroup*). `extra` holds shapes and older stitches: search only. */
export const SYMBOL_GROUPS: { id: SymbolGroup; label: string }[] = [
  { id: "basic", label: "기본" },
  { id: "tall", label: "긴뜨기" },
  { id: "incdec", label: "늘림·줄임" },
  { id: "cluster", label: "구슬·팝콘" },
  { id: "post", label: "걸어뜨기" },
  { id: "blo", label: "이랑뜨기" },
  { id: "loop", label: "고리 위치" },
  { id: "special", label: "특수 뜨기" },
  { id: "extra", label: "도형·기타" },
];

/** World units per chain (one chain stitch = 28 px at 100%). */
export const STITCH_UNIT = 28;
const U = STITCH_UNIT;
/** Chain unit inside a 24 × 24 palette icon. */
const ICON_U = 24;

export type DrawOpts = { w: number; h: number; noHead?: boolean; u?: number };

export type GatherSpec = { kind: "increase" | "decrease"; leg: string; count: number; spread: number };

export type CrochetSymbol = {
  id: string;
  name: string;
  group: SymbolGroup;
  /** height in chain units (crochet-static-catalog chainUnits) */
  units: number;
  /** base box in world units */
  w: number;
  h: number;
  /** how `scale` stretches the symbol: v = taller, h = longer (chains), u = uniform (shapes) */
  stretch?: "v" | "h" | "u";
  /** can be a leg of an increase / decrease */
  leg?: boolean;
  /** has a head bar (tall stitches) that decrease legs share */
  tall?: boolean;
  /** placing this symbol creates a GatherItem */
  gather?: GatherSpec;
  aliases?: string[];
  draw: (o: DrawOpts) => Prim[];
};

export const STROKE_WIDTH = 1.6;
export const INK = "#1f1f1f";

const f = (n: number) => Math.round(n * 100) / 100;

// ---------- primitive builders (all measures relative to the chain unit u) ----------

function cross(cx: number, cy: number, a: number): string {
  return `M${f(cx - a)} ${f(cy - a)}L${f(cx + a)} ${f(cy + a)}M${f(cx + a)} ${f(cy - a)}L${f(cx - a)} ${f(cy + a)}`;
}

type TallOpts = { noHead?: boolean; post?: "f" | "b"; loop?: "back" | "front" | "third" };

/** Vertical stem with head bar and `slashes` diagonal strokes (긴뜨기 0, 한길 1, 두길 2 …). */
function tall(h: number, slashes: number, u: number, o: TallOpts = {}): Prim[] {
  const m = u * 0.08;
  const top = -h / 2 + m;
  let bot = h / 2 - m;
  const out: Prim[] = [];
  let d = "";
  if (o.post) {
    // the foot wraps around the post of the stitch below
    const s = o.post === "f" ? 1 : -1;
    const hook = u * 0.24;
    d += `M0 ${f(top)}L0 ${f(bot - hook)}C0 ${f(bot + hook * 0.15)} ${f(s * hook)} ${f(bot + hook * 0.15)} ${f(s * hook)} ${f(bot - hook * 0.55)}`;
  } else {
    if (o.loop) bot -= u * 0.2;
    d += `M0 ${f(top)}L0 ${f(bot)}`;
  }
  if (!o.noHead) d += `M${f(-u * 0.27)} ${f(top)}L${f(u * 0.27)} ${f(top)}`;
  if (slashes > 0) {
    const span = bot - top;
    const gap = Math.min(u * 0.19, (span * 0.3) / slashes);
    const yc = top + span * 0.34;
    const dx = u * 0.15, dy = u * 0.04;
    for (let i = 0; i < slashes; i++) {
      const y = yc + (i - (slashes - 1) / 2) * gap;
      d += `M${f(-dx)} ${f(y + dy)}L${f(dx)} ${f(y - dy)}`;
    }
  }
  out.push({ t: "path", d });
  if (o.loop) out.push(...loopMark(o.loop, bot, u));
  return out;
}

/** Loop marks under a stitch foot: back loop ∪, front loop ∩, third loop = dot. */
function loopMark(kind: "back" | "front" | "third", y: number, u: number): Prim[] {
  const a = u * 0.22, k = u * 0.2;
  if (kind === "back") return [{ t: "path", d: `M${f(-a)} ${f(y + u * 0.05)}Q0 ${f(y + k + u * 0.12)} ${f(a)} ${f(y + u * 0.05)}` }];
  if (kind === "front") return [{ t: "path", d: `M${f(-a)} ${f(y + k + u * 0.02)}Q0 ${f(y - u * 0.04)} ${f(a)} ${f(y + k + u * 0.02)}` }];
  return [{ t: "circle", cx: 0, cy: f(y + u * 0.11), r: f(u * 0.075), fill: true }];
}

/** 짧은뜨기 family drawn in a one-unit box: × plus an optional mark below. */
function scGlyph(h: number, u: number, mark?: "back" | "front" | "post-f" | "post-b"): Prim[] {
  const a = u * 0.21;
  if (!mark) return [{ t: "path", d: cross(0, 0, a) }];
  const cy = -h / 2 + u * 0.3;
  const out: Prim[] = [{ t: "path", d: cross(0, cy, a * 0.9) }];
  if (mark === "back" || mark === "front") out.push(...loopMark(mark, cy + a * 0.9, u));
  else {
    const s = mark === "post-f" ? 1 : -1;
    const y0 = cy + a * 0.9 + u * 0.04, hook = u * 0.2;
    out.push({ t: "path", d: `M0 ${f(y0)}L0 ${f(y0 + u * 0.12)}C0 ${f(y0 + u * 0.12 + hook)} ${f(s * hook)} ${f(y0 + u * 0.12 + hook)} ${f(s * hook)} ${f(y0 + u * 0.16)}` });
  }
  return out;
}

/** Legs meeting at foot and head (bobbles / puffs worked into one stitch). */
function spindle(h: number, u: number, legs: number, slashes: number, head = true): Prim[] {
  const m = u * 0.08;
  const top = -h / 2 + m, bot = h / 2 - m;
  const spread = u * (legs > 3 ? 0.28 : 0.34);
  let d = head ? `M${f(-u * 0.27)} ${f(top)}L${f(u * 0.27)} ${f(top)}` : "";
  const mid = (top + bot) / 2;
  for (let i = 0; i < legs; i++) {
    const c = (i - (legs - 1) / 2) * spread * (legs > 1 ? 2 / (legs - 1) : 0);
    d += Math.abs(c) < 0.01 ? `M0 ${f(bot)}L0 ${f(top)}` : `M0 ${f(bot)}Q${f(c * 1.3)} ${f(mid)} 0 ${f(top)}`;
    if (slashes) {
      const x = c * 0.65;
      for (let j = 0; j < slashes; j++) {
        const y = mid - u * 0.05 + (j - (slashes - 1) / 2) * u * 0.16;
        d += `M${f(x - u * 0.1)} ${f(y + u * 0.05)}L${f(x + u * 0.1)} ${f(y - u * 0.05)}`;
      }
    }
  }
  return [{ t: "path", d }];
}

function chainRow(w: number, u: number): Prim[] {
  const n = Math.max(1, Math.round(w / u));
  const cw = w / n;
  return Array.from({ length: n }, (_, i) => ({
    t: "ellipse" as const,
    cx: f(-w / 2 + (i + 0.5) * cw),
    cy: 0,
    rx: f(Math.min(u * 0.29, cw / 2 - 1)),
    ry: f(u * 0.135),
  }));
}

function rotateAround(px: number, py: number, deg: number, children: Prim[]): Prim {
  return { t: "g", transform: `rotate(${f(deg)} ${f(px)} ${f(py)})`, children };
}

function star(r: number, inner: number): string {
  let d = "";
  for (let i = 0; i < 10; i++) {
    const a = (-90 + i * 36) * (Math.PI / 180);
    const rr = i % 2 ? inner : r;
    d += `${i ? "L" : "M"}${f(Math.cos(a) * rr)} ${f(Math.sin(a) * rr)}`;
  }
  return d + "Z";
}

// ---------- increases / decreases ----------

/** Degrees between neighbouring legs of an increase / decrease. */
export function defaultSpread(leg: string, count = 2): number {
  const s = SYMBOL_MAP.get(leg);
  if (!s) return 30;
  if (s.units <= 1) return count <= 2 ? 54 : 28;
  return s.units <= 2 ? (count <= 2 ? 30 : 24) : count <= 2 ? 22 : 20;
}

type GatherGeom = { w: number; h: number; prims: Prim[] };
const gatherCache = new Map<string, GatherGeom>();

/**
 * Increase: `count` legs fanned from one shared foot. Decrease: legs gathered into one shared head.
 * Returned primitives are re-centred so the bounding box is centred on (0, 0) like any symbol.
 * `icon` draws the legs at palette scale (24-unit chain, tall legs clamped).
 */
export function gatherGeom(kind: "increase" | "decrease", legId: string, count: number, spread: number, icon = false, legScale = 1): GatherGeom {
  const key = `${kind}|${legId}|${count}|${f(spread)}|${icon ? 1 : 0}|${legScale}`;
  const hit = gatherCache.get(key);
  if (hit) return hit;
  const leg = SYMBOL_MAP.get(legId) ?? SYMBOL_MAP.get("sc")!;
  const u = icon ? ICON_U : U;
  const inc = kind === "increase";
  let h: number;
  let legPrims: Prim[];
  let pts: [number, number][];
  const shareHead = !inc && !!leg.tall;
  if (leg.tall) {
    h = icon ? ICON_U : (leg.h / U) * u * legScale;
    legPrims = leg.draw({ w: u, h, noHead: shareHead, u });
    const hw = u * 0.27;
    pts = [[-hw, -h / 2], [hw, -h / 2], [0, h / 2]];
  } else {
    // short legs (×): each leg is an arm from the shared point with a crossbar near its free end
    h = icon ? 22 : u * 0.95;
    const end = inc ? -h / 2 : h / 2;
    const yc = inc ? h / 2 - h * 0.7 : -h / 2 + h * 0.7;
    const a = u * 0.18;
    legPrims = [{ t: "path", d: `M0 ${f(inc ? h / 2 : -h / 2)}L0 ${f(end)}M${f(-a)} ${f(yc + (inc ? a * 0.35 : -a * 0.35))}L${f(a)} ${f(yc - (inc ? a * 0.35 : -a * 0.35))}` }];
    pts = [[0, end], [-a, yc], [a, yc], [0, -end]];
  }
  const py = inc ? h / 2 : -h / 2;
  const children: Prim[] = [];
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  const n = Math.max(1, count);
  for (let i = 0; i < n; i++) {
    const ang = (i - (n - 1) / 2) * spread;
    children.push(rotateAround(0, py, ang, legPrims));
    const r = (ang * Math.PI) / 180;
    const cos = Math.cos(r), sin = Math.sin(r);
    for (const [cx, cy] of pts) {
      const dy = cy - py;
      const X = cx * cos - dy * sin;
      const Y = py + cx * sin + dy * cos;
      x0 = Math.min(x0, X); x1 = Math.max(x1, X); y0 = Math.min(y0, Y); y1 = Math.max(y1, Y);
    }
  }
  if (shareHead) {
    const yb = -h / 2 + u * 0.08;
    children.push({ t: "path", d: `M${f(-u * 0.3)} ${f(yb)}L${f(u * 0.3)} ${f(yb)}` });
    x0 = Math.min(x0, -u * 0.3); x1 = Math.max(x1, u * 0.3);
  }
  const ox = -(x0 + x1) / 2, oy = -(y0 + y1) / 2;
  const geom: GatherGeom = {
    w: f(x1 - x0 + (icon ? 0 : 4)),
    h: f(y1 - y0 + (icon ? 0 : 2)),
    prims: [{ t: "g", transform: `translate(${f(ox)} ${f(oy)})`, children }],
  };
  gatherCache.set(key, geom);
  return geom;
}

// ---------- the catalogue ----------

type Def = Omit<CrochetSymbol, "w" | "h"> & { wUnits?: number };
const S = ({ wUnits = 1, ...d }: Def): CrochetSymbol => ({ ...d, w: wUnits * U, h: d.units * U });

const gatherSym = (id: string, name: string, kind: "increase" | "decrease", leg: string, count: number, units: number, aliases: string[] = [], group: SymbolGroup = "incdec"): CrochetSymbol => ({
  id,
  name,
  group,
  units,
  w: 0,
  h: 0,
  gather: { kind, leg, count, spread: 0 }, // spread resolved below (needs the map)
  aliases,
  draw: () => [],
});

const tallSym = (id: string, name: string, units: number, aliases: string[], group: SymbolGroup = "tall", o: TallOpts = {}): CrochetSymbol =>
  S({ id, name, group, units, stretch: "v", leg: !o.post && !o.loop, tall: true, aliases, draw: ({ h, noHead, u = U }) => tall(h, units - 2, u, { ...o, noHead }) });

export const CROCHET_SYMBOLS: CrochetSymbol[] = [
  // 기본
  S({ id: "magic_ring", name: "매직링", group: "basic", units: 1, stretch: "u", aliases: ["mr", "magic ring", "원형코", "링"], draw: ({ w }) => [{ t: "circle", cx: 0, cy: 0, r: f(w * 0.42) }] }),
  S({ id: "start_mark", name: "시작", group: "basic", units: 1, aliases: ["start", "join", "실 잇기"], draw: ({ u = U }) => [{ t: "path", d: `M0 ${f(-u * 0.2)}L${f(u * 0.11)} ${f(u * 0.16)}L${f(-u * 0.11)} ${f(u * 0.16)}Z` }] }),
  S({ id: "end_mark", name: "종료", group: "basic", units: 1, aliases: ["end", "fasten off", "실 자르기", "자르기"], draw: ({ u = U }) => [{ t: "path", d: `M0 ${f(-u * 0.2)}L${f(u * 0.11)} ${f(u * 0.16)}L${f(-u * 0.11)} ${f(u * 0.16)}Z`, fill: true }] }),
  S({ id: "slst", name: "빼뜨기", group: "basic", units: 1, aliases: ["sl st", "slip", "빼기"], draw: ({ u = U }) => [{ t: "ellipse", cx: 0, cy: 0, rx: f(u * 0.145), ry: f(u * 0.067), fill: true }] }),
  S({ id: "ch", name: "사슬뜨기", group: "basic", units: 1, stretch: "h", aliases: ["ch", "chain", "사슬"], draw: ({ w, u = U }) => chainRow(w, u) }),
  S({ id: "sc", name: "짧은뜨기", group: "basic", units: 1, leg: true, aliases: ["sc", "single crochet", "x"], draw: ({ h, u = U }) => scGlyph(h, u) }),

  // 긴뜨기 (n chains tall, n − 2 slashes)
  tallSym("hdc", "긴뜨기", 2, ["hdc", "half double"]),
  tallSym("dc", "한길 긴뜨기", 3, ["dc", "double crochet", "한길"]),
  tallSym("tr", "두길 긴뜨기", 4, ["tr", "treble", "두길"]),
  tallSym("dtr", "세길 긴뜨기", 5, ["dtr", "double treble", "세길"]),
  tallSym("tall_4", "네길 긴뜨기", 6, ["trtr", "네길"]),
  tallSym("tall_5", "다섯길 긴뜨기", 7, ["다섯길"]),

  // 늘림·줄임 (resolved below into GatherItems)
  gatherSym("sc_inc1", "짧은뜨기 2코 늘려뜨기", "increase", "sc", 2, 1, ["sc inc", "inc", "늘리기"]),
  gatherSym("sc_inc2", "짧은뜨기 3코 늘려뜨기", "increase", "sc", 3, 1, ["sc inc", "늘리기"]),
  gatherSym("sc2tog", "짧은뜨기 2코 모아뜨기", "decrease", "sc", 2, 1, ["sc2tog", "dec", "줄이기"]),
  gatherSym("sc3tog", "짧은뜨기 3코 모아뜨기", "decrease", "sc", 3, 1, ["sc3tog", "줄이기"]),
  gatherSym("hdc_inc1", "긴뜨기 2코 늘려뜨기", "increase", "hdc", 2, 2, ["hdc inc", "늘리기"]),
  gatherSym("hdc_inc2", "긴뜨기 3코 늘려뜨기", "increase", "hdc", 3, 2, ["hdc inc", "늘리기"]),
  gatherSym("hdc2tog", "긴뜨기 2코 모아뜨기", "decrease", "hdc", 2, 2, ["hdc2tog", "줄이기"]),
  gatherSym("hdc3tog", "긴뜨기 3코 모아뜨기", "decrease", "hdc", 3, 2, ["hdc3tog", "줄이기"]),
  gatherSym("dc_inc1", "한길 긴뜨기 2코 늘려뜨기", "increase", "dc", 2, 3, ["dc inc", "늘리기"]),
  gatherSym("dc_inc2", "한길 긴뜨기 3코 늘려뜨기", "increase", "dc", 3, 3, ["dc inc", "늘리기"]),
  gatherSym("dc2tog", "한길 긴뜨기 2코 모아뜨기", "decrease", "dc", 2, 3, ["dc2tog", "줄이기"]),
  gatherSym("dc3tog", "한길 긴뜨기 3코 모아뜨기", "decrease", "dc", 3, 3, ["dc3tog", "줄이기"]),

  // 구슬·팝콘
  S({ id: "bobble", name: "구슬뜨기", group: "cluster", units: 3, stretch: "v", aliases: ["bobble", "cluster", "구슬", "dc3cl"], draw: ({ h, u = U }) => spindle(h, u, 3, 1) }),
  S({
    id: "popcorn",
    name: "팝콘뜨기",
    group: "cluster",
    units: 3,
    stretch: "v",
    aliases: ["popcorn", "pc", "팝콘"],
    draw: ({ h, u = U }) => {
      const m = u * 0.08;
      const top = -h / 2 + m, bot = h / 2 - m;
      const ry = u * 0.12, cy = top + ry;
      let d = "";
      for (const k of [-2, -1, 0, 1, 2]) d += `M0 ${f(bot)}L${f(k * u * 0.13)} ${f(cy + ry * 0.6)}`;
      return [{ t: "path", d }, { t: "ellipse", cx: 0, cy: f(cy), rx: f(u * 0.34), ry: f(ry) }];
    },
  }),

  // 걸어뜨기
  tallSym("fpdc", "앞걸어 한길 긴뜨기", 3, ["fpdc", "front post", "앞걸어"], "post", { post: "f" }),
  tallSym("bpdc", "뒤걸어 한길 긴뜨기", 3, ["bpdc", "back post", "뒤걸어"], "post", { post: "b" }),
  S({ id: "fpsc", name: "앞걸어 짧은뜨기", group: "post", units: 1, aliases: ["fpsc", "front post", "앞걸어"], draw: ({ h, u = U }) => scGlyph(h, u, "post-f") }),
  S({ id: "bpsc", name: "뒤걸어 짧은뜨기", group: "post", units: 1, aliases: ["bpsc", "back post", "뒤걸어"], draw: ({ h, u = U }) => scGlyph(h, u, "post-b") }),

  // 이랑뜨기 (back loop)
  S({ id: "sc_blo", name: "짧은뜨기 이랑뜨기", group: "blo", units: 1, aliases: ["blo sc", "back loop", "이랑"], draw: ({ h, u = U }) => scGlyph(h, u, "back") }),
  tallSym("hdc_blo", "긴뜨기 이랑뜨기", 2, ["blo hdc", "back loop", "이랑"], "blo", { loop: "back" }),
  tallSym("dc_blo", "한길 긴뜨기 이랑뜨기", 3, ["blo dc", "back loop", "이랑"], "blo", { loop: "back" }),

  // 고리 위치
  S({ id: "sc_flo", name: "짧은뜨기 앞고리 이랑뜨기", group: "loop", units: 1, aliases: ["flo sc", "front loop", "앞고리"], draw: ({ h, u = U }) => scGlyph(h, u, "front") }),
  tallSym("hdc_flo", "긴뜨기 앞반코", 2, ["flo hdc", "front loop", "앞반코"], "loop", { loop: "front" }),
  tallSym("dc_flo", "한길 긴뜨기 앞반코", 3, ["flo dc", "front loop", "앞반코"], "loop", { loop: "front" }),
  tallSym("hdc_tlo", "긴뜨기 세 번째 고리", 2, ["third loop", "세 번째 고리"], "loop", { loop: "third" }),

  // 특수 뜨기
  S({
    id: "picot_sc3",
    name: "사슬 3코 짧은뜨기 피코",
    group: "special",
    units: 1,
    aliases: ["picot", "피코"],
    draw: ({ u = U }) => {
      const r = u * 0.2, cy = -u * 0.14;
      const ovals: Prim[] = [-150, -90, -30].map((a) => {
        const t = (a * Math.PI) / 180;
        return { t: "ellipse", cx: f(Math.cos(t) * r), cy: f(cy + Math.sin(t) * r), rx: f(u * 0.1), ry: f(u * 0.06), rot: a + 90 };
      });
      const yb = cy + u * 0.08;
      return [...ovals, { t: "path", d: `M${f(-r * 0.95)} ${f(yb)}Q${f(-r * 0.5)} ${f(yb + u * 0.17)} 0 ${f(yb + u * 0.2)}M${f(r * 0.95)} ${f(yb)}Q${f(r * 0.5)} ${f(yb + u * 0.17)} 0 ${f(yb + u * 0.2)}` + cross(0, yb + u * 0.32, u * 0.08) }];
    },
  }),
  S({
    id: "reverse_sc",
    name: "바꿔짧은뜨기",
    group: "special",
    units: 1,
    aliases: ["reverse sc", "crab", "게뜨기", "역짧은뜨기"],
    draw: ({ u = U }) => {
      const a = u * 0.17, cy = u * 0.1, ay = -u * 0.2;
      return [{ t: "path", d: cross(0, cy, a) + `M${f(-u * 0.27)} ${f(ay + u * 0.06)}Q0 ${f(ay - u * 0.16)} ${f(u * 0.27)} ${f(ay + u * 0.06)}M${f(u * 0.15)} ${f(ay - u * 0.06)}L${f(u * 0.27)} ${f(ay + u * 0.06)}L${f(u * 0.12)} ${f(ay + u * 0.1)}` }];
    },
  }),
  S({
    id: "sc_spike",
    name: "스파이크 짧은뜨기",
    group: "special",
    units: 1,
    stretch: "v",
    aliases: ["spike", "long sc", "이어 짧은뜨기"],
    draw: ({ h, u = U }) => {
      const a = u * 0.17, cy = -h / 2 + u * 0.08 + a;
      return [{ t: "path", d: cross(0, cy, a) + `M0 ${f(cy + a + u * 0.04)}L0 ${f(h / 2 - u * 0.08)}` }];
    },
  }),

  // 도형·기타 (search only; also keeps older charts readable)
  S({ id: "puff", name: "퍼프뜨기", group: "extra", units: 3, stretch: "v", aliases: ["puff", "hdc puff", "구슬"], draw: ({ h, u = U }) => spindle(h, u, 3, 0) }),
  S({ id: "cluster5", name: "한길 긴뜨기 5코 구슬뜨기", group: "extra", units: 3, wUnits: 1.3, stretch: "v", aliases: ["cluster", "dc5", "구슬"], draw: ({ h, u = U }) => spindle(h, u, 5, 1) }),
  gatherSym("shell5", "한길 긴뜨기 5코 셸", "increase", "dc", 5, 3, ["shell", "조개", "늘리기"], "extra"),
  S({
    id: "vst",
    name: "V뜨기",
    group: "extra",
    units: 3,
    wUnits: 2,
    stretch: "v",
    aliases: ["v stitch", "v-st", "브이"],
    draw: ({ h, u = U }) => {
      const L = h - 2;
      const a = 20;
      const legs = tall(L, 1, u);
      const py = h / 2;
      const topY = py - L * Math.cos((a * Math.PI) / 180);
      return [
        { t: "g", transform: `translate(0 ${f(py - L / 2)})`, children: [rotateAround(0, L / 2, -a, legs), rotateAround(0, L / 2, a, legs)] },
        { t: "ellipse", cx: 0, cy: f(topY - 1), rx: f(u * 0.25), ry: f(u * 0.13) },
      ];
    },
  }),
  S({
    id: "xdc",
    name: "교차 한길 긴뜨기",
    group: "extra",
    units: 3,
    wUnits: 1.4,
    stretch: "v",
    aliases: ["crossed dc", "교차"],
    draw: ({ h, u = U }) => {
      const top = -h / 2, bot = h / 2, x = u * 0.35;
      const y = h * 0.2;
      const sx = x - (2 * x * (bot - y)) / h;
      return [
        {
          t: "path",
          d:
            `M${f(-x)} ${f(bot)}L${f(x)} ${f(top)}M${f(x)} ${f(bot)}L${f(-x)} ${f(top)}M${f(x * 0.2)} ${f(top)}L${f(x * 1.7)} ${f(top)}M${f(-x * 1.7)} ${f(top)}L${f(-x * 0.2)} ${f(top)}` +
            `M${f(sx - 4)} ${f(y + 2.6)}L${f(sx + 4)} ${f(y - 2.6)}M${f(-sx - 4)} ${f(y + 2.6)}L${f(-sx + 4)} ${f(y - 2.6)}`,
        },
      ];
    },
  }),
  tallSym("fphdc", "앞걸어 긴뜨기", 2, ["fphdc", "front post", "앞걸어"], "extra", { post: "f" }),
  tallSym("bphdc", "뒤걸어 긴뜨기", 2, ["bphdc", "back post", "뒤걸어"], "extra", { post: "b" }),
  tallSym("fptr", "앞걸어 두길 긴뜨기", 4, ["fptr", "front post", "앞걸어"], "extra", { post: "f" }),
  S({
    id: "picot",
    name: "피코뜨기",
    group: "extra",
    units: 1,
    aliases: ["picot", "피코"],
    draw: ({ u = U }) => {
      const cy = -u * 0.1, r = u * 0.24;
      const ovals: Prim[] = [-160, -90, -20].map((a) => {
        const t = (a * Math.PI) / 180;
        return { t: "ellipse", cx: f(Math.cos(t) * r), cy: f(cy + Math.sin(t) * r), rx: f(u * 0.13), ry: f(u * 0.08), rot: a + 90 };
      });
      return [...ovals, { t: "path", d: `M${f(-r)} ${f(cy + 4)}Q${f(-r / 2)} ${f(cy + u * 0.3)} 0 ${f(cy + u * 0.36)}M${f(r)} ${f(cy + 4)}Q${f(r / 2)} ${f(cy + u * 0.3)} 0 ${f(cy + u * 0.36)}` }, { t: "circle", cx: 0, cy: f(cy + u * 0.4), r: f(u * 0.08), fill: true }];
    },
  }),
  S({ id: "marker", name: "코 표시 (마커)", group: "extra", units: 1, aliases: ["marker", "표시", "마커"], draw: ({ u = U }) => [{ t: "path", d: `M0 ${f(u * 0.38)}L0 ${f(u * 0.06)}` }, { t: "circle", cx: 0, cy: f(-u * 0.14), r: f(u * 0.2) }, { t: "circle", cx: 0, cy: f(-u * 0.14), r: f(u * 0.06), fill: true }] }),
  S({ id: "shape_circle", name: "원", group: "extra", units: 1, stretch: "u", aliases: ["circle", "동그라미", "도형"], draw: ({ w }) => [{ t: "circle", cx: 0, cy: 0, r: f(w / 2 - 2) }] }),
  S({ id: "shape_ring", name: "점선 원 (단 구분)", group: "extra", units: 2, wUnits: 2, stretch: "u", aliases: ["guide", "dashed circle", "점선", "도형"], draw: ({ w }) => [{ t: "circle", cx: 0, cy: 0, r: f(w / 2 - 2), dash: "4 4" }] }),
  S({ id: "shape_rect", name: "사각형", group: "extra", units: 1, stretch: "u", aliases: ["square", "rect", "네모", "도형"], draw: ({ w, h }) => [{ t: "path", d: `M${f(-w / 2 + 2)} ${f(-h / 2 + 2)}H${f(w / 2 - 2)}V${f(h / 2 - 2)}H${f(-w / 2 + 2)}Z` }] }),
  S({ id: "shape_triangle", name: "삼각형", group: "extra", units: 1, stretch: "u", aliases: ["triangle", "세모", "도형"], draw: ({ w, h }) => [{ t: "path", d: `M0 ${f(-h / 2 + 2)}L${f(w / 2 - 2)} ${f(h / 2 - 2)}L${f(-w / 2 + 2)} ${f(h / 2 - 2)}Z` }] }),
  S({ id: "shape_star", name: "별", group: "extra", units: 1, stretch: "u", aliases: ["star", "도형"], draw: ({ w }) => [{ t: "path", d: star(w / 2 - 1.5, (w / 2 - 1.5) * 0.45) }] }),
  S({ id: "shape_line", name: "직선", group: "extra", units: 1, wUnits: 2, stretch: "h", aliases: ["line", "선", "도형"], draw: ({ w }) => [{ t: "path", d: `M${f(-w / 2 + 1)} 0L${f(w / 2 - 1)} 0` }] }),
  S({ id: "shape_arrow", name: "화살표 (진행 방향)", group: "extra", units: 1, wUnits: 2, stretch: "h", aliases: ["arrow", "방향", "도형"], draw: ({ w }) => [{ t: "path", d: `M${f(-w / 2 + 1)} 0L${f(w / 2 - 1)} 0M${f(w / 2 - 7)} -5L${f(w / 2 - 1)} 0L${f(w / 2 - 7)} 5` }] }),
];

export const SYMBOL_MAP = new Map(CROCHET_SYMBOLS.map((s) => [s.id, s]));

// resolve the increase / decrease palette entries now that legs exist
for (const s of CROCHET_SYMBOLS) {
  if (!s.gather) continue;
  s.gather.spread = defaultSpread(s.gather.leg, s.gather.count);
  const g = gatherGeom(s.gather.kind, s.gather.leg, s.gather.count, s.gather.spread);
  s.w = g.w;
  s.h = g.h;
  s.draw = () => g.prims;
}

/** Ids used by earlier versions of the editor → current ids (old charts keep rendering). */
export const LEGACY_IDS: Record<string, string> = {
  mr: "magic_ring",
  join: "start_mark",
  fasten: "end_mark",
  trtr: "tall_4",
  sc2inc: "sc_inc1",
  sc3inc: "sc_inc2",
  hdc2inc: "hdc_inc1",
  dc2inc: "dc_inc1",
  dc3inc: "dc_inc2",
  dc5inc: "shell5",
  hdc3puff: "puff",
  dc3cl: "bobble",
  dc5puff: "cluster5",
  pop: "popcorn",
  blosc: "sc_blo",
  blohdc: "hdc_blo",
  blodc: "dc_blo",
  rsc: "reverse_sc",
  spike: "sc_spike",
  "shape-circle": "shape_circle",
  "shape-ring": "shape_ring",
  "shape-rect": "shape_rect",
  "shape-tri": "shape_triangle",
  "shape-star": "shape_star",
  "shape-line": "shape_line",
  "shape-arrow": "shape_arrow",
};
for (const [old, id] of Object.entries(LEGACY_IDS)) {
  const s = SYMBOL_MAP.get(id);
  if (s) SYMBOL_MAP.set(old, s);
}

export const getSymbol = (id: string) => SYMBOL_MAP.get(id);

/** Box of a symbol after stretching. */
export function symbolSize(s: CrochetSymbol, scale = 1): { w: number; h: number } {
  const k = scale > 0 ? scale : 1;
  if (s.stretch === "v") return { w: s.w, h: s.h * k };
  if (s.stretch === "h") return { w: s.w * k, h: s.h };
  if (s.stretch === "u") return { w: s.w * k, h: s.h * k };
  return { w: s.w, h: s.h };
}

/** Korean initial-consonant aware search. */
const CHO = "ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ";
const initials = (s: string) =>
  [...s]
    .map((ch) => {
      const c = ch.charCodeAt(0) - 0xac00;
      return c >= 0 && c < 11172 ? CHO[Math.floor(c / 588)] : ch;
    })
    .join("");
export function symbolMatches(s: CrochetSymbol, q: string) {
  const query = q.toLowerCase().replace(/\s+/g, "");
  if (!query) return true;
  const hay = [s.name, s.id, ...(s.aliases ?? [])].map((x) => x.toLowerCase().replace(/\s+/g, ""));
  return hay.some((x) => x.includes(query) || initials(x).includes(query));
}

// ---------- rendering ----------

/** React elements for primitives. Stroke colour / width come from the parent <g>. */
export function renderPrims(prims: Prim[], color: string, nonScaling = false): ReactNode {
  const ve = nonScaling ? "non-scaling-stroke" : undefined;
  return prims.map((p, i) => {
    switch (p.t) {
      case "path":
        return <path key={i} d={p.d} fill={p.fill ? color : "none"} strokeDasharray={p.dash} vectorEffect={ve} />;
      case "ellipse":
        return (
          <ellipse
            key={i}
            cx={p.cx}
            cy={p.cy}
            rx={p.rx}
            ry={p.ry}
            fill={p.fill ? color : "none"}
            transform={p.rot ? `rotate(${p.rot} ${p.cx} ${p.cy})` : undefined}
            vectorEffect={ve}
          />
        );
      case "circle":
        return <circle key={i} cx={p.cx} cy={p.cy} r={p.r} fill={p.fill ? color : "none"} strokeDasharray={p.dash} vectorEffect={ve} />;
      case "g":
        return (
          <g key={i} transform={p.transform}>
            {renderPrims(p.children, color, nonScaling)}
          </g>
        );
    }
  });
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");

/** Standalone SVG markup for primitives (for export). */
export function primsToSvg(prims: Prim[], color: string): string {
  const fill = (b?: boolean) => (b ? esc(color) : "none");
  return prims
    .map((p) => {
      switch (p.t) {
        case "path":
          return `<path d="${p.d}" fill="${fill(p.fill)}"${p.dash ? ` stroke-dasharray="${p.dash}"` : ""}/>`;
        case "ellipse":
          return `<ellipse cx="${p.cx}" cy="${p.cy}" rx="${p.rx}" ry="${p.ry}" fill="${fill(p.fill)}"${p.rot ? ` transform="rotate(${p.rot} ${p.cx} ${p.cy})"` : ""}/>`;
        case "circle":
          return `<circle cx="${p.cx}" cy="${p.cy}" r="${p.r}" fill="${fill(p.fill)}"${p.dash ? ` stroke-dasharray="${p.dash}"` : ""}/>`;
        case "g":
          return `<g transform="${p.transform}">${primsToSvg(p.children, color)}</g>`;
      }
    })
    .join("");
}

// ---------- palette icons ----------

const iconCache = new Map<string, Prim[]>();

/** The symbol drawn into a 24 × 24 icon box centred on (0, 0): one chain = 24, tall stems clamped to 20. */
export function iconPrims(id: string): Prim[] {
  const hit = iconCache.get(id);
  if (hit) return hit;
  const s = SYMBOL_MAP.get(id);
  let prims: Prim[] = [];
  if (s?.gather) {
    const g = gatherGeom(s.gather.kind, s.gather.leg, s.gather.count, s.gather.spread, true);
    const k = Math.min(1, 23.5 / g.w, 21.5 / g.h);
    prims = k < 1 ? [{ t: "g", transform: `scale(${f(k)})`, children: g.prims }] : g.prims;
  } else if (s) {
    const wU = s.w / U, hU = s.units;
    let w = wU * ICON_U, h = hU * ICON_U;
    if (s.stretch === "v") h = ICON_U;
    if (s.stretch === "u" || s.stretch === "h") w = Math.min(w, ICON_U);
    if (s.stretch === "u") h = Math.min(h, ICON_U);
    const k = Math.min(1, 24 / Math.max(w, 1));
    prims = s.draw({ w, h, u: ICON_U });
    if (k < 1) prims = [{ t: "g", transform: `scale(${f(k)})`, children: prims }];
  }
  iconCache.set(id, prims);
  return prims;
}

/** Palette / slot preview: a 24-unit icon with a non-scaling stroke, coloured by `currentColor`. */
export function SymbolIcon({ id, size = 22, strokeWidth = 1.2, color, className }: { id: string; size?: number; strokeWidth?: number; color?: string; className?: string }) {
  if (!SYMBOL_MAP.get(id)) return null;
  return (
    <svg
      width={size}
      height={size}
      viewBox="-12 -12 24 24"
      preserveAspectRatio="xMidYMid meet"
      overflow="visible"
      fill="none"
      className={className}
      aria-hidden="true"
      style={{ overflow: "visible", ...(color ? { color } : {}) }}
    >
      <g stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
        {renderPrims(iconPrims(id), "currentColor", true)}
      </g>
    </svg>
  );
}
