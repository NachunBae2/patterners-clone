// Document operations shared by the editor, the side panels and the assistant (all pure).
import { uid } from "@/lib/id";
import type { CrochetData, CrochetFolder, CrochetItem, CrochetLayer, RoundGuide } from "@/lib/types";
import { getSymbol } from "@/lib/symbols/crochet";
import { buildChart, layerStitches, roundLayers, type BuiltRound, type Layout, type Round } from "./chart";
import { itemFoot, itemHead, moveItem, unionBounds, type Pt } from "./geometry";

export type Doc = Omit<CrochetData, "view">;

export const folderList = (d: Doc): CrochetFolder[] => d.folders ?? [];

/** Unique "<base> n" name among existing folders. */
export function nextFolderName(d: Doc, base = "폴더") {
  const names = new Set(folderList(d).map((f) => f.name));
  if (base !== "폴더" && !names.has(base)) return base;
  let n = 1;
  while (names.has(`${base} ${n}`)) n++;
  return `${base} ${n}`;
}

/** Moves built rounds so their bounding box is centred on `at`. */
export function centerBuilt(built: BuiltRound[], at: Pt): BuiltRound[] {
  const b = unionBounds(built.flatMap((r) => r.items));
  if (!b) return built;
  const dx = Math.round(at.x - (b.x0 + b.x1) / 2), dy = Math.round(at.y - (b.y0 + b.y1) / 2);
  if (!dx && !dy) return built;
  const g = (gd: RoundGuide): RoundGuide => (gd.kind === "round" ? { ...gd, cx: gd.cx + dx, cy: gd.cy + dy } : { ...gd, cx: gd.cx + dx, foot: gd.foot + dy, top: gd.top + dy });
  return built.map((r) => ({ ...r, items: r.items.map((it) => moveItem(it, dx, dy)), guide: g(r.guide) }));
}

/** Where new content of size w × h goes: `at`, or right of what is already drawn when that would overlap. */
export function freeSpot(d: Doc, at: Pt, w: number, h: number): Pt {
  const b = unionBounds(d.layers.filter((l) => l.visible).flatMap((l) => l.items));
  if (!b) return at;
  const overlaps = at.x - w / 2 < b.x1 + 20 && at.x + w / 2 > b.x0 - 20 && at.y - h / 2 < b.y1 + 20 && at.y + h / 2 > b.y0 - 20;
  return overlaps ? { x: Math.round(b.x1 + 80 + w / 2), y: at.y } : at;
}

/** Builds rounds at `at` and adds them as a new folder with one layer (단) per round. */
export function insertChart(d: Doc, rounds: Round[], o: { layout: Layout; at: Pt; name: string; ring?: boolean; roundGap?: number; spacing?: number }) {
  const raw = buildChart(rounds, { layout: o.layout, cx: o.at.x, cy: o.at.y, ring: o.ring, roundGap: o.roundGap, spacing: o.spacing });
  const rb = unionBounds(raw.flatMap((r) => r.items));
  const built = centerBuilt(raw, rb ? freeSpot(d, o.at, rb.x1 - rb.x0, rb.y1 - rb.y0) : o.at);
  const folder: CrochetFolder = { id: uid(), name: nextFolderName(d, o.name) };
  const layers = roundLayers(built, folder.id);
  if (!layers.length) return { doc: d, layers, stitches: 0, counts: [] as number[] };
  const doc: Doc = { ...d, folders: [...folderList(d), folder], layers: [...d.layers, ...layers], activeLayerId: layers[layers.length - 1].id };
  return { doc, layers, folder, stitches: built.reduce((s, r) => s + r.produced, 0), counts: built.map((r) => r.produced) };
}

/** Layers named "N단" in the same scope as the active layer (its folder, or the loose layers). */
export function roundScope(d: Doc, folderId?: string | null): { layer: CrochetLayer; n: number }[] {
  const active = d.layers.find((l) => l.id === d.activeLayerId);
  const fid = folderId !== undefined ? folderId : (active?.folderId ?? null);
  const pick = (f: string | null) =>
    d.layers
      .filter((l) => (l.folderId ?? null) === f)
      .map((layer) => ({ layer, n: Number(layer.name.match(/^(\d+)\s*단$/)?.[1] ?? NaN) }))
      .filter((x) => Number.isFinite(x.n));
  let list = pick(fid);
  if (!list.length) list = d.layers.map((layer) => ({ layer, n: Number(layer.name.match(/^(\d+)\s*단$/)?.[1] ?? NaN) })).filter((x) => Number.isFinite(x.n));
  return list.sort((a, b) => a.n - b.n);
}

const placed = (it: CrochetItem) => it.type === "stitch" || it.type === "gather";

