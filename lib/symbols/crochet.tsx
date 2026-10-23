// Crochet chart symbols (Japanese / Korean convention), drawn as vector primitives.
//
// Every symbol lives in a local box of `w × h` world units centred on (0, 0).
// The stitch "foot" (where it is worked into) is the bottom-centre (0, h/2);
// the head is the top (0, -h/2). One chain stitch is 20 units wide.
// Primitives are plain data so the same drawing feeds React (canvas, palette)
// and the standalone SVG string used for export / thumbnails.

import type { ReactNode } from "react";

export type Prim =
  | { t: "path"; d: string; fill?: boolean; dash?: string }
  | { t: "ellipse"; cx: number; cy: number; rx: number; ry: number; rot?: number; fill?: boolean }
  | { t: "circle"; cx: number; cy: number; r: number; fill?: boolean; dash?: string }
  | { t: "g"; transform: string; children: Prim[] };

export type SymbolGroup = "basic" | "tall" | "cluster" | "incdec" | "post" | "blo" | "special" | "shape";

/** Palette order. Labels follow the Maker.crochetGroup* copy. */
export const SYMBOL_GROUPS: { id: SymbolGroup; label: string }[] = [
  { id: "basic", label: "기본" },
  { id: "tall", label: "긴뜨기" },
  { id: "cluster", label: "구슬·팝콘" },
  { id: "incdec", label: "늘림·줄임" },
  { id: "post", label: "걸어뜨기" },
  { id: "blo", label: "이랑뜨기" },
  { id: "special", label: "특수 뜨기" },
  { id: "shape", label: "도형/표시" },
];

export type DrawOpts = { w: number; h: number; noHead?: boolean };

export type GatherSpec = { kind: "increase" | "decrease"; leg: string; count: number; spread: number };

