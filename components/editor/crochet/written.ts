// 서술도안: the written pattern read back from the chart, one line per round.
import type { CrochetFolder, CrochetItem, CrochetLayer } from "@/lib/types";
import { getSymbol } from "@/lib/symbols/crochet";
import { itemStitches, layerStitches } from "./chart";
import { itemFoot } from "./geometry";

export type Notation = "ko" | "en";
export type WrittenRound = { label: string; text: string; count: number; detected?: boolean };
export type WrittenSection = { title: string | null; rounds: WrittenRound[] };
export type WrittenPattern = { sections: WrittenSection[]; perSymbol: { name: string; count: number }[]; total: number; empty: boolean };

const EN: Record<string, string> = { sc: "sc", hdc: "hdc", dc: "dc", tr: "tr", dtr: "dtr", tall_4: "trtr", slst: "sl st", ch: "ch", magic_ring: "MR", bobble: "bobble", popcorn: "popcorn", puff: "puff", picot: "picot", sc_blo: "BLO sc", hdc_blo: "BLO hdc", dc_blo: "BLO dc", sc_flo: "FLO sc", hdc_flo: "FLO hdc", dc_flo: "FLO dc", fpdc: "FPdc", bpdc: "BPdc", fpsc: "FPsc", bpsc: "BPsc" };

type Tok = { key: string; n: number };

const symName = (id: string, nt: Notation) => {
  const s = getSymbol(id);
  if (nt === "en") return EN[s?.id ?? id] ?? s?.aliases?.find((a) => /^[a-z0-9 -]+$/i.test(a)) ?? id;
  return s?.name ?? id;
};

function tokKey(it: CrochetItem): Tok | null {
  if (it.type === "gather") return { key: `${it.kind === "increase" ? "inc" : "dec"}:${it.symbol}:${it.count}`, n: 1 };
  if (it.type !== "stitch") return null;
  const s = getSymbol(it.symbol);
  if (s?.id === "ch") return { key: "ch", n: Math.max(1, Math.round(it.scale ?? 1)) };
  return { key: `st:${s?.id ?? it.symbol}`, n: 1 };
}

function tokText(t: Tok, nt: Notation): string {
  const [k, a, b] = t.key.split(":");
  if (k === "ch") return nt === "en" ? `ch ${t.n}` : `사슬뜨기 ${t.n}`;
  if (k === "st") {
    if (a === "magic_ring") return nt === "en" ? "MR" : "매직링";
    return `${symName(a, nt)} ${t.n}`;
  }
  const legs = Number(b);
  if (nt === "en") {
    const leg = symName(a, "en");
    const w = k === "inc" ? (legs === 2 ? (a === "sc" ? "inc" : `${leg} inc`) : `${leg}${legs}inc`) : legs === 2 && a === "sc" ? "dec" : `${leg}${legs}tog`;
    return `${w} ${t.n}`;
  }
  return `${symName(a, "ko")} ${legs}코 ${k === "inc" ? "늘려뜨기" : "모아뜨기"} ${t.n}`;
}

/** Run-length tokens, then a whole-round repeat "(a, b) × n" when the round is one unit repeated. */
function roundText(items: CrochetItem[], nt: Notation): string {
  const toks: Tok[] = [];
  for (const it of items) {
    const t = tokKey(it);
    if (!t) continue;
    const last = toks[toks.length - 1];
    if (last && last.key === t.key && t.key !== "st:magic_ring") last.n += t.n;
    else toks.push({ ...t });
  }
  if (!toks.length) return "";
  const head: Tok[] = [];
  while (toks.length && (toks[0].key === "st:magic_ring")) head.push(toks.shift()!);
  const parts = head.map((t) => tokText(t, nt));
  const body = findRepeat(toks);
  if (body) {
    const unit = body.unit.map((t) => tokText(t, nt)).join(", ");
    parts.push(body.unit.length > 1 || body.times > 1 ? `(${unit}) × ${body.times}` : unit);
    parts.push(...body.rest.map((t) => tokText(t, nt)));
  } else parts.push(...toks.map((t) => tokText(t, nt)));
  return parts.join(", ");
}

function findRepeat(toks: Tok[]): { unit: Tok[]; times: number; rest: Tok[] } | null {
  const n = toks.length;
  for (let p = 1; p <= n / 2; p++) {
    let times = 1;
    while ((times + 1) * p <= n && toks.slice(times * p, (times + 1) * p).every((t, i) => t.key === toks[i].key && t.n === toks[i].n)) times++;
    if (times >= 2 && (times * p === n || n - times * p <= 2)) return { unit: toks.slice(0, p), times, rest: toks.slice(times * p) };
  }
  return null;
}

const placed = (it: CrochetItem) => it.type === "stitch" || it.type === "gather";