/** Guess how a hand-drawn layer was laid out, so a next round can follow it. */
export function inferGuide(d: Doc, layer: CrochetLayer): RoundGuide | null {
  const items = layer.items.filter(placed) as (CrochetItem & { x: number; y: number; rotation: number })[];
  if (!items.length) return null;
  const b = unionBounds(items)!;
  const upright = items.every((it) => Math.abs(it.rotation) < 1);
  if (upright && b.y1 - b.y0 < (b.x1 - b.x0) * 0.6) {
    const cx = (b.x0 + b.x1) / 2;
    return { kind: "row", cx, foot: b.y1, top: b.y0, dir: 1 };
  }
  const scope = d.layers.filter((l) => (l.folderId ?? null) === (layer.folderId ?? null));
  let ring: Pt | null = null;
  for (const l of scope) for (const it of l.items) if (it.type === "stitch" && getSymbol(it.symbol)?.id === "magic_ring") ring = { x: it.x, y: it.y };
  const all = scope.flatMap((l) => l.items.filter(placed)) as typeof items;
  const c = ring ?? { x: all.reduce((s, i) => s + i.x, 0) / all.length, y: all.reduce((s, i) => s + i.y, 0) / all.length };
  let d0 = Infinity, top = 0;
  for (const it of items) {
    if (it.type === "stitch" && getSymbol(it.symbol)?.id === "magic_ring") continue;
    const f = itemFoot(it as never), hd = itemHead(it as never);
    d0 = Math.min(d0, Math.hypot(f.x - c.x, f.y - c.y));
    top = Math.max(top, Math.hypot(hd.x - c.x, hd.y - c.y));
  }
  if (!Number.isFinite(d0)) return null;
  return { kind: "round", layout: "radial", cx: c.x, cy: c.y, core: [[0, 0]], d: d0, top };
}

/** Builds rounds after `after` (a layer) and inserts them right above it, named from `firstN`. */
export function appendRounds(d: Doc, after: CrochetLayer, rounds: Round[], firstN: number) {
  const guide = after.guide ?? inferGuide(d, after);
  if (!guide) return null;
  const layout: Layout = guide.kind === "row" ? "linear" : guide.layout;
  const built = buildChart(rounds, { layout, cx: 0, cy: 0, after: guide, prevCount: layerStitches(after.items) });
  const layers = roundLayers(built, after.folderId).map((l, i) => ({ ...l, name: `${firstN + i}단`, ...(after.color ? { color: after.color } : {}) }));
  const idx = d.layers.findIndex((l) => l.id === after.id);
  const next = [...d.layers];
  next.splice(idx + 1, 0, ...layers);
  return { doc: { ...d, layers: next, activeLayerId: layers[layers.length - 1]?.id ?? d.activeLayerId }, layers, built };
}

/** Most used leg / tall stitch of a round (for "one more round"). */
export function dominantStitch(items: CrochetItem[]): string | null {
  const counts = new Map<string, number>();
  for (const it of items) {
    const id = it.type === "gather" ? it.symbol : it.type === "stitch" ? getSymbol(it.symbol)?.id : undefined;
    if (!id) continue;
    const s = getSymbol(id);
    if (!s || !(s.leg || s.tall)) continue;
    counts.set(id, (counts.get(id) ?? 0) + (it.type === "gather" ? it.count : 1));
  }
  return [...counts].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
}

/** Copies layers (fresh ids) into a new folder: used for imported chart files. */
export function insertLayersAsFolder(d: Doc, layers: CrochetLayer[], name: string, at0: Pt) {
  const b = unionBounds(layers.flatMap((l) => l.items));
  const at = b ? freeSpot(d, at0, b.x1 - b.x0, b.y1 - b.y0) : at0;
  const dx = b ? Math.round(at.x - (b.x0 + b.x1) / 2) : 0, dy = b ? Math.round(at.y - (b.y0 + b.y1) / 2) : 0;
  const folder: CrochetFolder = { id: uid(), name: nextFolderName(d, name) };
  const groups = new Map<string, string>();
  const copies: CrochetLayer[] = layers.map((l) => ({
    id: uid(),
    name: l.name,
    visible: l.visible !== false,
    ...(l.color ? { color: l.color } : {}),
    folderId: folder.id,
    items: l.items.map((it) => {
      const c = moveItem(structuredClone(it), dx, dy);
      c.id = uid();
      if (c.groupId) {
        if (!groups.has(c.groupId)) groups.set(c.groupId, uid());
        c.groupId = groups.get(c.groupId);
      }
      return c;
    }),
  }));
  return { doc: { ...d, folders: [...folderList(d), folder], layers: [...d.layers, ...copies], activeLayerId: copies[copies.length - 1]?.id ?? d.activeLayerId }, count: copies.reduce((s, l) => s + l.items.length, 0) };
}