export type CrochetSymbol = {
  id: string;
  name: string;
  group: SymbolGroup;
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

// ---------- primitive builders ----------

/** Vertical stem with head bar and `slashes` diagonal strokes (hdc = 0, dc = 1, tr = 2 …). */
function tall(h: number, slashes: number, o: { noHead?: boolean; post?: "f" | "b"; blo?: boolean } = {}): Prim[] {
  const top = -h / 2;
  const bot = h / 2 - (o.blo ? 5 : 0);
  let d = "";
  if (o.post) {
    // post stitches: the foot curls around the post of the stitch below
    const s = o.post === "f" ? -1 : 1;
    d += `M0 ${f(top)}L0 ${f(bot - 8)}C0 ${f(bot - 2)} ${s * 1} ${f(bot)} ${s * 6} ${f(bot - 1)}`;
  } else d += `M0 ${f(top)}L0 ${f(bot)}`;
  if (!o.noHead) d += `M-7 ${f(top)}L7 ${f(top)}`;
  const yc = top + (bot - top) * 0.46;
  for (let i = 0; i < slashes; i++) {
    const y = yc + (i - (slashes - 1) / 2) * 6.5;
    d += `M-4.5 ${f(y + 3)}L4.5 ${f(y - 3)}`;
  }
  if (o.blo) d += `M-6.5 ${f(bot)}Q0 ${f(bot + 7)} 6.5 ${f(bot)}`;
  return [{ t: "path", d }];
}

function cross(cx: number, cy: number, r = 5.5): string {
  return `M${f(cx - r)} ${f(cy - r)}L${f(cx + r)} ${f(cy + r)}M${f(cx + r)} ${f(cy - r)}L${f(cx - r)} ${f(cy + r)}`;
}

/** Legs that meet at foot and head (puffs / clusters worked into one stitch). */
function spindle(h: number, bulges: number[], slashes: number, opts: { head?: boolean } = {}): Prim[] {
  const top = -h / 2;
  const bot = h / 2;
  let d = opts.head === false ? "" : `M-7 ${f(top)}L7 ${f(top)}`;
  for (const c of bulges) d += c === 0 ? `M0 ${f(bot)}L0 ${f(top)}` : `M0 ${f(bot)}Q${f(c)} 0 0 ${f(top)}`;
  if (slashes) {
    for (const c of bulges) {
      const x = c / 2;
      for (let i = 0; i < slashes; i++) {
        const y = -1 + (i - (slashes - 1) / 2) * 6;
        d += `M${f(x - 3.6)} ${f(y + 2.4)}L${f(x + 3.6)} ${f(y - 2.4)}`;
      }
    }
  }
  return [{ t: "path", d }];
}

function chainRow(w: number): Prim[] {
  const n = Math.max(1, Math.round(w / 20));
  const cw = w / n;
  return Array.from({ length: n }, (_, i) => ({
    t: "ellipse" as const,
    cx: f(-w / 2 + (i + 0.5) * cw),
    cy: 0,
    rx: f(Math.max(3, cw / 2 - 1.6)),
    ry: 4.4,
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

export function defaultSpread(leg: string): number {
  const s = SYMBOL_MAP.get(leg);
  if (!s) return 30;
  return s.h <= 24 ? 48 : s.h <= 44 ? 26 : 20;
}

type GatherGeom = { w: number; h: number; prims: Prim[] };
const gatherCache = new Map<string, GatherGeom>();

/**
 * Increase: `count` legs fanned from one shared foot. Decrease: legs gathered into one shared head.
 * Returned primitives are re-centred so the bounding box is centred on (0, 0) like any symbol.
 */
export function gatherGeom(kind: "increase" | "decrease", legId: string, count: number, spread: number): GatherGeom {
  const key = `${kind}|${legId}|${count}|${f(spread)}`;
  const hit = gatherCache.get(key);
  if (hit) return hit;
  const leg = SYMBOL_MAP.get(legId) ?? SYMBOL_MAP.get("sc")!;
  const { w } = leg;
  // short legs (×) get a stem so the fanned symbols sit apart, like the V of 늘려뜨기
  const stem = leg.tall ? 0 : 14;
  const h = leg.h + stem;
  const py = kind === "increase" ? h / 2 : -h / 2;
  const shareHead = kind === "decrease" && !!leg.tall;
  let legPrims = leg.draw({ w, h: leg.h, noHead: shareHead });
  if (stem) {
    const shift = kind === "increase" ? -stem / 2 : stem / 2;
    const reach = leg.h / 2 - 3; // into the symbol box, up to the × tips
    const end = kind === "increase" ? h / 2 - stem - (leg.h / 2 - reach) + 0 : -h / 2 + stem + (leg.h / 2 - reach);
    legPrims = [{ t: "g", transform: `translate(0 ${f(shift)})`, children: legPrims }, { t: "path", d: `M0 ${f(py)}L0 ${f(end)}` }];
  }
  const children: Prim[] = [];
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  const n = Math.max(1, count);
  for (let i = 0; i < n; i++) {
    const a = (i - (n - 1) / 2) * spread;
    children.push(rotateAround(0, py, a, legPrims));
    const r = (a * Math.PI) / 180;
    const cos = Math.cos(r), sin = Math.sin(r);
    // the leg's visible extent: a narrow column around the stem
    const hw = leg.tall ? 7 : Math.min(w / 2, 7);
    for (const [cx, cy] of [[-hw, -h / 2], [hw, -h / 2], [-hw, h / 2], [hw, h / 2]] as const) {
      const dx = cx, dy = cy - py;
      const X = dx * cos - dy * sin;
      const Y = py + dx * sin + dy * cos;
      x0 = Math.min(x0, X); x1 = Math.max(x1, X); y0 = Math.min(y0, Y); y1 = Math.max(y1, Y);
    }
  }
  if (shareHead) children.push({ t: "path", d: `M-8 ${f(-h / 2)}L8 ${f(-h / 2)}` });
  const ox = -(x0 + x1) / 2, oy = -(y0 + y1) / 2;
  const geom: GatherGeom = {
    w: f(x1 - x0 + 4),
    h: f(y1 - y0 + 2),
    prims: [{ t: "g", transform: `translate(${f(ox)} ${f(oy)})`, children }],
  };
  gatherCache.set(key, geom);
  return geom;
}

// ---------- the catalogue ----------

const S = (s: CrochetSymbol) => s;
const gatherSym = (id: string, name: string, kind: "increase" | "decrease", leg: string, count: number, aliases: string[] = []): CrochetSymbol => {
  const spread = 0; // resolved lazily (needs the map)
  return {
    id,
    name,
    group: "incdec",
    w: 0,
    h: 0,
    gather: { kind, leg, count, spread },
    aliases,
    draw: () => [],
  };
};

export const CROCHET_SYMBOLS: CrochetSymbol[] = [
  // 기본
  S({ id: "ch", name: "사슬뜨기", group: "basic", w: 20, h: 10, stretch: "h", aliases: ["ch", "chain", "사슬"], draw: ({ w }) => chainRow(w) }),
  S({ id: "slst", name: "빼뜨기", group: "basic", w: 12, h: 10, aliases: ["sl st", "slip", "빼기"], draw: () => [{ t: "circle", cx: 0, cy: 0, r: 3.2, fill: true }] }),
  S({ id: "sc", name: "짧은뜨기", group: "basic", w: 20, h: 16, leg: true, aliases: ["sc", "single crochet", "x"], draw: () => [{ t: "path", d: cross(0, 0) }] }),
  S({ id: "mr", name: "매직링", group: "basic", w: 30, h: 30, stretch: "u", aliases: ["mr", "magic ring", "원형코", "링"], draw: ({ w }) => [{ t: "circle", cx: 0, cy: 0, r: f(w / 2 - 3) }] }),
  S({ id: "join", name: "시작 (실 잇기)", group: "basic", w: 18, h: 16, aliases: ["start", "join", "시작"], draw: () => [{ t: "path", d: "M0 -6.5L7.5 6.5L-7.5 6.5Z" }] }),
  S({ id: "fasten", name: "종료 (실 자르기)", group: "basic", w: 18, h: 16, aliases: ["end", "fasten off", "종료", "자르기"], draw: () => [{ t: "path", d: "M0 -6.5L7.5 6.5L-7.5 6.5Z", fill: true }] }),

  // 긴뜨기
  S({ id: "hdc", name: "긴뜨기", group: "tall", w: 20, h: 40, stretch: "v", leg: true, tall: true, aliases: ["hdc", "half double"], draw: ({ h, noHead }) => tall(h, 0, { noHead }) }),
  S({ id: "dc", name: "한길긴뜨기", group: "tall", w: 20, h: 60, stretch: "v", leg: true, tall: true, aliases: ["dc", "double crochet", "한길"], draw: ({ h, noHead }) => tall(h, 1, { noHead }) }),
  S({ id: "tr", name: "두길긴뜨기", group: "tall", w: 20, h: 80, stretch: "v", leg: true, tall: true, aliases: ["tr", "treble", "두길"], draw: ({ h, noHead }) => tall(h, 2, { noHead }) }),
  S({ id: "dtr", name: "세길긴뜨기", group: "tall", w: 20, h: 100, stretch: "v", leg: true, tall: true, aliases: ["dtr", "double treble", "세길"], draw: ({ h, noHead }) => tall(h, 3, { noHead }) }),
  S({ id: "trtr", name: "네길긴뜨기", group: "tall", w: 20, h: 120, stretch: "v", leg: true, tall: true, aliases: ["trtr", "네길"], draw: ({ h, noHead }) => tall(h, 4, { noHead }) }),

  // 구슬·팝콘
  S({ id: "hdc3puff", name: "긴뜨기 3코 구슬뜨기", group: "cluster", w: 22, h: 40, stretch: "v", aliases: ["puff", "hdc puff", "구슬"], draw: ({ h }) => spindle(h, [-12, 0, 12], 0) }),
  S({ id: "dc3cl", name: "한길긴뜨기 3코 구슬뜨기", group: "cluster", w: 24, h: 60, stretch: "v", aliases: ["cluster", "dc3cl", "bobble", "구슬"], draw: ({ h }) => spindle(h, [-14, 0, 14], 1) }),
  S({ id: "dc5puff", name: "한길긴뜨기 5코 구슬뜨기", group: "cluster", w: 34, h: 60, stretch: "v", aliases: ["puff", "dc5", "구슬"], draw: ({ h }) => spindle(h, [-28, -14, 0, 14, 28], 1) }),
  S({
    id: "pop",
    name: "팝콘뜨기",
    group: "cluster",
    w: 34,
    h: 60,
    stretch: "v",
    aliases: ["popcorn", "pc", "팝콘"],
    draw: ({ h }) => {
      const top = -h / 2, bot = h / 2;
      let d = "";
      for (const x of [-12, -6, 0, 6, 12]) d += `M0 ${f(bot)}L${x} ${f(top + 6 - Math.abs(x) * 0.15)}`;
      return [{ t: "path", d }, { t: "ellipse", cx: 0, cy: f(top + 5), rx: 14.5, ry: 4.6 }];
    },
  }),

  // 늘림·줄임 (resolved below into GatherItems)
  gatherSym("sc2inc", "짧은뜨기 2코 늘려뜨기", "increase", "sc", 2, ["sc inc", "inc", "늘리기"]),
  gatherSym("sc3inc", "짧은뜨기 3코 늘려뜨기", "increase", "sc", 3, ["sc inc", "늘리기"]),
  gatherSym("sc2tog", "짧은뜨기 2코 모아뜨기", "decrease", "sc", 2, ["sc2tog", "dec", "줄이기"]),
  gatherSym("sc3tog", "짧은뜨기 3코 모아뜨기", "decrease", "sc", 3, ["sc3tog", "줄이기"]),
  gatherSym("hdc2inc", "긴뜨기 2코 늘려뜨기", "increase", "hdc", 2, ["hdc inc"]),
  gatherSym("hdc2tog", "긴뜨기 2코 모아뜨기", "decrease", "hdc", 2, ["hdc2tog"]),
  gatherSym("dc2inc", "한길긴뜨기 2코 늘려뜨기", "increase", "dc", 2, ["dc inc", "늘리기"]),
  gatherSym("dc3inc", "한길긴뜨기 3코 늘려뜨기", "increase", "dc", 3, ["dc inc", "늘리기"]),
  gatherSym("dc5inc", "한길긴뜨기 5코 늘려뜨기", "increase", "dc", 5, ["shell", "조개", "늘리기"]),
  gatherSym("dc2tog", "한길긴뜨기 2코 모아뜨기", "decrease", "dc", 2, ["dc2tog", "줄이기"]),
  gatherSym("dc3tog", "한길긴뜨기 3코 모아뜨기", "decrease", "dc", 3, ["dc3tog", "줄이기"]),

  // 걸어뜨기
  S({ id: "fpdc", name: "앞걸어 한길긴뜨기", group: "post", w: 20, h: 60, stretch: "v", leg: true, tall: true, aliases: ["fpdc", "front post", "앞걸어"], draw: ({ h, noHead }) => tall(h, 1, { noHead, post: "f" }) }),
  S({ id: "bpdc", name: "뒤걸어 한길긴뜨기", group: "post", w: 20, h: 60, stretch: "v", leg: true, tall: true, aliases: ["bpdc", "back post", "뒤걸어"], draw: ({ h, noHead }) => tall(h, 1, { noHead, post: "b" }) }),
  S({ id: "fphdc", name: "앞걸어 긴뜨기", group: "post", w: 20, h: 40, stretch: "v", leg: true, tall: true, aliases: ["fphdc", "front post"], draw: ({ h, noHead }) => tall(h, 0, { noHead, post: "f" }) }),
  S({ id: "bphdc", name: "뒤걸어 긴뜨기", group: "post", w: 20, h: 40, stretch: "v", leg: true, tall: true, aliases: ["bphdc", "back post"], draw: ({ h, noHead }) => tall(h, 0, { noHead, post: "b" }) }),
  S({ id: "fptr", name: "앞걸어 두길긴뜨기", group: "post", w: 20, h: 80, stretch: "v", leg: true, tall: true, aliases: ["fptr", "front post"], draw: ({ h, noHead }) => tall(h, 2, { noHead, post: "f" }) }),

  // 이랑뜨기
  S({ id: "blosc", name: "이랑 짧은뜨기", group: "blo", w: 20, h: 20, leg: true, aliases: ["blo sc", "back loop", "이랑"], draw: () => [{ t: "path", d: cross(0, -3) + "M-6.5 4Q0 11 6.5 4" }] }),
  S({ id: "blohdc", name: "이랑 긴뜨기", group: "blo", w: 20, h: 44, stretch: "v", leg: true, tall: true, aliases: ["blo hdc", "이랑"], draw: ({ h, noHead }) => tall(h, 0, { noHead, blo: true }) }),
  S({ id: "blodc", name: "이랑 한길긴뜨기", group: "blo", w: 20, h: 64, stretch: "v", leg: true, tall: true, aliases: ["blo dc", "이랑"], draw: ({ h, noHead }) => tall(h, 1, { noHead, blo: true }) }),

  // 특수 뜨기
  S({
    id: "vst",
    name: "V뜨기",
    group: "special",
    w: 48,
    h: 60,
    stretch: "v",
    aliases: ["v stitch", "v-st", "브이"],
    draw: ({ h }) => {
      const L = h - 2;
      const a = 20;
      const legs = tall(L, 1);
      const py = h / 2;
      const topY = py - L * Math.cos((a * Math.PI) / 180) + 0; // head height of tilted legs
      return [
        { t: "g", transform: `translate(0 ${f(py - L / 2)})`, children: [rotateAround(0, L / 2, -a, legs), rotateAround(0, L / 2, a, legs)] },
        { t: "ellipse", cx: 0, cy: f(topY - 1), rx: 6, ry: 3.4 },
      ];
    },
  }),
  S({
    id: "picot",
    name: "피코 (사슬 3코)",
    group: "special",
    w: 22,
    h: 24,
    aliases: ["picot", "피코"],
    draw: () => {
      const cy = -2.5, r = 6.6;
      const ovals: Prim[] = [-160, -90, -20].map((a) => {
        const t = (a * Math.PI) / 180;
        return { t: "ellipse", cx: f(Math.cos(t) * r), cy: f(cy + Math.sin(t) * r), rx: 3.7, ry: 2.3, rot: a + 90 };
      });
      return [...ovals, { t: "path", d: "M-6 1.5Q-3 7 0 8.5M6 1.5Q3 7 0 8.5" }, { t: "circle", cx: 0, cy: 9, r: 2.4, fill: true }];
    },
  }),
  S({
    id: "xdc",
    name: "교차 한길긴뜨기",
    group: "special",
    w: 34,
    h: 60,
    stretch: "v",
    aliases: ["crossed dc", "교차"],
    draw: ({ h }) => {
      const top = -h / 2, bot = h / 2;
      // slash on each leg, a little below the crossing point
      const y = h * 0.2;
      const x = 9 - (18 * (bot - y)) / h; // leg from (-9,bot) to (9,top) evaluated at y
      return [
        {
          t: "path",
          d:
            `M-9 ${f(bot)}L9 ${f(top)}M9 ${f(bot)}L-9 ${f(top)}M2 ${f(top)}L16 ${f(top)}M-16 ${f(top)}L-2 ${f(top)}` +
            `M${f(x - 4)} ${f(y + 2.6)}L${f(x + 4)} ${f(y - 2.6)}M${f(-x - 4)} ${f(y + 2.6)}L${f(-x + 4)} ${f(y - 2.6)}`,
        },
      ];
    },
  }),
  S({ id: "rsc", name: "역짧은뜨기 (게뜨기)", group: "special", w: 20, h: 22, aliases: ["reverse sc", "crab", "게뜨기"], draw: () => [{ t: "path", d: cross(0, 3) + "M-7 -6Q0 -12 7 -6M4.5 -9.5L7 -6L3 -5" }] }),
  S({ id: "spike", name: "이어 짧은뜨기 (스파이크)", group: "special", w: 20, h: 36, stretch: "v", aliases: ["spike", "long sc"], draw: ({ h }) => [{ t: "path", d: cross(0, -h / 2 + 7) + `M0 ${f(-h / 2 + 7)}L0 ${f(h / 2)}` }] }),

  // 도형/표시
  S({ id: "marker", name: "코 표시 (마커)", group: "shape", w: 16, h: 22, aliases: ["marker", "표시", "마커"], draw: () => [{ t: "path", d: "M0 10L0 1.5" }, { t: "circle", cx: 0, cy: -4, r: 5.5 }, { t: "circle", cx: 0, cy: -4, r: 1.6, fill: true }] }),
  S({ id: "shape-circle", name: "원", group: "shape", w: 24, h: 24, stretch: "u", aliases: ["circle", "동그라미"], draw: ({ w }) => [{ t: "circle", cx: 0, cy: 0, r: f(w / 2 - 2) }] }),
  S({ id: "shape-ring", name: "점선 원 (단 구분)", group: "shape", w: 60, h: 60, stretch: "u", aliases: ["guide", "dashed circle", "점선"], draw: ({ w }) => [{ t: "circle", cx: 0, cy: 0, r: f(w / 2 - 2), dash: "4 4" }] }),
  S({ id: "shape-rect", name: "사각형", group: "shape", w: 24, h: 24, stretch: "u", aliases: ["square", "rect", "네모"], draw: ({ w, h }) => [{ t: "path", d: `M${f(-w / 2 + 2)} ${f(-h / 2 + 2)}H${f(w / 2 - 2)}V${f(h / 2 - 2)}H${f(-w / 2 + 2)}Z` }] }),
  S({ id: "shape-tri", name: "삼각형", group: "shape", w: 24, h: 22, stretch: "u", aliases: ["triangle", "세모"], draw: ({ w, h }) => [{ t: "path", d: `M0 ${f(-h / 2 + 2)}L${f(w / 2 - 2)} ${f(h / 2 - 2)}L${f(-w / 2 + 2)} ${f(h / 2 - 2)}Z` }] }),
  S({ id: "shape-star", name: "별", group: "shape", w: 24, h: 24, stretch: "u", aliases: ["star"], draw: ({ w }) => [{ t: "path", d: star(w / 2 - 1.5, (w / 2 - 1.5) * 0.45) }] }),
  S({ id: "shape-line", name: "직선", group: "shape", w: 40, h: 8, stretch: "h", aliases: ["line", "선"], draw: ({ w }) => [{ t: "path", d: `M${f(-w / 2 + 1)} 0L${f(w / 2 - 1)} 0` }] }),
  S({ id: "shape-arrow", name: "화살표 (진행 방향)", group: "shape", w: 40, h: 12, stretch: "h", aliases: ["arrow", "방향"], draw: ({ w }) => [{ t: "path", d: `M${f(-w / 2 + 1)} 0L${f(w / 2 - 1)} 0M${f(w / 2 - 7)} -5L${f(w / 2 - 1)} 0L${f(w / 2 - 7)} 5` }] }),
];

export const SYMBOL_MAP = new Map(CROCHET_SYMBOLS.map((s) => [s.id, s]));

// resolve the increase / decrease palette entries now that legs exist
for (const s of CROCHET_SYMBOLS) {
  if (!s.gather) continue;
  s.gather.spread = defaultSpread(s.gather.leg);
  const g = gatherGeom(s.gather.kind, s.gather.leg, s.gather.count, s.gather.spread);
  s.w = g.w;
  s.h = g.h;
  s.draw = () => g.prims;
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
export function renderPrims(prims: Prim[], color: string): ReactNode {
  return prims.map((p, i) => {
    switch (p.t) {
      case "path":
        return <path key={i} d={p.d} fill={p.fill ? color : "none"} strokeDasharray={p.dash} />;
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
          />
        );
      case "circle":
        return <circle key={i} cx={p.cx} cy={p.cy} r={p.r} fill={p.fill ? color : "none"} strokeDasharray={p.dash} />;
      case "g":
        return (
          <g key={i} transform={p.transform}>
            {renderPrims(p.children, color)}
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

/** Small preview of a symbol for palettes and slots. */
export function SymbolIcon({ id, size = 40, color = INK, className }: { id: string; size?: number; color?: string; className?: string }) {
  const s = SYMBOL_MAP.get(id);
  if (!s) return null;
  const { w, h } = symbolSize(s);
  const side = Math.max(w, h, 40) + 4;
  return (
    <svg
      viewBox={`${-side / 2} ${-side / 2} ${side} ${side}`}
      width={size}
      height={size}
      className={className}
      aria-hidden="true"
      fill="none"
      stroke={color}
      strokeWidth={(STROKE_WIDTH * side) / 46}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {renderPrims(s.draw({ w, h }), color)}
    </svg>
  );
}
