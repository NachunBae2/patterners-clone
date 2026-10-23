"use client";

import { memo, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { EditorShell, openShortcutHelp, type ShortcutGroup } from "@/components/app/EditorShell";
import { Brush, Eraser, Fit, Grid, GridEdit, Hand, Lasso, Layers, Pencil, Pipette, Plus, Pointer, X, ZoomIn, ZoomOut } from "@/components/app/icons";
import { Button, ContextMenu, Dialog, IconButton, cx, isMod, useHotkeys, useToast, type MenuItem } from "@/components/app/ui";
import { exportSvg, safeName, svgThumbnail } from "@/lib/export";
import { uid } from "@/lib/id";
import { knitSymbol, symbolDefs } from "@/lib/symbols/knitting";
import { CRAFT_LABEL, type KnitData, type View, type Work } from "@/lib/types";
import { useAutosave } from "@/lib/useAutosave";
import { useHistory } from "@/lib/useHistory";
import {
  BIG_GRID,
  cellLine,
  clamp,
  clearRect,
  clipRect,
  eraseSymbol,
  flipBlockH,
  flipBlockV,
  geoOf,
  gridBounds,
  newGrid,
  nextGridName,
  normRect,
  paintCells,
  placeSymbol,
  readBlock,
  rectH,
  rectW,
  resizeGrid,
  rotateBlockCW,
  symbolAt,
  tileBlock,
  writeBlock,
  type Block,
  type Geo,
  type KDoc,
  type KGrid,
  type Numbering,
  type Rect,
  type Sel,
} from "./model";
import { LeftPanel, RightPanel, type LeftTab, type MyPattern, type Stamp } from "./Panels";
import { buildSvg, buildThumb, drawGridCanvas, gridBody, numberMarkup } from "./render";

type Mode = "select" | "edit" | "pan" | "grid" | "gridEdit" | "brush";
type Pt = { x: number; y: number };
type Cell = { c: number; r: number };

type Drag =
  | { kind: "pan"; sx: number; sy: number; vx: number; vy: number }
  | { kind: "create"; start: Pt; cur: Pt; moved: boolean; dims?: { x: number; y: number; w: number; h: number; cols: number; rows: number } }
  | { kind: "edit"; gridId: string; last: Cell; start: Cell; erase: boolean; sym: string; cp: boolean; warned: boolean }
  | { kind: "stamp"; gridId: string; origin: Cell; done: Set<string>; last: Cell; cp: boolean }
  | { kind: "paint"; gridId: string; last: Cell; color: string | null; cp: boolean }
  | { kind: "lasso"; points: Pt[] }
  | { kind: "range"; gridId: string; anchor: Cell }
  | { kind: "move"; snap: KDoc; srcId: string; rect: Rect; block: Block; grab: Cell; copy: boolean; key: string; cp: boolean }
  | { kind: "fill"; snap: KGrid; gridId: string; rect: Rect; block: Block; hx: number; hy: number; key: string; cp: boolean }
  | { kind: "gridMove"; gridId: string; gx: number; gy: number; start: Pt; cp: boolean }
  | { kind: "resize"; gridId: string; snap: KGrid; edge: "l" | "r" | "t" | "b"; start: Pt; key: string; cp: boolean }
  | { kind: "carve"; gridId: string; last: Cell; remove: boolean; cp: boolean };

const MY_KEY = "pt:knit:myPatterns";
const CLIP_KEY = "pt:knit:clipboard";
const MY_MAX = 60;

const readMine = (): MyPattern[] => {
  try {
    const v = JSON.parse(localStorage.getItem(MY_KEY) ?? "[]");
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
};

function normalize(d: KnitData): KDoc {
  return {
    grids: (d.grids ?? []).map((g) => ({ ...g, cells: g.cells.length === g.cols * g.rows ? g.cells : Array(g.cols * g.rows).fill(null) })),
    activeGridId: d.activeGridId ?? null,
    colors: d.colors?.length ? d.colors : ["#24365c", "#efe7d6", "#c47a5c"],
    gauge: d.gauge ?? { sts: 22, rows: 30 },
    view: d.view ?? { x: 0, y: 0, zoom: 1 },
  };
}

const SHORTCUTS: ShortcutGroup[] = [
  {
    title: "도구",
    items: [
      { keys: "V", label: "선택" },
      { keys: "E", label: "편집" },
      { keys: "H", label: "이동" },
      { keys: "K", label: "격자 만들기" },
      { keys: "G", label: "격자 편집" },
      { keys: "B", label: "칸 색칠" },
      { keys: "Esc", label: "선택 해제 / 취소" },
    ],
  },
  {
    title: "선택",
    items: [
      { keys: "Ctrl(Cmd) + A", label: "모든 칸 선택" },
      { keys: "방향키", label: "선택 칸 한 칸씩 옮기기" },
      { keys: "Shift + 방향키", label: "선택 범위 늘리기" },
      { keys: "드래그", label: "선택한 칸 옮기기" },
      { keys: "Ctrl(Cmd) + 드래그", label: "선택한 칸 복사" },
      { keys: "핸들 드래그", label: "그 방향으로 무늬 반복" },
    ],
  },
  {
    title: "편집",
    items: [
      { keys: "Ctrl(Cmd) + Z", label: "실행 취소" },
      { keys: "Shift + Ctrl(Cmd) + Z", label: "다시 실행" },
      { keys: "Ctrl(Cmd) + C", label: "복사" },
      { keys: "Ctrl(Cmd) + X", label: "잘라내기" },
      { keys: "Ctrl(Cmd) + V", label: "붙여넣기" },
      { keys: "Delete", label: "삭제" },
      { keys: "Shift + H", label: "좌우 뒤집기" },
      { keys: "Shift + V", label: "상하 뒤집기" },
      { keys: "R", label: "회전" },
    ],
  },
  {
    title: "보기",
    items: [
      { keys: "Space + 드래그", label: "화면 이동" },
      { keys: "Ctrl(Cmd) + 휠", label: "확대·축소" },
      { keys: "Shift + 1", label: "화면에 맞추기" },
      { keys: "Shift", label: "격자를 끄는 동안 정사각 격자" },
      { keys: "?", label: "단축키 보기" },
    ],
  },
];

// ---------------- grid layer (memoised per grid object) ----------------

const GridLayer = memo(function GridLayer({ grid, geo }: { grid: KGrid; geo: Geo }) {
  const big = grid.cols * grid.rows > BIG_GRID;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const cv = canvasRef.current;
    if (!big || !cv) return;
    let alive = true;
    drawGridCanvas(cv, grid, geo, () => alive).catch(() => {});
    return () => {
      alive = false;
    };
  }, [big, grid, geo]);
  const markup = useMemo(() => (big ? numberMarkup(grid, geo) : gridBody(grid, geo) + numberMarkup(grid, geo)), [big, grid, geo]);
  const W = grid.cols * geo.cw;
  const H = grid.rows * geo.ch;
  return (
    <g transform={`translate(${grid.x} ${grid.y})`}>
      {big && (
        // very large charts: cells are painted on a canvas layer instead of thousands of SVG nodes
        <foreignObject x={0} y={0} width={W} height={H} pointerEvents="none">
          <canvas ref={canvasRef} style={{ display: "block", width: "100%", height: "100%", background: "#fff" }} />
        </foreignObject>
      )}
      <g dangerouslySetInnerHTML={{ __html: markup }} />
    </g>
  );
});

// ---------------- small UI bits ----------------

function Sep() {
  return <span aria-hidden className="mx-x1 h-6 w-px bg-stroke-neutral-muted" />;
}

function Floating({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cx("rounded-r4 border border-stroke-neutral-muted bg-bg-layer-default shadow-s2", className)}>{children}</div>;
}

function useWide() {
  const [wide, setWide] = useState(true);
  useEffect(() => {
    const m = window.matchMedia("(min-width: 1024px)");
    const on = () => setWide(m.matches);
    on();
    m.addEventListener("change", on);
    return () => m.removeEventListener("change", on);
  }, []);
  return wide;
}

// ---------------- editor ----------------