/** Splits one hand-drawn layer into rounds by distance from its centre (or rows by height). */
function detectRounds(items: CrochetItem[]): CrochetItem[][] | null {
  const pts = items.filter(placed) as (CrochetItem & { x: number; y: number; rotation: number })[];
  if (pts.length < 6) return null;
  const ring = pts.find((it) => it.type === "stitch" && it.symbol === "magic_ring");
  const others = pts.filter((it) => it !== ring);
  const foot = (it: (typeof pts)[number]) => itemFoot(it as never);
  const upright = others.every((it) => Math.abs(it.rotation) < 1);
  const groups: (typeof pts)[] = [];
  if (!upright) {
    const c = ring ?? { x: others.reduce((s, i) => s + i.x, 0) / others.length, y: others.reduce((s, i) => s + i.y, 0) / others.length };
    const withR = others.map((it) => {
      const f = foot(it);
      return { it, r: Math.hypot(f.x - c.x, f.y - c.y), a: (Math.atan2(f.x - c.x, -(f.y - c.y)) + 2 * Math.PI) % (2 * Math.PI) };
    });
    withR.sort((a, b) => a.r - b.r);
    let cur: typeof withR = [];
    const gs: (typeof withR)[] = [];
    withR.forEach((w, i) => {
      if (i && w.r - withR[i - 1].r > 12) {
        gs.push(cur);
        cur = [];
      }
      cur.push(w);
    });
    if (cur.length) gs.push(cur);
    if (gs.length < 2) return null;
    gs.forEach((g, i) => groups.push([...(i === 0 && ring ? [ring] : []), ...g.sort((a, b) => a.a - b.a).map((w) => w.it)]));
  } else {
    const withY = others.map((it) => ({ it, y: foot(it).y }));
    withY.sort((a, b) => b.y - a.y);
    let cur: typeof withY = [];
    const gs: (typeof withY)[] = [];
    withY.forEach((w, i) => {
      if (i && withY[i - 1].y - w.y > 10) {
        gs.push(cur);
        cur = [];
      }
      cur.push(w);
    });
    if (cur.length) gs.push(cur);
    if (gs.length < 2) return null;
    gs.forEach((g, i) => groups.push(g.sort((a, b) => (i % 2 ? a.it.x - b.it.x : b.it.x - a.it.x)).map((w) => w.it)));
  }
  return groups;
}

const enLabel = (name: string) => {
  const m = name.match(/^(\d+)\s*단$/);
  return m ? `R${m[1]}` : name === "바닥" ? "Foundation" : name;
};

export function writtenPattern(layers: CrochetLayer[], folders: CrochetFolder[], nt: Notation): WrittenPattern {
  const perSymbol = new Map<string, number>();
  let total = 0;
  const sectionFor = new Map<string | null, WrittenRound[]>();
  const order: (string | null)[] = [];
  const folderName = new Map(folders.map((f) => [f.id, f.name]));
  for (const l of layers) {
    if (!l.visible) continue;
    const items = l.items.filter(placed);
    if (!items.length) continue;
    const fid = l.folderId && folderName.has(l.folderId) ? l.folderId : null;
    if (!sectionFor.has(fid)) {
      sectionFor.set(fid, []);
      order.push(fid);
    }
    const list = sectionFor.get(fid)!;
    const detected = !l.guide && l.items.length ? detectRounds(l.items) : null;
    const label = nt === "en" ? enLabel(l.name) : l.name;
    if (detected) {
      detected.forEach((g, i) => list.push({ label: nt === "en" ? `${label} · R${i + 1}` : `${l.name} · ${i + 1}단`, text: roundText(g, nt), count: layerStitches(g), detected: true }));
    } else list.push({ label, text: roundText(l.items, nt), count: layerStitches(l.items) });
    const chainOnly = items.every((it) => it.type === "stitch" && it.symbol === "ch");
    for (const it of items) {
      const t = tokKey(it);
      if (!t) continue;
      const name = t.key === "ch" ? symName("ch", nt) : t.key.startsWith("st:") ? symName(t.key.slice(3), nt) : tokText({ key: t.key, n: 1 }, nt).replace(/ 1$/, "");
      perSymbol.set(name, (perSymbol.get(name) ?? 0) + t.n);
      total += itemStitches(it, chainOnly);
    }
  }
  const sections = order.map((fid) => ({ title: fid ? folderName.get(fid)! : folders.length ? (nt === "en" ? "No folder" : "폴더 없음") : null, rounds: sectionFor.get(fid)! }));
  return { sections, perSymbol: [...perSymbol].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count), total, empty: !sections.length };
}

/** Plain text for the clipboard. */
export function writtenText(w: WrittenPattern, nt: Notation): string {
  const out: string[] = [];
  for (const s of w.sections) {
    if (s.title) out.push(`[${s.title}]`);
    for (const r of s.rounds) out.push(`${r.label}: ${r.text} (${r.count}${nt === "en" ? "" : "코"})`);
    out.push("");
  }
  out.push(nt === "en" ? `Total ${w.total} sts` : `모두 ${w.total}코`);
  return out.join("\n").trim();
}
