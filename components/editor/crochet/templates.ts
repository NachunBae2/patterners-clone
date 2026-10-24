// 템플릿: editable starting charts generated from a few numbers (no stored drawings).
import { ch, dec, inc, rep, st, type Layout, type Node, type Round } from "./chart";

export type TemplateField = { key: string; label: string; min: number; max: number; def: number; step?: number; options?: { value: number; label: string }[] };
export type TemplateDef = {
  id: string;
  name: string;
  desc: string;
  layout: Layout;
  fields: TemplateField[];
  build: (p: Record<string, number>) => Round[];
};

/** Stitch choice used by several templates (value = index into STITCHES). */
const STITCHES = ["sc", "hdc", "dc"] as const;
const stitchField = (def = 0): TemplateField => ({
  key: "stitch",
  label: "코 종류",
  min: 0,
  max: 2,
  def,
  options: [
    { value: 0, label: "짧은뜨기" },
    { value: 1, label: "긴뜨기" },
    { value: 2, label: "한길 긴뜨기" },
  ],
});
const sym = (p: Record<string, number>) => STITCHES[Math.max(0, Math.min(2, Math.round(p.stitch ?? 0)))];

/** Round that grows `from` → `from + places` with increases spread evenly. */
export function increaseRound(s: string, from: number, places: number): Node[] {
  if (places <= 0) return [st(s, from)];
  if (from % places === 0) {
    const g = from / places;
    return [rep(g > 1 ? [st(s, g - 1), inc(s)] : [inc(s)], places)];
  }
  return spread(from, places, () => inc(s), (n) => st(s, n), 1);
}

/** Round that shrinks `from` → `from - places` with decreases spread evenly. */
export function decreaseRound(s: string, from: number, places: number): Node[] {
  if (places <= 0) return [st(s, from)];
  places = Math.min(places, Math.floor(from / 2));
  if (from % places === 0) {
    const g = from / places;
    return [rep(g > 2 ? [st(s, g - 2), dec(s)] : [dec(s)], places)];
  }
  return spread(from, places, () => dec(s), (n) => st(s, n), 2);
}

function spread(from: number, places: number, mark: () => Node, plain: (n: number) => Node, uses: number): Node[] {
  const out: Node[] = [];
  const plainTotal = from - places * uses;
  let used = 0;
  for (let j = 0; j < places; j++) {
    const upto = Math.round(((j + 1) * plainTotal) / places);
    const n = upto - used;
    used = upto;
    if (n > 0) out.push(plain(n));
    out.push(mark());
  }
  return out;
}

/** Flat circle rounds: `start` stitches in a magic ring, then +start every round. */
export function circleRounds(s: string, start: number, rounds: number, delta = start): Round[] {
  const out: Round[] = [{ label: "1", nodes: [{ k: "ring" }, st(s, start)] }];
  let count = start;
  for (let k = 2; k <= rounds; k++) {
    out.push({ label: String(k), nodes: increaseRound(s, count, delta) });
    count += delta;
  }
  return out;
}