export default function KnitEditor({ work, data }: { work: Work; data: KnitData }) {
  const initial = useMemo(() => normalize(data), [data]);
  const h = useHistory<KDoc>(initial);
  const doc = h.state;
  const toast = useToast();
  const wide = useWide();

  const [view, setView] = useState<View>(initial.view);
  const viewRef = useRef(view);
  viewRef.current = view;
  const [activeId, setActiveId] = useState<string | null>(initial.activeGridId ?? initial.grids[0]?.id ?? null);
  const [mode, setMode] = useState<Mode>("select");
  const [pick, setPick] = useState<string | null>(null);
  const [stamp, setStamp] = useState<Stamp | null>(null);
  const [tab, setTab] = useState<LeftTab>("symbols");
  const [sel, setSel] = useState<Sel | null>(null);
  const [hover, setHover] = useState<{ gridId: string; c: number; r: number } | null>(null);
  const [brushColor, setBrushColor] = useState<string | null>(initial.colors[0] ?? "#24365c");
  const [brushTool, setBrushTool] = useState<"paint" | "eyedropper" | "lasso">("paint");
  const [space, setSpace] = useState(false);
  const [preview, setPreview] = useState<{ create?: { x: number; y: number; w: number; h: number; cols: number; rows: number }; lasso?: Pt[]; resize?: string } | null>(null);
  const [gridPop, setGridPop] = useState({ cols: 30, rows: 24 });
  const [mine, setMine] = useState<MyPattern[]>([]);
  const [saveMineOpen, setSaveMineOpen] = useState<Block | null>(null);
  const [mineName, setMineName] = useState("");
  const [ctx, setCtx] = useState<{ x: number; y: number } | null>(null);
  const [leftOpen, setLeftOpen] = useState(false);
  const [rightOpen, setRightOpen] = useState(false);
  const [size, setSize] = useState({ w: 800, h: 600 });

  const wrapRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const drag = useRef<Drag | null>(null);
  const clip = useRef<Block | null>(null);

  const geo = useMemo(() => geoOf(doc.gauge), [doc.gauge]);
  const geoRef = useRef(geo);
  geoRef.current = geo;
  const active = doc.grids.find((g) => g.id === activeId) ?? null;
  const visibleGrids = doc.grids.filter((g) => g.visible);

  useEffect(() => setMine(readMine()), []);

  // ---------- persistence ----------
  const saveData = useMemo<KnitData>(() => ({ ...doc, activeGridId: activeId, view }), [doc, activeId, view]);
  const status = useAutosave(work.id, saveData, () => {
    const s = buildThumb(h.get(), geoOf(h.get().gauge));
    return s ? svgThumbnail(s) : undefined;
  });

  // ---------- view helpers ----------
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setSize({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    setSize({ w: el.clientWidth, h: el.clientHeight });
    return () => ro.disconnect();
  }, []);

  const fit = useCallback(
    (grids?: KGrid[]) => {
      const el = wrapRef.current;
      const b = gridBounds((grids ?? h.get().grids).filter((g) => g.visible), geoRef.current);
      if (!el || !b) return;
      const W = el.clientWidth;
      const H = el.clientHeight;
      const pad = 72;
      const zoom = clamp(Math.min((W - pad * 2) / (b.x1 - b.x0 + 60), (H - pad * 2 - 40) / (b.y1 - b.y0 + 50)), 0.1, 3);
      setView({ zoom, x: W / 2 - ((b.x0 + b.x1) / 2) * zoom, y: (H - 40) / 2 - ((b.y0 + b.y1) / 2) * zoom });
    },
    [h],
  );

  // first open: frame existing grids when the saved view is the default
  const framed = useRef(false);
  useEffect(() => {
    if (framed.current) return;
    framed.current = true;
    const v = initial.view;
    if (initial.grids.length && v.x === 0 && v.y === 0 && v.zoom === 1) requestAnimationFrame(() => fit(initial.grids));
  }, [fit, initial]);

  const zoomAt = useCallback((factor: number, sx?: number, sy?: number) => {
    const el = wrapRef.current;
    if (!el) return;
    const v = viewRef.current;
    const px = sx ?? el.clientWidth / 2;
    const py = sy ?? el.clientHeight / 2;
    const zoom = clamp(v.zoom * factor, 0.1, 8);
    const wx = (px - v.x) / v.zoom;
    const wy = (py - v.y) / v.zoom;
    setView({ zoom, x: px - wx * zoom, y: py - wy * zoom });
  }, []);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const r = el.getBoundingClientRect();
      if (e.ctrlKey || e.metaKey) {
        zoomAt(Math.exp(-e.deltaY * (e.deltaMode === 1 ? 0.05 : 0.0025) * (e.ctrlKey && !e.metaKey && Math.abs(e.deltaY) < 50 ? 4 : 1)), e.clientX - r.left, e.clientY - r.top);
      } else {
        const k = e.deltaMode === 1 ? 16 : 1;
        const dx = (e.shiftKey && !e.deltaX ? e.deltaY : e.deltaX) * k;
        const dy = (e.shiftKey && !e.deltaX ? 0 : e.deltaY) * k;
        setView((v) => ({ ...v, x: v.x - dx, y: v.y - dy }));
      }
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [zoomAt]);

  const toWorld = (e: { clientX: number; clientY: number }): Pt => {
    const r = svgRef.current!.getBoundingClientRect();
    const v = viewRef.current;
    return { x: (e.clientX - r.left - v.x) / v.zoom, y: (e.clientY - r.top - v.y) / v.zoom };
  };
  const cellOf = (g: KGrid, p: Pt): Cell => ({ c: Math.floor((p.x - g.x) / geo.cw), r: Math.floor((p.y - g.y) / geo.ch) });
  const inGrid = (g: KGrid, c: Cell) => c.c >= 0 && c.r >= 0 && c.c < g.cols && c.r < g.rows;
  const clampCell = (g: KGrid, c: Cell): Cell => ({ c: clamp(c.c, 0, g.cols - 1), r: clamp(c.r, 0, g.rows - 1) });
  const hitGrid = (p: Pt) => {
    const gs = h.get().grids;
    for (let i = gs.length - 1; i >= 0; i--) {
      const g = gs[i];
      if (!g.visible) continue;
      const c = cellOf(g, p);
      if (inGrid(g, c)) return { g, ...c };
    }
    return null;
  };

  // ---------- doc edits ----------
  const mapGrid = (d: KDoc, id: string, fn: (g: KGrid) => KGrid | null): KDoc => {
    let changed = false;
    const grids = d.grids.map((g) => {
      if (g.id !== id) return g;
      const n = fn(g);
      if (!n || n === g) return g;
      changed = true;
      return n;
    });
    return changed ? { ...d, grids } : d;
  };
  const editGrid = (id: string, fn: (g: KGrid) => KGrid | null) => h.set((d) => mapGrid(d, id, fn));
  /** applies a drag step: first change records the undo point, the rest merge into it */
  const commit = (next: KDoc, d: { cp: boolean }) => {
    if (next === h.get()) return;
    if (!d.cp) {
      h.checkpoint();
      d.cp = true;
    }
    h.set(next, { merge: true });
  };

  const addGrid = (cols: number, rows: number, at?: Pt, block?: Block, name?: string) => {
    let x: number;
    let y: number;
    if (at) {
      x = at.x;
      y = at.y;
    } else {
      const b = gridBounds(h.get().grids, geo);
      if (b) {
        x = b.x1 + geo.cw * 4;
        y = b.y0;
      } else {
        const v = viewRef.current;
        x = (size.w / 2 - v.x) / v.zoom - (cols * geo.cw) / 2;
        y = (size.h / 2 - 30 - v.y) / v.zoom - (rows * geo.ch) / 2;
      }
    }
    let g = newGrid(name ?? nextGridName(h.get().grids), x, y, cols, rows);
    if (block) g = tileBlock(g, block, { c0: 0, r0: 0, c1: cols - 1, r1: rows - 1 }, { c: cols % block.cols ? cols - block.cols * Math.ceil(cols / block.cols) : 0, r: 0 });
    h.set((d) => ({ ...d, grids: [...d.grids, g] }));
    setActiveId(g.id);
    setSel(null);
    if (!at) {
      // bring a new grid into view
      const el = wrapRef.current;
      if (el) {
        const v = viewRef.current;
        const sx = g.x * v.zoom + v.x;
        const ex = (g.x + cols * geo.cw) * v.zoom + v.x;
        if (sx < 0 || ex > el.clientWidth) requestAnimationFrame(() => fit([...h.get().grids]));
      }
    }
    return g;
  };

  // ---------- selection ops ----------
  const selGrid = sel ? doc.grids.find((g) => g.id === sel.gridId) ?? null : null;

  const transformSel = (fn: (b: Block) => Block) => {
    if (!sel || !selGrid) return;
    const block = fn(readBlock(selGrid, sel));
    const next = writeBlock(clearRect(selGrid, sel), block, sel.c0, sel.r0);
    editGrid(selGrid.id, () => next);
    const r = clipRect({ c0: sel.c0, r0: sel.r0, c1: sel.c0 + block.cols - 1, r1: sel.r0 + block.rows - 1 }, selGrid);
    if (r) setSel({ ...r, gridId: selGrid.id });
  };
  const flipH = () => transformSel(flipBlockH);
  const flipV = () => transformSel(flipBlockV);
  const rotate = () => transformSel(rotateBlockCW);
  const clearSel = () => {
    if (!sel || !selGrid) return;
    editGrid(selGrid.id, (g) => clearRect(g, sel));
  };
  const copySel = () => {
    if (!sel || !selGrid) return false;
    const b = readBlock(selGrid, sel);
    clip.current = b;
    try {
      localStorage.setItem(CLIP_KEY, JSON.stringify(b));
    } catch {
      /* ignore */
    }
    return true;
  };
  const paste = () => {
    let b = clip.current;
    if (!b) {
      try {
        b = JSON.parse(localStorage.getItem(CLIP_KEY) ?? "null");
      } catch {
        b = null;
      }
    }
    const g = selGrid ?? active;
    if (!b || !g) {
      if (!g) toast("격자를 먼저 만들어 주세요. 격자 도구(K)로 드래그하면 만들 수 있어요");
      return;
    }
    const at = sel && sel.gridId === g.id ? { c: sel.c0, r: sel.r0 } : hover && hover.gridId === g.id ? hover : { c: 0, r: 0 };
    editGrid(g.id, (gg) => writeBlock(gg, b!, at.c, at.r));
    const r = clipRect({ c0: at.c, r0: at.r, c1: at.c + b.cols - 1, r1: at.r + b.rows - 1 }, g);
    if (r) setSel({ ...r, gridId: g.id });
    setMode("select");
  };
  const nudge = (dc: number, dr: number) => {
    if (!sel || !selGrid) return;
    const block = readBlock(selGrid, sel);
    const next = writeBlock(clearRect(selGrid, sel), block, sel.c0 + dc, sel.r0 + dr);
    editGrid(selGrid.id, () => next);
    const r = clipRect({ c0: sel.c0 + dc, r0: sel.r0 + dr, c1: sel.c1 + dc, r1: sel.r1 + dr }, selGrid);
    setSel(r ? { ...r, gridId: selGrid.id } : null);
  };
  const extend = (dc: number, dr: number) => {
    if (!sel || !selGrid) return;
    const r = {
      c0: dc < 0 ? Math.max(0, sel.c0 + dc) : sel.c0,
      c1: dc > 0 ? Math.min(selGrid.cols - 1, sel.c1 + dc) : sel.c1,
      r0: dr < 0 ? Math.max(0, sel.r0 + dr) : sel.r0,
      r1: dr > 0 ? Math.min(selGrid.rows - 1, sel.r1 + dr) : sel.r1,
    };
    setSel({ ...r, gridId: selGrid.id });
  };
  const selectAll = () => {
    const g = active ?? doc.grids[0];
    if (!g) return;
    setActiveId(g.id);
    setSel({ gridId: g.id, c0: 0, r0: 0, c1: g.cols - 1, r1: g.rows - 1 });
    setMode("select");
  };

  const openSaveMine = () => {
    const g = selGrid ?? active;
    if (!g) {
      toast("격자 또는 칸을 선택한 뒤 다시 눌러 주세요");
      return;
    }
    const r = sel && sel.gridId === g.id ? sel : { c0: 0, r0: 0, c1: g.cols - 1, r1: g.rows - 1 };
    setMineName(`무늬 ${mine.length + 1}`);
    setSaveMineOpen(readBlock(g, r));
  };
  const saveMine = () => {
    if (!saveMineOpen) return;
    const name = mineName.trim().slice(0, 40) || `무늬 ${mine.length + 1}`;
    let list = [{ id: uid(), name, block: saveMineOpen, createdAt: Date.now() }, ...readMine()];
    if (list.length > MY_MAX) {
      list = list.slice(0, MY_MAX);
      toast(`최대 ${MY_MAX}개만 남겨 두고 오래된 무늬를 정리했어요`);
    }
    try {
      localStorage.setItem(MY_KEY, JSON.stringify(list));
    } catch {
      toast("저장 공간이 부족해 무늬를 저장하지 못했어요");
      return;
    }
    setMine(list);
    setSaveMineOpen(null);
    setTab("mine");
    toast(`「${name}」을(를) 내 무늬에 등록했어요`);
  };
  const deleteMine = (id: string) => {
    const list = readMine().filter((m) => m.id !== id);
    try {
      localStorage.setItem(MY_KEY, JSON.stringify(list));
    } catch {
      /* ignore */
    }
    setMine(list);
    if (stamp?.id === id) setStamp(null);
  };

  // ---------- library ----------
  const chooseStamp = (s: Stamp | null) => {
    setStamp(s);
    if (s) {
      setMode("edit");
      setSel(null);
    }
  };
  const fillGrid = () => {
    if (!stamp || !active) return;
    // align the repeat to the bottom-right corner, where knitting starts
    const origin = { c: active.cols - stamp.block.cols * Math.ceil(active.cols / stamp.block.cols), r: active.rows - stamp.block.rows * Math.ceil(active.rows / stamp.block.rows) };
    editGrid(active.id, (g) => tileBlock(g, stamp.block, { c0: 0, r0: 0, c1: g.cols - 1, r1: g.rows - 1 }, origin, true));
    toast(`${stamp.name} 무늬를 채웠어요`);
  };
  const newGridFromStamp = () => {
    if (!stamp) return;
    const b = stamp.block;
    const cols = b.cols * Math.max(1, Math.round(24 / b.cols));
    const rows = b.rows * Math.max(1, Math.round(20 / b.rows));
    addGrid(cols, rows, undefined, b, stamp.name);
    toast(`${stamp.name} 무늬로 새 격자를 만들었어요`);
  };

  // ---------- grid ops ----------
  const deleteGrid = (id: string) => {
    h.set((d) => ({ ...d, grids: d.grids.filter((g) => g.id !== id) }));
    if (sel?.gridId === id) setSel(null);
    if (activeId === id) {
      const rest = doc.grids.filter((g) => g.id !== id);
      setActiveId(rest[rest.length - 1]?.id ?? null);
    }
  };
  const setNumbering = (n: Numbering) => active && editGrid(active.id, (g) => ({ ...g, numbering: n }));

  const switchMode = (m: Mode) => {
    if (m === "gridEdit" && !active) {
      toast("격자를 먼저 만들어 주세요. 격자 도구(K)로 드래그하면 만들 수 있어요");
      return;
    }
    if (m === "edit" && !doc.grids.length) toast("격자를 먼저 만들어 주세요. 격자 도구(K)로 드래그하면 만들 수 있어요");
    if (m !== "edit") setStamp(null);
    if (m === "brush") setBrushTool((t) => (t === "eyedropper" ? "paint" : t));
    setMode(m);
  };

  // ---------- pointer ----------
  const onPointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    if (e.button === 2) return;
    setCtx(null);
    const p = toWorld(e);
    const target = e.target as Element;
    (e.currentTarget as SVGSVGElement).setPointerCapture(e.pointerId);
    if (e.button === 1 || mode === "pan" || space) {
      const v = viewRef.current;
      drag.current = { kind: "pan", sx: e.clientX, sy: e.clientY, vx: v.x, vy: v.y };
      return;
    }
    const hit = hitGrid(p);
    const labelId = target.closest("[data-grid-label]")?.getAttribute("data-grid-label");

    if (mode === "grid") {
      drag.current = { kind: "create", start: p, cur: p, moved: false };
      return;
    }

    if (mode === "select") {
      const handle = target.closest("[data-handle]")?.getAttribute("data-handle");
      if (handle && sel && selGrid) {
        const [hx, hy] = handle.split(",").map(Number);
        drag.current = { kind: "fill", snap: selGrid, gridId: selGrid.id, rect: { ...sel }, block: readBlock(selGrid, sel), hx, hy, key: "", cp: false };
        return;
      }
      if (labelId) {
        const g = doc.grids.find((x) => x.id === labelId)!;
        setActiveId(g.id);
        drag.current = { kind: "gridMove", gridId: g.id, gx: g.x, gy: g.y, start: p, cp: false };
        return;
      }
      if (hit && sel && sel.gridId === hit.g.id && hit.c >= sel.c0 && hit.c <= sel.c1 && hit.r >= sel.r0 && hit.r <= sel.r1) {
        const copy = isMod(e) || e.altKey;
        drag.current = {
          kind: "move",
          snap: h.get(),
          srcId: hit.g.id,
          rect: { ...sel },
          block: readBlock(hit.g, sel),
          grab: { c: hit.c - sel.c0, r: hit.r - sel.r0 },
          copy,
          key: `${hit.g.id}:${sel.c0},${sel.r0}`,
          cp: false,
        };
        return;
      }
      if (hit) {
        setActiveId(hit.g.id);
        const anchor = e.shiftKey && sel && sel.gridId === hit.g.id ? { c: sel.c0, r: sel.r0 } : { c: hit.c, r: hit.r };
        setSel({ gridId: hit.g.id, ...normRect(anchor, hit) });
        drag.current = { kind: "range", gridId: hit.g.id, anchor };
        return;
      }
      setSel(null);
      return;
    }

    if (mode === "edit") {
      if (!doc.grids.length) {
        toast("격자를 먼저 만들어 주세요. 격자 도구(K)로 드래그하면 만들 수 있어요");
        return;
      }
      if (!hit) return;
      setActiveId(hit.g.id);
      if (stamp) {
        const d: Drag = { kind: "stamp", gridId: hit.g.id, origin: { c: hit.c, r: hit.r }, done: new Set(), last: { c: hit.c, r: hit.r }, cp: false };
        drag.current = d;
        stampAt(d, [{ c: hit.c, r: hit.r }]);
        return;
      }
      if (!pick) {
        toast("왼쪽에서 기호를 골라주세요");
        return;
      }
      const ex = symbolAt(hit.g, hit.r, hit.c);
      const d: Drag = {
        kind: "edit",
        gridId: hit.g.id,
        last: { c: hit.c, r: hit.r },
        start: { c: hit.c, r: hit.r },
        erase: !!ex && ex.id === pick,
        sym: pick,
        cp: false,
        warned: false,
      };
      drag.current = d;
      editAt(d, [{ c: hit.c, r: hit.r }]);
      return;
    }

    if (mode === "brush") {
      if (brushTool === "lasso") {
        drag.current = { kind: "lasso", points: [p] };
        setPreview({ lasso: [p] });
        return;
      }
      if (!hit) return;
      setActiveId(hit.g.id);
      if (brushTool === "eyedropper") {
        const c = hit.g.cells[hit.r * hit.g.cols + hit.c]?.color;
        if (c) {
          setBrushColor(c);
          setBrushTool("paint");
        } else toast("이 칸에는 색이 없어요");
        return;
      }
      const d: Drag = { kind: "paint", gridId: hit.g.id, last: { c: hit.c, r: hit.r }, color: brushColor, cp: false };
      drag.current = d;
      commit(mapGrid(h.get(), hit.g.id, (g) => paintCells(g, [{ c: hit.c, r: hit.r }], brushColor)), d);
      return;
    }

    if (mode === "gridEdit") {
      const edge = target.closest("[data-edge]")?.getAttribute("data-edge") as "l" | "r" | "t" | "b" | null;
      if (edge && active) {
        drag.current = { kind: "resize", gridId: active.id, snap: active, edge, start: p, key: "", cp: false };
        return;
      }
      if (hit) {
        if (hit.g.id !== activeId) {
          setActiveId(hit.g.id);
          return;
        }
        const d: Drag = { kind: "carve", gridId: hit.g.id, last: { c: hit.c, r: hit.r }, remove: e.altKey, cp: false };
        drag.current = d;
        carveAt(d, [{ c: hit.c, r: hit.r }]);
      }
    }
  };

  const editAt = (d: Extract<Drag, { kind: "edit" }>, cells: Cell[]) => {
    const w = knitSymbol(d.sym)?.width ?? 1;
    let noRoom = false;
    const next = mapGrid(h.get(), d.gridId, (g0) => {
      let g = g0;
      for (const c of cells) {
        if (!inGrid(g, c)) continue;
        if (d.erase) {
          g = eraseSymbol(g, c.r, c.c);
          continue;
        }
        // wide symbols tile from the first cell instead of overlapping each other
        if (w > 1 && (c.c - d.start.c) % w !== 0) continue;
        const cur = symbolAt(g, c.r, c.c);
        if (cur && cur.id === d.sym && cur.c === c.c) continue;
        const n = placeSymbol(g, c.r, c.c, d.sym);
        if (!n) noRoom = true;
        else g = n;
      }
      return g;
    });
    if (noRoom && !d.warned) {
      d.warned = true;
      toast("넓은 기호가 들어갈 칸이 모자라요. 더 왼쪽에 놓거나 격자를 넓혀 주세요.");
    }
    commit(next, d);
  };

  const stampAt = (d: Extract<Drag, { kind: "stamp" }>, cells: Cell[]) => {
    if (!stamp) return;
    const b = stamp.block;
    const next = mapGrid(h.get(), d.gridId, (g0) => {
      let g = g0;
      for (const c of cells) {
        const tc = d.origin.c + Math.floor((c.c - d.origin.c) / b.cols) * b.cols;
        const tr = d.origin.r + Math.floor((c.r - d.origin.r) / b.rows) * b.rows;
        const key = `${tc},${tr}`;
        if (d.done.has(key)) continue;
        d.done.add(key);
        g = writeBlock(g, b, tc, tr, true);
      }
      return g;
    });
    commit(next, d);
  };

  const carveAt = (d: Extract<Drag, { kind: "carve" }>, cells: Cell[]) => {
    const next = mapGrid(h.get(), d.gridId, (g0) => {
      let g = g0;
      for (const c of cells) {
        if (!inGrid(g, c)) continue;
        const cur = g.cells[c.r * g.cols + c.c];
        if (d.remove && cur?.symbol !== "ns") g = placeSymbol(g, c.r, c.c, "ns") ?? g;
        if (!d.remove && cur?.symbol === "ns") g = eraseSymbol(g, c.r, c.c);
      }
      return g;
    });
    commit(next, d);
  };

  const onPointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const p = toWorld(e);
    const d = drag.current;
    if (!d) {
      const hit = hitGrid(p);
      const nh = hit ? { gridId: hit.g.id, c: hit.c, r: hit.r } : null;
      if (nh?.gridId !== hover?.gridId || nh?.c !== hover?.c || nh?.r !== hover?.r) setHover(nh);
      return;
    }
    const D = h.get();
    switch (d.kind) {
      case "pan":
        setView((v) => ({ ...v, x: d.vx + e.clientX - d.sx, y: d.vy + e.clientY - d.sy }));
        return;
      case "create": {
        d.cur = p;
        const dx = p.x - d.start.x;
        const dy = p.y - d.start.y;
        if (!d.moved && Math.hypot(dx, dy) * viewRef.current.zoom < 4) return;
        d.moved = true;
        let cols = Math.max(1, Math.round(Math.abs(dx) / geo.cw));
        let rows = Math.max(1, Math.round(Math.abs(dy) / geo.ch));
        if (e.shiftKey) {
          const s = Math.max(Math.abs(dx), Math.abs(dy));
          cols = Math.max(1, Math.round(s / geo.cw));
          rows = Math.max(1, Math.round(s / geo.ch));
        }
        const w = cols * geo.cw;
        const hh = rows * geo.ch;
        d.dims = { x: dx < 0 ? d.start.x - w : d.start.x, y: dy < 0 ? d.start.y - hh : d.start.y, w, h: hh, cols, rows };
        setPreview({ create: d.dims });
        return;
      }
      case "range": {
        const g = D.grids.find((x) => x.id === d.gridId);
        if (!g) return;
        const c = clampCell(g, cellOf(g, p));
        setSel({ gridId: g.id, ...normRect(d.anchor, c) });
        return;
      }
      case "move": {
        const over = hitGrid(p);
        const tg = over?.g ?? d.snap.grids.find((x) => x.id === d.srcId) ?? null;
        if (!tg) return;
        const pc = cellOf(tg, p);
        const tl = { c: pc.c - d.grab.c, r: pc.r - d.grab.r };
        const key = `${tg.id}:${tl.c},${tl.r}`;
        if (key === d.key) return;
        d.key = key;
        let next = d.copy ? d.snap : mapGrid(d.snap, d.srcId, (g) => clearRect(g, d.rect));
        next = mapGrid(next, tg.id, (g) => writeBlock(g, d.block, tl.c, tl.r));
        commit(next, d);
        const r = clipRect({ c0: tl.c, r0: tl.r, c1: tl.c + d.block.cols - 1, r1: tl.r + d.block.rows - 1 }, tg);
        setSel(r ? { ...r, gridId: tg.id } : null);
        setActiveId(tg.id);
        return;
      }
      case "fill": {
        const g = d.snap;
        const pc = clampCell(g, cellOf(g, p));
        const region: Rect = {
          c0: d.hx < 0 ? Math.min(d.rect.c0, pc.c) : d.rect.c0,
          c1: d.hx > 0 ? Math.max(d.rect.c1, pc.c) : d.rect.c1,
          r0: d.hy < 0 ? Math.min(d.rect.r0, pc.r) : d.rect.r0,
          r1: d.hy > 0 ? Math.max(d.rect.r1, pc.r) : d.rect.r1,
        };
        const key = `${region.c0},${region.r0},${region.c1},${region.r1}`;
        if (key === d.key) return;
        d.key = key;
        commit(
          mapGrid(D, d.gridId, () => tileBlock(g, d.block, region, { c: d.rect.c0, r: d.rect.r0 })),
          d,
        );
        setSel({ ...region, gridId: d.gridId });
        return;
      }
      case "gridMove": {
        const nx = Math.round(d.gx + p.x - d.start.x);
        const ny = Math.round(d.gy + p.y - d.start.y);
        commit(
          mapGrid(D, d.gridId, (g) => (g.x === nx && g.y === ny ? g : { ...g, x: nx, y: ny })),
          d,
        );
        return;
      }
      case "resize": {
        const g = d.snap;
        const dx = p.x - d.start.x;
        const dy = p.y - d.start.y;
        const delta = { left: 0, right: 0, top: 0, bottom: 0 };
        if (d.edge === "r") delta.right = Math.max(1 - g.cols, Math.round(dx / geo.cw));
        if (d.edge === "l") delta.left = Math.max(1 - g.cols, Math.round(-dx / geo.cw));
        if (d.edge === "b") delta.bottom = Math.max(1 - g.rows, Math.round(dy / geo.ch));
        if (d.edge === "t") delta.top = Math.max(1 - g.rows, Math.round(-dy / geo.ch));
        const key = `${delta.left},${delta.right},${delta.top},${delta.bottom}`;
        if (key === d.key) return;
        d.key = key;
        const ng = key === "0,0,0,0" ? g : resizeGrid(g, delta, geo);
        commit(
          mapGrid(D, d.gridId, () => ng),
          d,
        );
        setPreview({ resize: `${ng.cols}코 × ${ng.rows}단` });
        if (sel?.gridId === g.id) setSel(null);
        return;
      }
      case "lasso": {
        const last = d.points[d.points.length - 1];
        if (Math.hypot(p.x - last.x, p.y - last.y) * viewRef.current.zoom < 3) return;
        d.points.push(p);
        setPreview({ lasso: [...d.points] });
        return;
      }
      case "edit":
      case "stamp":
      case "paint":
      case "carve": {
        const g = D.grids.find((x) => x.id === d.gridId);
        if (!g) return;
        const c = cellOf(g, p);
        if (c.c === d.last.c && c.r === d.last.r) return;
        const cells = cellLine(d.last, c).slice(1);
        d.last = c;
        if (d.kind === "edit") editAt(d, cells);
        else if (d.kind === "stamp") stampAt(d, cells);
        else if (d.kind === "carve") carveAt(d, cells);
        else
          commit(
            mapGrid(D, d.gridId, (gg) => paintCells(gg, cells, d.color)),
            d,
          );
        setHover(inGrid(g, c) ? { gridId: g.id, ...c } : null);
        return;
      }
    }
  };

  const onPointerUp = () => {
    const d = drag.current;
    drag.current = null;
    if (!d) return;
    if (d.kind === "create") {
      setPreview(null);
      const pc = d.dims;
      if (d.moved && pc) {
        addGrid(pc.cols, pc.rows, { x: pc.x, y: pc.y });
        setMode("select");
      }
      return;
    }
    if (d.kind === "lasso") {
      setPreview(null);
      if (d.points.length < 3) return;
      const poly = d.points;
      const inside = (x: number, y: number) => {
        let ins = false;
        for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
          const a = poly[i];
          const b = poly[j];
          if (a.y > y !== b.y > y && x < ((b.x - a.x) * (y - a.y)) / (b.y - a.y) + a.x) ins = !ins;
        }
        return ins;
      };
      let count = 0;
      const next: KDoc = {
        ...h.get(),
        grids: h.get().grids.map((g) => {
          if (!g.visible) return g;
          const list: Cell[] = [];
          for (let r = 0; r < g.rows; r++)
            for (let c = 0; c < g.cols; c++) if (inside(g.x + (c + 0.5) * geo.cw, g.y + (r + 0.5) * geo.ch)) list.push({ c, r });
          count += list.length;
          return list.length ? paintCells(g, list, brushColor) : g;
        }),
      };
      if (!count) toast("올가미 안에 칠할 칸이 없어요");
      else h.set(next);
      return;
    }
    if (d.kind === "resize") setPreview(null);
  };

  // ---------- keyboard ----------
  useHotkeys(
    (e) => {
      const k = e.key;
      const lower = k.toLowerCase();
      if (isMod(e)) {
        if (lower === "z") {
          e.preventDefault();
          if (e.shiftKey) h.redo();
          else h.undo();
        } else if (lower === "y") {
          e.preventDefault();
          h.redo();
        } else if (lower === "c") {
          if (copySel()) e.preventDefault();
        } else if (lower === "x") {
          if (copySel()) {
            e.preventDefault();
            clearSel();
          }
        } else if (lower === "v") {
          e.preventDefault();
          paste();
        } else if (lower === "a") {
          e.preventDefault();
          selectAll();
        } else if (k === "0") {
          e.preventDefault();
          zoomAt(1 / viewRef.current.zoom);
        } else if (k === "=" || k === "+") {
          e.preventDefault();
          zoomAt(1.25);
        } else if (k === "-") {
          e.preventDefault();
          zoomAt(0.8);
        }
        return;
      }
      if (k === " ") {
        e.preventDefault();
        if (!e.repeat) setSpace(true);
        return;
      }
      if (k === "?") {
        e.preventDefault();
        openShortcutHelp();
        return;
      }
      if (k === "Escape") {
        if (stamp) setStamp(null);
        else if (sel) setSel(null);
        else if (mode !== "select") setMode("select");
        setCtx(null);
        return;
      }
      if (k === "Delete" || k === "Backspace") {
        if (sel) {
          e.preventDefault();
          clearSel();
        }
        return;
      }
      if (k.startsWith("Arrow") && sel) {
        e.preventDefault();
        const dc = k === "ArrowLeft" ? -1 : k === "ArrowRight" ? 1 : 0;
        const dr = k === "ArrowUp" ? -1 : k === "ArrowDown" ? 1 : 0;
        if (e.shiftKey) extend(dc, dr);
        else nudge(dc, dr);
        return;
      }
      if (e.shiftKey && lower === "h") return flipH();
      if (e.shiftKey && lower === "v") return flipV();
      if (k === "!" || (e.shiftKey && k === "1")) return fit();
      if (e.altKey) return;
      if (lower === "v") switchMode("select");
      else if (lower === "e") switchMode("edit");
      else if (lower === "h") switchMode("pan");
      else if (lower === "k") switchMode("grid");
      else if (lower === "g") switchMode(mode === "gridEdit" ? "select" : "gridEdit");
      else if (lower === "b") switchMode(mode === "brush" ? "select" : "brush");
      else if (lower === "r" && sel) rotate();
    },
    [h, sel, selGrid, active, mode, stamp, hover, doc, mine],
  );
  useEffect(() => {
    const up = (e: KeyboardEvent) => e.key === " " && setSpace(false);
    const blur = () => setSpace(false);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", blur);
    return () => {
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", blur);
    };
  }, []);

  // ---------- export ----------
  const onExport = async (format: "png" | "jpg" | "svg") => {
    const svg = buildSvg(h.get(), geo, { numbers: true, labels: true, legend: true, background: "#ffffff" });
    if (!svg) return false;
    await exportSvg(svg, format, safeName(work.title));
    return true;
  };

  // ---------- render ----------
  const defs = useMemo(() => symbolDefs(geo.cw, geo.ch), [geo]);
  const z = view.zoom;
  let dotStep = 20 * z;
  while (dotStep < 10) dotStep *= 2;
  const cursor =
    mode === "pan" || space ? (drag.current?.kind === "pan" ? "grabbing" : "grab") : mode === "select" ? "default" : mode === "brush" && brushTool === "eyedropper" ? "copy" : "crosshair";

  const hoverGrid = hover ? doc.grids.find((g) => g.id === hover.gridId) ?? null : null;
  const pickW = knitSymbol(pick ?? undefined)?.width ?? 1;

  let hoverOverlay: ReactNode = null;
  if (hover && hoverGrid && !space && (!drag.current || drag.current.kind !== "pan")) {
    const x = hoverGrid.x + hover.c * geo.cw;
    const y = hoverGrid.y + hover.r * geo.ch;
    if (mode === "edit" && stamp) {
      hoverOverlay = (
        <rect x={x} y={y} width={stamp.block.cols * geo.cw} height={stamp.block.rows * geo.ch} fill="var(--seed-color-palette-lime-500)" fillOpacity={0.12} stroke="var(--seed-color-palette-lime-700)" strokeWidth={1.5 / z} strokeDasharray={`${4 / z} ${3 / z}`} />
      );
    } else if (mode === "edit" && pick) {
      const fits = hover.c + pickW <= hoverGrid.cols;
      hoverOverlay = (
        <g pointerEvents="none">
          <rect x={x} y={y} width={pickW * geo.cw} height={geo.ch} fill={fits ? "var(--seed-color-palette-lime-500)" : "#e5484d"} fillOpacity={0.14} stroke={fits ? "var(--seed-color-palette-lime-700)" : "#e5484d"} strokeWidth={1.5 / z} />
          <use href={`#ks-${pick}`} x={x} y={y} color="#222" opacity={0.45} />
        </g>
      );
    } else if (mode === "brush" && brushTool === "paint") {
      hoverOverlay = <rect x={x} y={y} width={geo.cw} height={geo.ch} fill={brushColor ?? "#fff"} fillOpacity={0.6} stroke="#222" strokeWidth={1 / z} />;
    } else if (mode === "brush" && brushTool === "eyedropper") {
      hoverOverlay = <rect x={x} y={y} width={geo.cw} height={geo.ch} fill="none" stroke="#222" strokeWidth={1.5 / z} />;
    } else if (mode === "gridEdit" && hoverGrid.id === activeId) {
      hoverOverlay = <rect x={x} y={y} width={geo.cw} height={geo.ch} fill="none" stroke="var(--seed-color-palette-lime-700)" strokeWidth={1.5 / z} />;
    }
  }

  let selOverlay: ReactNode = null;
  if (sel && selGrid && selGrid.visible) {
    const x = selGrid.x + sel.c0 * geo.cw;
    const y = selGrid.y + sel.r0 * geo.ch;
    const w = rectW(sel) * geo.cw;
    const hh = rectH(sel) * geo.ch;
    const hs = 9 / z;
    const handles: [number, number][] = [
      [-1, -1],
      [0, -1],
      [1, -1],
      [-1, 0],
      [1, 0],
      [-1, 1],
      [0, 1],
      [1, 1],
    ];
    const cursorFor = (hx: number, hy: number) => (hx === 0 ? "ns-resize" : hy === 0 ? "ew-resize" : hx === hy ? "nwse-resize" : "nesw-resize");
    selOverlay = (
      <g>
        <rect x={x} y={y} width={w} height={hh} fill="var(--seed-color-palette-lime-500)" fillOpacity={0.1} stroke="var(--seed-color-palette-lime-700)" strokeWidth={2 / z} pointerEvents="none" />
        {mode === "select" &&
          handles.map(([hx, hy]) => (
            <rect
              key={`${hx},${hy}`}
              data-handle={`${hx},${hy}`}
              x={x + ((hx + 1) / 2) * w - hs / 2}
              y={y + ((hy + 1) / 2) * hh - hs / 2}
              width={hs}
              height={hs}
              rx={2 / z}
              fill="#fff"
              stroke="var(--seed-color-palette-lime-700)"
              strokeWidth={1.5 / z}
              style={{ cursor: cursorFor(hx, hy) }}
            >
              <title>끌어서 이 방향으로 무늬 반복</title>
            </rect>
          ))}
      </g>
    );
  }

  let editOverlay: ReactNode = null;
  if (mode === "gridEdit" && active && active.visible) {
    const W = active.cols * geo.cw;
    const H = active.rows * geo.ch;
    const t = 10 / z;
    const bar = (edge: "l" | "r" | "t" | "b", x: number, y: number, w: number, hh: number, cur: string) => (
      <g key={edge} data-edge={edge} style={{ cursor: cur }}>
        <rect x={x} y={y} width={w} height={hh} fill="transparent" />
        <rect
          x={edge === "l" || edge === "r" ? x + w / 2 - 2 / z : x}
          y={edge === "t" || edge === "b" ? y + hh / 2 - 2 / z : y}
          width={edge === "l" || edge === "r" ? 4 / z : w}
          height={edge === "t" || edge === "b" ? 4 / z : hh}
          rx={2 / z}
          fill="var(--seed-color-palette-lime-600)"
          opacity={0.85}
        />
      </g>
    );
    editOverlay = (
      <g transform={`translate(${active.x} ${active.y})`}>
        <rect width={W} height={H} fill="none" stroke="var(--seed-color-palette-lime-600)" strokeWidth={1.5 / z} strokeDasharray={`${5 / z} ${4 / z}`} pointerEvents="none" />
        {bar("l", -t, 0, t, H, "ew-resize")}
        {bar("r", W, 0, t, H, "ew-resize")}
        {bar("t", 0, -t, W, t, "ns-resize")}
        {bar("b", 0, H, W, t, "ns-resize")}
      </g>
    );
  }

  const menuItems: MenuItem[] = [
    { label: "복사", shortcut: "⌘C", disabled: !sel, onSelect: () => copySel() },
    { label: "잘라내기", shortcut: "⌘X", disabled: !sel, onSelect: () => copySel() && clearSel() },
    { label: "붙여넣기", shortcut: "⌘V", onSelect: paste },
    "separator",
    { label: "좌우 뒤집기", shortcut: "⇧H", disabled: !sel, onSelect: flipH },
    { label: "상하 뒤집기", shortcut: "⇧V", disabled: !sel, onSelect: flipV },
    { label: "오른쪽 회전", shortcut: "R", disabled: !sel, onSelect: rotate },
    "separator",
    { label: "내 무늬로 등록", disabled: !active, onSelect: openSaveMine },
    { label: "삭제", shortcut: "Delete", danger: true, disabled: !sel, onSelect: clearSel },
  ];

  const tools: { id: Mode; label: string; key: string; icon: ReactNode; disabled?: boolean }[] = [
    { id: "select", label: "선택", key: "V", icon: <Pointer /> },
    { id: "edit", label: "편집", key: "E", icon: <Pencil /> },
    { id: "pan", label: "이동", key: "H", icon: <Hand /> },
    { id: "grid", label: "격자 만들기", key: "K", icon: <Grid /> },
    { id: "gridEdit", label: "격자 편집", key: "G", icon: <GridEdit />, disabled: !active },
    { id: "brush", label: "칸 색칠", key: "B", icon: <Brush /> },
  ];

  const leftPanel = (
    <LeftPanel
      tab={tab}
      setTab={setTab}
      geo={geo}
      pick={pick}
      onPick={(id) => {
        setPick(id);
        setStamp(null);
        setMode("edit");
        setSel(null);
        if (!wide) setLeftOpen(false);
      }}
      stamp={stamp}
      onStamp={chooseStamp}
      active={active}
      onFillGrid={fillGrid}
      onNewGridFromStamp={newGridFromStamp}
      mine={mine}
      onSaveMine={openSaveMine}
      onDeleteMine={deleteMine}
      className={wide ? "" : "absolute inset-y-0 left-0 z-30 shadow-s3"}
    />
  );
  const rightPanel = (
    <RightPanel
      doc={doc}
      activeId={activeId}
      sel={sel}
      onActivate={(id) => {
        setActiveId(id);
        if (sel && sel.gridId !== id) setSel(null);
      }}
      onAddGrid={() => addGrid(gridPop.cols, gridPop.rows)}
      onRename={(id, name) => editGrid(id, (g) => (g.name === name ? g : { ...g, name }))}
      onToggle={(id) => editGrid(id, (g) => ({ ...g, visible: !g.visible }))}
      onDelete={deleteGrid}
      onGauge={(gauge) => h.set((d) => ({ ...d, gauge: { sts: clamp(Math.round(gauge.sts) || 1, 4, 60), rows: clamp(Math.round(gauge.rows) || 1, 4, 80) } }))}
      onNumbering={setNumbering}
      onFlipH={flipH}
      onFlipV={flipV}
      onRotate={rotate}
      onClearSel={clearSel}
      onSaveMine={openSaveMine}
      className={wide ? "" : "absolute inset-y-0 right-0 z-30 shadow-s3"}
    />
  );

  return (
    <EditorShell
      workId={work.id}
      title={work.title}
      craftLabel={CRAFT_LABEL.knitting}
      status={status}
      canUndo={h.canUndo}
      canRedo={h.canRedo}
      onUndo={h.undo}
      onRedo={h.redo}
      onExport={onExport}
      shortcuts={SHORTCUTS}
    >
      <div className="absolute inset-0 flex">
        {(wide || leftOpen) && leftPanel}

        <div
          ref={wrapRef}
          className="relative min-w-0 flex-1 overflow-hidden"
          style={{
            backgroundColor: "#f3f3f1",
            backgroundImage: "radial-gradient(circle, rgba(0,0,0,0.13) 1px, transparent 1.2px)",
            backgroundSize: `${dotStep}px ${dotStep}px`,
            backgroundPosition: `${view.x}px ${view.y}px`,
          }}
          onContextMenu={(e) => {
            e.preventDefault();
            if (mode === "select") setCtx({ x: e.clientX, y: e.clientY });
          }}
        >
          <svg
            ref={svgRef}
            className="absolute inset-0 size-full touch-none"
            style={{ cursor }}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            onPointerLeave={() => !drag.current && setHover(null)}
            role="application"
            aria-label="대바늘 차트 캔버스"
          >
            <defs dangerouslySetInnerHTML={{ __html: defs }} />
            <g transform={`translate(${view.x} ${view.y}) scale(${z})`}>
              {visibleGrids.map((g) => (
                <GridLayer key={g.id} grid={g} geo={geo} />
              ))}
              {visibleGrids.map((g) => (
                <g key={`l-${g.id}`}>
                  {g.id === activeId && (
                    <rect
                      x={g.x - 3 / z}
                      y={g.y - 3 / z}
                      width={g.cols * geo.cw + 6 / z}
                      height={g.rows * geo.ch + 6 / z}
                      fill="none"
                      stroke="var(--seed-color-palette-lime-600)"
                      strokeWidth={1.5 / z}
                      rx={2 / z}
                      pointerEvents="none"
                    />
                  )}
                  <text
                    data-grid-label={g.id}
                    x={g.x}
                    y={g.y - 9 / z}
                    fontSize={12 / z}
                    fontWeight={600}
                    fill={g.id === activeId ? "var(--seed-color-palette-lime-800)" : "#555"}
                    style={{ cursor: mode === "select" ? "move" : undefined, userSelect: "none" }}
                  >
                    {g.name}
                    <tspan fontWeight={400} fill="#8a8a8a">{`  ${g.cols}코 × ${g.rows}단`}</tspan>
                  </text>
                </g>
              ))}
              {hoverOverlay}
              {selOverlay}
              {editOverlay}
              {preview?.create && (
                <g pointerEvents="none">
                  <rect
                    x={preview.create.x}
                    y={preview.create.y}
                    width={preview.create.w}
                    height={preview.create.h}
                    fill="#fff"
                    fillOpacity={0.7}
                    stroke="var(--seed-color-palette-lime-700)"
                    strokeWidth={1.5 / z}
                    strokeDasharray={`${5 / z} ${4 / z}`}
                  />
                </g>
              )}
              {preview?.lasso && (
                <polygon
                  points={preview.lasso.map((q) => `${q.x},${q.y}`).join(" ")}
                  fill={brushColor ?? "#888"}
                  fillOpacity={0.15}
                  stroke="#222"
                  strokeWidth={1.2 / z}
                  strokeDasharray={`${4 / z} ${3 / z}`}
                  pointerEvents="none"
                />
              )}
            </g>
          </svg>

          {/* live size label while dragging a new grid / resizing */}
          {preview?.create && (
            <div
              className="pointer-events-none absolute rounded-r1_5 bg-bg-neutral-inverted px-x2 py-x1 text-[0.75rem] font-semibold whitespace-nowrap text-fg-neutral-inverted tabular-nums"
              style={{ left: (preview.create.x + preview.create.w) * z + view.x + 8, top: (preview.create.y + preview.create.h) * z + view.y + 8 }}
            >
              {preview.create.cols}코 × {preview.create.rows}단
            </div>
          )}
          {preview?.resize && (
            <div className="pointer-events-none absolute top-4 left-1/2 -translate-x-1/2 rounded-r1_5 bg-bg-neutral-inverted px-x2_5 py-x1 text-[0.8125rem] font-semibold text-fg-neutral-inverted tabular-nums">
              {preview.resize}
            </div>
          )}

          {/* narrow screens: panel toggles */}
          {!wide && (
            <>
              <Button size="sm" className="absolute top-3 left-3 z-20 shadow-s1" onClick={() => setLeftOpen((v) => !v)}>
                기호
              </Button>
              <Button size="sm" className="absolute top-3 right-3 z-20 shadow-s1" onClick={() => setRightOpen((v) => !v)}>
                <Layers className="size-4" />
                레이어
              </Button>
            </>
          )}

          {/* mode hint */}
          {(stamp || (mode === "gridEdit" && active) || (mode === "brush" && brushTool !== "paint")) && (
            <div className="absolute top-3 left-1/2 z-10 flex max-w-[calc(100%-200px)] -translate-x-1/2 items-center gap-x2 rounded-full bg-bg-neutral-inverted py-x1 pr-x1 pl-x3 text-[0.8125rem] text-fg-neutral-inverted shadow-s2">
              <span className="truncate">
                {stamp
                  ? `${stamp.name} · 격자를 누르면 무늬가 한 번 찍히고, 끌면 이어서 찍혀요.`
                  : mode === "gridEdit"
                    ? "가장자리를 끌면 줄·열이 통째로 늘거나 줄어요. Alt(Option)를 누른 채 칸을 끌면 칸이 빠져요."
                    : brushTool === "eyedropper"
                      ? "칸을 클릭하면 그 색을 붓 색으로 가져와요"
                      : "영역을 그려 감싸면 안쪽 칸이 한 번에 칠해져요"}
              </span>
              <button
                type="button"
                aria-label="취소"
                className="inline-flex size-6 shrink-0 items-center justify-center rounded-full hover:bg-white/15"
                onClick={() => {
                  if (stamp) setStamp(null);
                  else if (mode === "gridEdit") setMode("select");
                  else setBrushTool("paint");
                }}
              >
                <X className="size-3.5" />
              </button>
            </div>
          )}

          {/* empty state */}
          {doc.grids.length === 0 && !preview?.create && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center pb-24">
              <div className="pointer-events-auto flex max-w-[320px] flex-col items-center gap-x3 rounded-r4 border border-stroke-neutral-muted bg-bg-layer-default px-x6 py-x6 text-center shadow-s1">
                <span className="flex size-11 items-center justify-center rounded-full bg-bg-brand-weak text-fg-brand">
                  <Grid className="size-5" />
                </span>
                <p className="text-[0.9375rem] leading-[1.5] font-semibold">격자 도구(K)로 드래그해 격자를 만들어 주세요</p>
                <p className="text-[0.8125rem] leading-[1.5] text-fg-neutral-muted">가로·세로 수를 적어서 만들 수도 있어요.</p>
                <Button variant="primary" size="sm" onClick={() => switchMode("grid")}>
                  격자 만들기
                </Button>
              </div>
            </div>
          )}

          {/* floating bottom toolbar + its popovers */}
          <div className="pointer-events-none absolute inset-x-0 bottom-4 z-20 flex flex-col items-center gap-2 px-3">
            {mode === "grid" && (
              <Floating className="pointer-events-auto flex flex-wrap items-center gap-x2 px-x3 py-x2">
                <span className="text-[0.8125rem] text-fg-neutral-muted">캔버스를 드래그해 크기를 정하거나, 숫자를 입력하세요</span>
                <form
                  className="flex items-center gap-x2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    addGrid(gridPop.cols, gridPop.rows);
                    setMode("select");
                  }}
                >
                  <label className="flex items-center gap-x1 text-[0.8125rem] text-fg-neutral-muted">
                    가로
                    <input
                      type="number"
                      min={1}
                      max={400}
                      value={gridPop.cols}
                      aria-label="가로 코 수"
                      onChange={(e) => setGridPop((s) => ({ ...s, cols: clamp(Number(e.target.value) || 1, 1, 400) }))}
                      className="h-8 w-16 rounded-r2 border border-stroke-neutral-weak bg-bg-layer-default px-x2 text-[0.875rem] text-fg-neutral tabular-nums outline-none focus:border-stroke-neutral-contrast"
                    />
                  </label>
                  <label className="flex items-center gap-x1 text-[0.8125rem] text-fg-neutral-muted">
                    세로
                    <input
                      type="number"
                      min={1}
                      max={400}
                      value={gridPop.rows}
                      aria-label="세로 단 수"
                      onChange={(e) => setGridPop((s) => ({ ...s, rows: clamp(Number(e.target.value) || 1, 1, 400) }))}
                      className="h-8 w-16 rounded-r2 border border-stroke-neutral-weak bg-bg-layer-default px-x2 text-[0.875rem] text-fg-neutral tabular-nums outline-none focus:border-stroke-neutral-contrast"
                    />
                  </label>
                  <Button type="submit" variant="primary" size="sm">
                    만들기
                  </Button>
                </form>
              </Floating>
            )}
            {mode === "brush" && (
              <Floating className="pointer-events-auto flex max-w-full flex-wrap items-center gap-x1_5 px-x3 py-x2">
                <span className="mr-x1 text-[0.8125rem] font-semibold">칸 색칠</span>
                {doc.colors.map((c) => (
                  <button
                    key={c}
                    type="button"
                    aria-label={`색 ${c}`}
                    aria-pressed={brushTool !== "eyedropper" && brushColor === c}
                    onClick={() => {
                      setBrushColor(c);
                      if (brushTool === "eyedropper") setBrushTool("paint");
                    }}
                    className={cx(
                      "size-7 rounded-full border border-black/10",
                      brushTool !== "eyedropper" && brushColor === c && "ring-2 ring-stroke-neutral-contrast ring-offset-2",
                    )}
                    style={{ background: c }}
                  />
                ))}
                <label className="relative flex size-7 cursor-pointer items-center justify-center rounded-full border border-dashed border-stroke-neutral-weak text-fg-neutral-muted hover:bg-bg-neutral-weak" title="직접 색 고르기">
                  <Plus className="size-4" />
                  <input
                    type="color"
                    aria-label="직접 색 고르기"
                    className="absolute inset-0 cursor-pointer opacity-0"
                    onChange={(e) => {
                      const c = e.target.value;
                      setBrushColor(c);
                      if (brushTool === "eyedropper") setBrushTool("paint");
                      if (!h.get().colors.includes(c)) h.set((d) => ({ ...d, colors: [...d.colors, c].slice(-16) }));
                    }}
                  />
                </label>
                <Sep />
                <IconButton label="색 지우기" size="sm" active={brushTool !== "eyedropper" && brushColor === null} onClick={() => setBrushColor(null)}>
                  <Eraser />
                </IconButton>
                <IconButton label="스포이트" size="sm" active={brushTool === "eyedropper"} onClick={() => setBrushTool((t) => (t === "eyedropper" ? "paint" : "eyedropper"))}>
                  <Pipette />
                </IconButton>
                <IconButton label="올가미 채우기" size="sm" active={brushTool === "lasso"} onClick={() => setBrushTool((t) => (t === "lasso" ? "paint" : "lasso"))}>
                  <Lasso />
                </IconButton>
              </Floating>
            )}
            <Floating className="pointer-events-auto flex items-center gap-x0_5 p-x1">
              <div role="toolbar" aria-label="도구" className="flex items-center gap-x0_5">
                {tools.map((t) => (
                  <IconButton key={t.id} label={t.label} shortcut={t.key} active={mode === t.id} disabled={t.disabled} onClick={() => switchMode(mode === t.id && (t.id === "gridEdit" || t.id === "brush") ? "select" : t.id)}>
                    {t.icon}
                  </IconButton>
                ))}
              </div>
              {sel && (
                <>
                  <Sep />
                  <span className="px-x1 text-[0.75rem] font-semibold text-fg-neutral-muted tabular-nums">{`${rectW(sel)}×${rectH(sel)}`}</span>
                </>
              )}
            </Floating>
          </div>

          {/* zoom controls */}
          <Floating className="absolute right-4 bottom-4 z-20 flex items-center gap-x0_5 p-x1">
            <IconButton label="축소" size="sm" onClick={() => zoomAt(0.8)}>
              <ZoomOut />
            </IconButton>
            <button
              type="button"
              aria-label="배율 초기화"
              title="배율 초기화"
              onClick={() => zoomAt(1 / view.zoom)}
              className="h-8 w-12 rounded-r2 text-[0.75rem] font-semibold text-fg-neutral tabular-nums hover:bg-bg-neutral-weak"
            >
              {Math.round(view.zoom * 100)}%
            </button>
            <IconButton label="확대" size="sm" onClick={() => zoomAt(1.25)}>
              <ZoomIn />
            </IconButton>
            <IconButton label="화면에 맞추기" shortcut="⇧1" size="sm" onClick={() => fit()}>
              <Fit />
            </IconButton>
          </Floating>
        </div>

        {!wide && (leftOpen || rightOpen) && (
          <div
            aria-hidden
            className="absolute inset-0 z-[25] bg-black/10"
            onPointerDown={() => {
              setLeftOpen(false);
              setRightOpen(false);
            }}
          />
        )}
        {(wide || rightOpen) && rightPanel}
      </div>

      <ContextMenu at={ctx} items={menuItems} onClose={() => setCtx(null)} />

      <Dialog
        open={!!saveMineOpen}
        onClose={() => setSaveMineOpen(null)}
        title="내 무늬로 등록"
        footer={
          <>
            <Button onClick={() => setSaveMineOpen(null)}>취소</Button>
            <Button variant="primary" onClick={saveMine}>
              등록
            </Button>
          </>
        }
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            saveMine();
          }}
        >
          <input
            autoFocus
            value={mineName}
            onChange={(e) => setMineName(e.target.value)}
            placeholder="예: 꽃 모티브"
            aria-label="무늬 이름"
            className="h-11 w-full rounded-r2 border border-stroke-neutral-weak bg-bg-layer-default px-x3 text-[1rem] outline-none focus:border-stroke-neutral-contrast"
          />
          {saveMineOpen && (
            <p className="mt-x2 text-[0.8125rem] text-fg-neutral-muted tabular-nums">
              {saveMineOpen.cols}코 × {saveMineOpen.rows}단 · 다른 도안에서도 같이 쓸 수 있어요
            </p>
          )}
        </form>
      </Dialog>
    </EditorShell>
  );
}