export const TEMPLATES: TemplateDef[] = [
  {
    id: "circle",
    name: "원형",
    desc: "매직링에서 시작해 단마다 고르게 늘려요. 컵받침·모자 정수리·인형 바닥에 써요.",
    layout: "radial",
    fields: [stitchField(0), { key: "start", label: "1단 코 수", min: 3, max: 16, def: 6 }, { key: "rounds", label: "단 수 (1단 포함)", min: 1, max: 12, def: 5 }],
    build: (p) => circleRounds(sym(p), p.start, p.rounds),
  },
  {
    id: "oval",
    name: "타원 바닥",
    desc: "기초 사슬 양 끝을 돌며 늘려요. 가방·바구니 바닥에 써요.",
    layout: "oval",
    fields: [{ key: "chains", label: "기초 사슬 수", min: 4, max: 30, def: 10 }, { key: "rounds", label: "늘리는 단 수", min: 1, max: 8, def: 3 }, { key: "side", label: "옆면 단 수", min: 0, max: 6, def: 0 }],
    build: (p) => {
      const side = p.chains - 2;
      const out: Round[] = [{ label: "0", nodes: [ch(p.chains)], foundation: true }];
      let count = 0;
      for (let k = 1; k <= p.rounds; k++) {
        const end: Node[] = k === 1 ? [inc("sc", 1, 3)] : increaseRound("sc", 3 * (k - 1), 3);
        out.push({ label: String(k), nodes: [st("sc", side), ...end, st("sc", side), ...end], align: side / 2 });
        count = 2 * side + 6 * k;
      }
      for (let k = 1; k <= p.side; k++) out.push({ label: String(p.rounds + k), nodes: [st("sc", count)], align: side / 2 });
      return out;
    },
  },
  {
    id: "ball",
    name: "공",
    desc: "짧은뜨기로 늘리고, 그대로 뜨다가 줄여서 닫아요. 인형 머리·몸통에 써요.",
    layout: "radial",
    fields: [{ key: "widest", label: "가장 넓은 단 코 수", min: 12, max: 48, def: 30, step: 6 }, { key: "straight", label: "늘림 없는 단 수", min: 0, max: 8, def: 3 }],
    build: (p) => {
      const k = Math.max(2, Math.round(p.widest / 6));
      const out = circleRounds("sc", 6, k);
      let n = k + 1;
      for (let i = 0; i < p.straight; i++) out.push({ label: String(n++), nodes: [st("sc", 6 * k)] });
      for (let c = 6 * k; c > 6; c -= 6) out.push({ label: String(n++), nodes: decreaseRound("sc", c, 6) });
      return out;
    },
  },
  {
    id: "tube",
    name: "원통",
    desc: "사슬을 고리로 이어 늘림 없이 둘러 떠요. 컵 홀더·손목 토시에 써요.",
    layout: "radial",
    fields: [stitchField(0), { key: "chains", label: "둘레 코 수", min: 8, max: 48, def: 20 }, { key: "rounds", label: "단 수", min: 1, max: 10, def: 4 }],
    build: (p) => {
      const out: Round[] = [{ label: "0", nodes: [ch(p.chains)], foundation: true }];
      for (let k = 1; k <= p.rounds; k++) out.push({ label: String(k), nodes: [st(sym(p), p.chains)] });
      return out;
    },
  },
  {
    id: "rect",
    name: "사각 평면",
    desc: "기초 사슬 위에 단마다 뒤집어 떠요. 컵받침·담요 조각에 써요.",
    layout: "linear",
    fields: [stitchField(0), { key: "chains", label: "가로 코 수", min: 2, max: 40, def: 10 }, { key: "rounds", label: "단 수", min: 1, max: 20, def: 6 }],
    build: (p) => {
      const s = sym(p);
      const turn = s === "sc" ? 1 : s === "hdc" ? 2 : 3;
      const out: Round[] = [{ label: "0", nodes: [ch(p.chains + turn)], foundation: true }];
      out.push({ label: "1", nodes: [st(s, p.chains)] });
      // a turning chain of 2+ stands in for the first stitch
      for (let k = 2; k <= p.rounds; k++) out.push({ label: String(k), nodes: [ch(turn), st(s, turn > 1 ? p.chains - 1 : p.chains)] });
      return out;
    },
  },
  {
    id: "flower",
    name: "꽃 모티프",
    desc: "매직링에 짧은뜨기를 뜨고 꽃잎을 둘러 떠요. 브로치·가방 장식에 써요.",
    layout: "radial",
    fields: [{ key: "petals", label: "꽃잎 수", min: 4, max: 10, def: 6 }],
    build: (p) => [
      { label: "1", nodes: [{ k: "ring" }, st("sc", p.petals * 2)] },
      { label: "2", nodes: [rep([st("sc"), inc("dc", 1, 5)], p.petals)] },
    ],
  },
  {
    id: "granny",
    name: "그래니 스퀘어",
    desc: "한길 긴뜨기 세 코 묶음과 사슬로 네 모서리를 키워요. 담요·가방 조각에 써요.",
    layout: "square",
    fields: [{ key: "rounds", label: "단 수", min: 1, max: 6, def: 3 }],
    build: (p) => {
      const out: Round[] = [];
      for (let k = 1; k <= p.rounds; k++) {
        const side: Node[] = [st("dc", 3), ...(k > 1 ? [rep([ch(1), st("dc", 3)], k - 1)] : []), ch(2)];
        out.push({ label: String(k), nodes: [...(k === 1 ? [{ k: "ring" } as Node] : []), rep(side, 4)] });
      }
      return out;
    },
  },
  {
    id: "square",
    name: "사각 모티프",
    desc: "한길 긴뜨기로 빈틈없이 뜨고 네 모서리에서 늘려요. 이어 붙이는 조각에 써요.",
    layout: "square",
    fields: [{ key: "rounds", label: "단 수", min: 1, max: 5, def: 3 }],
    build: (p) => Array.from({ length: p.rounds }, (_, i) => ({ label: String(i + 1), nodes: [...(i === 0 ? [{ k: "ring" } as Node] : []), rep([st("dc", 4 * i + 3), ch(2)], 4)] })),
  },
  {
    id: "hexagon",
    name: "육각 모티프",
    desc: "여섯 모서리에서 늘려 벌집처럼 이어 붙여요. 담요·쿠션 조각에 써요.",
    layout: "hexagon",
    fields: [{ key: "rounds", label: "단 수", min: 1, max: 5, def: 3 }],
    build: (p) => Array.from({ length: p.rounds }, (_, i) => ({ label: String(i + 1), nodes: [...(i === 0 ? [{ k: "ring" } as Node] : []), rep([st("dc", 2 * (i + 1)), ch(2)], 6)] })),
  },
];

export const TEMPLATE_MAX_STITCHES = 1500;

export const templateDefaults = (t: TemplateDef) => Object.fromEntries(t.fields.map((f) => [f.key, f.def]));
