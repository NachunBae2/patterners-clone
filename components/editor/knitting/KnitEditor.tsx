"use client";

import "./knit.css";
import Link from "next/link";
import { memo, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ContextMenu, Dialog, Button, Menu, cx, isMod, useHotkeys, useToast, type MenuItem } from "@/components/app/ui";
import { exportSvg, safeName, svgThumbnail } from "@/lib/export";
import { uid } from "@/lib/id";
import { works } from "@/lib/store";
import { BLANK_ID, ERASE_ID, canonicalSymbol, knitSymbol, symbolDefs } from "@/lib/symbols/knitting";
import type { KnitData, View, Work } from "@/lib/types";
import { useHistory } from "@/lib/useHistory";
import { AB_TAIL, ab, seedSize } from "./ab";
import { useKnitAutosave } from "./autosave";
import { ExportDialog, ShortcutDialog, type ShortcutGroup } from "./Dialogs";
import {
  BookmarkPlus,
  Box,
  ChevronDown,
  CircleHelp,
  Download,
  Eraser,
  FileUp,
  Footprints,
  Grid3x3,
  Hand,
  Lasso,
  LibraryBig,
  MousePointer2,
  Paintbrush,
  Pencil,
  Pipette,
  Plus,
  Redo2,
  Rotate3d,
  Scaling,
  ScrollText,
  Shapes,
  Sparkle,
  Undo2,
  X,
} from "./icons";
import { LESSONS, LessonPicker, LessonTour, type LessonId, type LessonProgress } from "./Lesson";
import {
  BIG_GRID,
  DEFAULT_NUMBERING,
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
  rowOwners,
  symbolAt,
  tileBlock,
  writeBlock,
  type Block,
  type Geo,
  type KDoc,
  type KGrid,
  type Rect,
  type Sel,
} from "./model";
import { PALETTE_W, Palette, type LeftTab, type MyPattern, type Stamp } from "./Palette";
import { RightPanel, hexA } from "./RightPanel";
import { LINE_ACTIVE, buildSvg, buildThumb, drawGridCanvas, gridLines, numFont, numberLabels } from "./render";

/* layout-audit-ignore: tiny-text — editor chrome reproduces the reference's 10–11px chips and labels */

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
const LESSON_SEEN = (id: string) => `pt:knit:lessons-seen:${id}`;
const MY_MAX = 60;
/** canvas margins used when framing grids (matches the reference fit: 48px sides, 66px bottom chrome) */
const FIT_PAD = 48;
const BOTTOM_CHROME = 66;
const FIT_MAX = 1.2;

const readMine = (): MyPattern[] => {
  try {
    const v = JSON.parse(localStorage.getItem(MY_KEY) ?? "[]");
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
};

function normalize(d: KnitData & Partial<KDoc>): KDoc {
  return {
    grids: (d.grids ?? []).map((g) => ({
      ...g,
      cells:
        g.cells.length === g.cols * g.rows
          ? g.cells.map((c) => (c?.symbol && canonicalSymbol(c.symbol) !== c.symbol ? { ...c, symbol: canonicalSymbol(c.symbol) } : c))
          : Array(g.cols * g.rows).fill(null),
    })),
    activeGridId: d.activeGridId ?? null,
    colors: d.colors?.length ? d.colors : ["#24365c", "#efe7d6", "#c47a5c"],
    gauge: d.gauge ?? { sts: 22, rows: 30 },
    gaugeOn: d.gaugeOn ?? false,
    bg: d.bg,
    view: d.view ?? { x: 0, y: 0, zoom: 1 },
  };
}

const SHORTCUTS: ShortcutGroup[] = [
  {
    title: "도구",
    items: [
      { keys: "V", label: "선택" },
      { keys: "E", label: "삽입 (기호 놓기)" },
      { keys: "H", label: "이동" },
      { keys: "K", label: "격자 만들기" },
      { keys: "G", label: "격자 편집" },
      { keys: "B", label: "칸 색칠" },
      { keys: "M", label: "내 무늬로 등록" },
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
      { keys: "테두리 드래그", label: "격자 옮기기" },
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

const MODE_INFO: Record<Mode, { label: string; key?: string; icon: (c?: string) => ReactNode }> = {
  select: { label: "선택", key: "V", icon: (c) => <MousePointer2 className={c} /> },
  edit: { label: "삽입", key: "E", icon: (c) => <Pencil className={c} /> },
  pan: { label: "이동", key: "H", icon: (c) => <Hand className={c} /> },
  grid: { label: "격자 만들기", key: "K", icon: (c) => <Grid3x3 className={c} /> },
  gridEdit: { label: "격자 편집", key: "G", icon: (c) => <Scaling className={c} /> },
  brush: { label: "칸 색칠", key: "B", icon: (c) => <Paintbrush className={c} /> },
};

// ---------------- grid view (memoised per grid object) ----------------

const GridView = memo(function GridView({ grid, geo, active, bg }: { grid: KGrid; geo: Geo; active: boolean; bg: string }) {
  const big = grid.cols * grid.rows > BIG_GRID;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const cv = canvasRef.current;
    if (!big || !cv) return;
    let alive = true;
    drawGridCanvas(cv, grid, geo, () => alive, active ? LINE_ACTIVE : undefined).catch(() => {});
    return () => {
      alive = false;
    };
  }, [big, grid, geo, active]);
  const W = grid.cols * geo.cw;
  const H = grid.rows * geo.ch;
  const lines = useMemo(() => (big ? [] : gridLines(grid, geo, active)), [big, grid, geo, active]);
  const labels = useMemo(() => numberLabels(grid, geo), [grid, geo]);
  const cells = useMemo(() => (big ? null : cellsMarkup(grid, geo)), [big, grid, geo]);
  const fs = numFont(geo);
  return (
    <div className="absolute" aria-label="격자" style={{ width: W, height: H, left: grid.x, top: grid.y }}>
      {big ? (
        <canvas ref={canvasRef} aria-hidden="true" className="pointer-events-none absolute" style={{ left: 0, top: 0, width: W, height: H }} />
      ) : (
        <svg aria-hidden="true" className="pointer-events-none absolute top-0 left-0" width={W} height={H} style={{ background: bg }}>
          <g color="#222" dangerouslySetInnerHTML={{ __html: cells! }} />
        </svg>
      )}
      {!big && (
        <svg
          aria-hidden="true"
          className={cx("pointer-events-none absolute top-0 left-0 z-2 overflow-visible", active ? "text-amber-500" : "text-neutral-400")}
          width={W}
          height={H}
          shapeRendering="crispEdges"
        >
          {lines.map((l, i) => (
            <line key={i} x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2} stroke="currentColor" strokeWidth={l.w} strokeLinecap="butt" strokeLinejoin="miter" />
          ))}
        </svg>
      )}
      {labels.map((l, i) => (
        <div
          key={i}
          className="pointer-events-none absolute z-[5] flex items-center justify-center text-fg-neutral-muted/80 tabular-nums select-none"
          style={{ left: l.x, top: l.y, width: l.w, height: l.h, fontSize: fs }}
        >
          {l.text}
        </div>
      ))}
    </div>
  );
});

/** colour fills + symbols of a grid (no lines; the line layer sits on top) */
function cellsMarkup(g: KGrid, geo: Geo) {
  const f = (n: number) => Math.round(n * 100) / 100;
  let s = "";
  for (let r = 0; r < g.rows; r++) {
    let c = 0;
    while (c < g.cols) {
      const col = g.cells[r * g.cols + c]?.color;
      if (!col) {
        c++;
        continue;
      }
      let e = c + 1;
      while (e < g.cols && g.cells[r * g.cols + e]?.color === col) e++;
      s += `<rect x="${f(c * geo.cw)}" y="${f(r * geo.ch)}" width="${f((e - c) * geo.cw)}" height="${f(geo.ch)}" fill="${col}"/>`;
      c = e;
    }
  }
  for (let r = 0; r < g.rows; r++) {
    const owners = rowOwners(g, r);
    for (let c = 0; c < g.cols; c++) {
      if (owners[c] !== c) continue;
      const cell = g.cells[r * g.cols + c]!;
      const sym = knitSymbol(cell.symbol);
      if (!sym) continue;
      const dark = cell.color && lightLow(cell.color);
      s += `<use href="#ks-${sym.id}" x="${f(c * geo.cw)}" y="${f(r * geo.ch)}" width="${f(sym.width * geo.cw)}" height="${f(geo.ch)}"${dark ? ' color="#fff"' : ""}/>`;
    }
  }
  return s;
}
const lightLow = (hex: string) => {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return false;
  const n = parseInt(m[1], 16);
  return (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255 < 0.45;
};

function Divider({ className }: { className?: string }) {
  return <div className={cx("mx-x0_5 h-6 w-px bg-stroke-neutral-muted", className)} />;
}

function ToolBtn({
  label,
  active,
  disabled,
  onClick,
  children,
  tour,
  className,
  pressed,
}: {
  label: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: ReactNode;
  tour?: string;
  className?: string;
  pressed?: boolean;
}) {
  return (
    <button
      className={cx(ab(active ? "brandSolid" : "ghost"), AB_TAIL, "w-x8 px-0", className)}
      type="button"
      aria-label={label}
      title={label}
      aria-pressed={pressed}
      data-tour={tour}
      disabled={disabled}
      data-disabled={disabled ? "" : undefined}
      tabIndex={disabled ? -1 : undefined}
      onClick={onClick}
      style={seedSize(32, 32)}
    >
      {children}
    </button>
  );
}

// ---------------- root: real document ↔ lesson practice docs ----------------

const isFresh = (w: Work) => w.createdAt === w.updatedAt && !(w.data as KnitData).grids?.length;

function practiceData(lesson: LessonId): KDoc {
  const g = newGrid("격자 1", -168.333, -111.667, 12, 8);
  g.x = -168.333;
  g.y = -111.667;
  const base: KDoc = { grids: lesson === "grid" ? [] : [g], activeGridId: lesson === "grid" ? null : g.id, colors: ["#fecaca", "#24365c", "#efe7d6", "#c47a5c", "#6d9c1c", "#5d8aa1"], gauge: { sts: 22, rows: 30 }, gaugeOn: false, view: { x: 424, y: 450, zoom: 1.2 } };
  return base;
}

export default function KnitEditor({ work, data }: { work: Work; data: KnitData }) {
  const [lesson, setLesson] = useState<{ id: LessonId; n: number } | null>(null);
  const [gen, setGen] = useState(0);
  const fresh = useMemo(() => isFresh(work), [work]);
  const [picker, setPicker] = useState(() => {
    if (!fresh) return false;
    try {
      return !localStorage.getItem(LESSON_SEEN(work.id));
    } catch {
      return false;
    }
  });
  const markSeen = () => {
    try {
      localStorage.setItem(LESSON_SEEN(work.id), "1");
    } catch {
      /* ignore */
    }
  };
  // after a lesson the real document is read back from storage (it was saved on the way out)
  const current = useMemo(() => {
    if (!gen) return { work, data };
    const w = works.get(work.id);
    return w ? { work: w, data: w.data as KnitData } : { work, data };
  }, [gen, work, data]);

  if (lesson)
    return (
      <Editor
        key={`lesson-${lesson.id}-${lesson.n}`}
        work={{ ...work, title: "연습용 도안" }}
        data={practiceData(lesson.id) as KnitData}
        practice={lesson.id}
        seed={false}
        onLessons={() => setPicker(true)}
        onExitPractice={() => {
          setLesson(null);
          setGen((g) => g + 1);
        }}
        overlay={null}
      />
    );

  return (
    <Editor
      key={`doc-${gen}`}
      work={current.work}
      data={current.data}
      seed={fresh && gen === 0}
      onLessons={() => setPicker(true)}
      overlay={
        picker ? (
          <LessonPicker
            onPick={(id) => {
              markSeen();
              setPicker(false);
              setLesson({ id, n: Date.now() });
            }}
            onLater={() => {
              markSeen();
              setPicker(false);
            }}
          />
        ) : null
      }
    />
  );
}

// ---------------- editor ----------------

type EditorProps = {
  work: Work;
  data: KnitData;
  /** brand-new document: start with a 20 × 20 grid */
  seed: boolean;
  practice?: LessonId;
  onExitPractice?: () => void;
  onLessons: () => void;
  overlay: ReactNode;
};

function Editor({ work, data, seed, practice, onExitPractice, onLessons, overlay }: EditorProps) {
  const initial = useMemo(() => {
    const d = normalize(data);
    if (seed && !d.grids.length) {
      // a new document starts with one 20 × 20 board (placed where the reference editor puts it)
      const g = newGrid("격자 1", 0, 0, 20, 20);
      d.grids = [{ ...g, x: 147.606, y: 83.6436 }];
    }
    return d;
  }, [data, seed]);
  const h = useHistory<KDoc>(initial);
  const doc = h.state;
  const toast = useToast();
  const soon = () => toast("준비 중이에요");

  const [view, setView] = useState<View>(initial.view);
  const viewRef = useRef(view);
  viewRef.current = view;
  // While the view is moving the content layer is composited (will-change) so pans and zooms stay smooth;
  // once it settles the hint is dropped so the chart re-rasters crisply at the new scale.
  const [viewLive, setViewLive] = useState<"initial" | "moving" | "idle">("initial");
  const liveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const touchView = useCallback(() => {
    setViewLive("moving");
    if (liveTimer.current) clearTimeout(liveTimer.current);
    liveTimer.current = setTimeout(() => setViewLive("idle"), 300);
  }, []);
  const [activeId, setActiveId] = useState<string | null>(seed ? null : (initial.activeGridId ?? initial.grids[0]?.id ?? null));
  const [mode, setMode] = useState<Mode>(practice === "gridEdit" ? "gridEdit" : practice === "grid" ? "grid" : practice === "modes" ? "brush" : "select");
  const [pick, setPick] = useState<string | null>(null);
  const [stamp, setStamp] = useState<Stamp | null>(null);
  const [tab, setTab] = useState<LeftTab>("symbols");
  const [paletteOpen, setPaletteOpen] = useState(true);
  const [paletteW, setPaletteW] = useState(PALETTE_W);
  const [sel, setSel] = useState<Sel | null>(null);
  const [hover, setHover] = useState<{ gridId: string; c: number; r: number } | null>(null);
  const [bandHover, setBandHover] = useState<string | null>(null);
  const [brushColor, setBrushColor] = useState<string | null>(initial.colors[0] ?? "#24365c");
  const [brushTool, setBrushTool] = useState<"paint" | "eyedropper" | "lasso">("paint");
  const [space, setSpace] = useState(false);
  const [preview, setPreview] = useState<{ create?: { x: number; y: number; w: number; h: number; cols: number; rows: number }; lasso?: Pt[]; resize?: string } | null>(null);
  const [gridPop, setGridPop] = useState({ cols: 20, rows: 20 });
  const [mine, setMine] = useState<MyPattern[]>([]);
  const [saveMineOpen, setSaveMineOpen] = useState<Block | null>(null);
  const [mineName, setMineName] = useState("");
  const [ctx, setCtx] = useState<{ x: number; y: number } | null>(null);
  const [exportOpen, setExportOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [written, setWritten] = useState(false);
  const [pillOpen, setPillOpen] = useState(true);
  const [tracker, setTracker] = useState<{ on: boolean; row: number }>({ on: false, row: 1 });
  const [title, setTitle] = useState(work.title);
  const [step, setStep] = useState(0);
  const [prog, setProg] = useState<LessonProgress>({ gridsCreated: 0, picked: false, placed: 0, resized: 0, carved: 0, mode: "", painted: 0, glyphOpened: false });
  const bump = (k: "gridsCreated" | "placed" | "resized" | "carved" | "painted") => practice && setProg((p) => ({ ...p, [k]: p[k] + 1 }));

  const wrapRef = useRef<HTMLDivElement>(null);
  const surfaceRef = useRef<HTMLDivElement>(null);
  const drag = useRef<Drag | null>(null);
  const clip = useRef<Block | null>(null);

  const geo = useMemo(() => geoOf(doc), [doc]);
  const geoRef = useRef(geo);
  geoRef.current = geo;
  const active = doc.grids.find((g) => g.id === activeId) ?? null;
  const visibleGrids = doc.grids.filter((g) => g.visible);

  useEffect(() => setMine(readMine()), []);
  useEffect(() => {
    if (practice) setProg((p) => (p.mode === mode ? p : { ...p, mode }));
  }, [mode, practice]);

  // ---------- persistence ----------
  const saveData = useMemo<KnitData>(() => ({ ...doc, activeGridId: activeId, view }) as KnitData, [doc, activeId, view]);
  const save = useKnitAutosave(work.id, saveData, {
    enabled: !practice,
    initialSavedAt: seed ? null : work.updatedAt,
    thumb: () => {
      const s = buildThumb(h.get(), geoOf(h.get()));
      return s ? svgThumbnail(s) : undefined;
    },
  });
  const rename = (t: string) => {
    setTitle(t);
    if (!practice) works.update(work.id, { title: t, updatedAt: Date.now() });
  };

  // ---------- view helpers ----------
  const fit = useCallback(
    (grids?: KGrid[]) => {
      const el = wrapRef.current;
      const b = gridBounds((grids ?? h.get().grids).filter((g) => g.visible), geoRef.current);
      if (!el || !b) return;
      const W = el.clientWidth;
      const H = el.clientHeight - BOTTOM_CHROME;
      const zoom = clamp(Math.min((W - FIT_PAD * 2) / (b.x1 - b.x0), (H - FIT_PAD * 2) / (b.y1 - b.y0)), 0.1, FIT_MAX);
      setView({ zoom, x: W / 2 - ((b.x0 + b.x1) / 2) * zoom, y: H / 2 - ((b.y0 + b.y1) / 2) * zoom });
    },
    [h],
  );

  // first open: frame existing grids when the saved view is the default
  const framed = useRef(false);
  useEffect(() => {
    if (framed.current) return;
    framed.current = true;
    const v = initial.view;
    if (!practice && initial.grids.length && v.x === 0 && v.y === 0 && v.zoom === 1) fit(initial.grids);
  }, [fit, initial, practice]);

  const zoomAt = useCallback((factor: number, sx?: number, sy?: number) => {
    const el = surfaceRef.current;
    if (!el) return;
    const v = viewRef.current;
    const px = sx ?? el.clientWidth / 2;
    const py = sy ?? el.clientHeight / 2;
    const zoom = clamp(v.zoom * factor, 0.1, 8);
    touchView();
    const wx = (px - v.x) / v.zoom;
    const wy = (py - v.y) / v.zoom;
    setView({ zoom, x: px - wx * zoom, y: py - wy * zoom });
  }, [touchView]);

  useEffect(() => {
    const el = surfaceRef.current;
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
        touchView();
        setView((v) => ({ ...v, x: v.x - dx, y: v.y - dy }));
      }
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [zoomAt, touchView]);

  // the content layer sits on whole pixels so 1px grid lines stay crisp
  const tx = Math.round(view.x);
  const ty = Math.round(view.y);
  const toWorld = (e: { clientX: number; clientY: number }): Pt => {
    const r = surfaceRef.current!.getBoundingClientRect();
    const v = viewRef.current;
    return { x: (e.clientX - r.left - Math.round(v.x)) / v.zoom, y: (e.clientY - r.top - Math.round(v.y)) / v.zoom };
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
  /** the band just outside a grid's border: drag it to move the grid */
  const hitBand = (p: Pt) => {
    const gs = h.get().grids;
    const t = 8 / viewRef.current.zoom;
    for (let i = gs.length - 1; i >= 0; i--) {
      const g = gs[i];
      if (!g.visible) continue;
      const W = g.cols * geo.cw;
      const H = g.rows * geo.ch;
      const inOuter = p.x >= g.x - t && p.x <= g.x + W + t && p.y >= g.y - t && p.y <= g.y + H + t;
      const inInner = p.x > g.x && p.x < g.x + W && p.y > g.y && p.y < g.y + H;
      if (inOuter && !inInner) return g;
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
    if (next === h.get()) return false;
    if (!d.cp) {
      h.checkpoint();
      d.cp = true;
    }
    h.set(next, { merge: true });
    return true;
  };

  const addGrid = (cols: number, rows: number, at?: Pt, block?: Block, name?: string) => {
    let x: number;
    let y: number;
    if (at) {
      x = at.x;
      y = at.y;
    } else {
      const b = gridBounds(h.get().grids, geo);
      const el = surfaceRef.current;
      if (b) {
        x = b.x1 + geo.cw * 3;
        y = b.y0;
      } else {
        const v = viewRef.current;
        const W = el?.clientWidth ?? 800;
        const H = (el?.clientHeight ?? 600) - BOTTOM_CHROME;
        x = (W / 2 - v.x) / v.zoom - (cols * geo.cw) / 2;
        y = (H / 2 - v.y) / v.zoom - (rows * geo.ch) / 2;
      }
    }
    let g: KGrid = { ...newGrid(name ?? nextGridName(h.get().grids), x, y, cols, rows), numbering: DEFAULT_NUMBERING };
    if (block) g = tileBlock(g, block, { c0: 0, r0: 0, c1: cols - 1, r1: rows - 1 }, { c: cols % block.cols ? cols - block.cols * Math.ceil(cols / block.cols) : 0, r: 0 });
    h.set((d) => ({ ...d, grids: [...d.grids, g] }));
    setActiveId(g.id);
    setSel(null);
    bump("gridsCreated");
    if (!at) {
      const el = surfaceRef.current;
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
  const selGrid = sel ? (doc.grids.find((g) => g.id === sel.gridId) ?? null) : null;

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
    setPaletteOpen(true);
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
      setActiveId(null);
      if (mode === "gridEdit") setMode("select");
    }
  };
  const clearRows = (odd: boolean) => {
    if (!active) return;
    editGrid(active.id, (g) => {
      const cells = g.cells.slice();
      const rev = (g.numbering ?? DEFAULT_NUMBERING).reverseRows !== false;
      for (let r = 0; r < g.rows; r++) {
        const num = rev ? g.rows - r : r + 1;
        if (num % 2 === (odd ? 1 : 0)) for (let c = 0; c < g.cols; c++) cells[r * g.cols + c] = null;
      }
      return { ...g, cells };
    });
    toast(odd ? "홀수단을 비웠어요" : "짝수단을 비웠어요");
  };

  const switchMode = (m: Mode) => {
    if (m === "gridEdit" && !active) {
      toast("선택 모드에서 격자를 먼저 골라 주세요");
      return;
    }
    if (m === "edit" && !doc.grids.length) toast("격자를 먼저 만들어 주세요. 격자 도구(K)로 드래그하면 만들 수 있어요");
    if (m !== "edit") setStamp(null);
    if (m === "brush") setBrushTool((t) => (t === "eyedropper" ? "paint" : t));
    setMode(m);
  };

  // ---------- pointer ----------
  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button === 2) return;
    setCtx(null);
    const p = toWorld(e);
    const target = e.target as Element;
    (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId);
    if (e.button === 1 || mode === "pan" || space) {
      const v = viewRef.current;
      drag.current = { kind: "pan", sx: e.clientX, sy: e.clientY, vx: v.x, vy: v.y };
      return;
    }
    const hit = hitGrid(p);

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
      const band = !hit ? hitBand(p) : null;
      if (band) {
        setActiveId(band.id);
        drag.current = { kind: "gridMove", gridId: band.id, gx: band.x, gy: band.y, start: p, cp: false };
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
      setActiveId(null);
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
        erase: pick === ERASE_ID || (!!ex && ex.id === pick),
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
      if (commit(mapGrid(h.get(), hit.g.id, (g) => paintCells(g, [{ c: hit.c, r: hit.r }], brushColor)), d)) bump("painted");
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
    if (commit(next, d) && !d.erase) bump("placed");
  };

  const stampAt = (d: Extract<Drag, { kind: "stamp" }>, cells: Cell[]) => {
    if (!stamp) return;
    const b = stamp.block;
    const next = mapGrid(h.get(), d.gridId, (g0) => {
      let g = g0;
      for (const c of cells) {
        const tcol = d.origin.c + Math.floor((c.c - d.origin.c) / b.cols) * b.cols;
        const trow = d.origin.r + Math.floor((c.r - d.origin.r) / b.rows) * b.rows;
        const key = `${tcol},${trow}`;
        if (d.done.has(key)) continue;
        d.done.add(key);
        g = writeBlock(g, b, tcol, trow, true);
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
        if (d.remove && cur?.symbol !== BLANK_ID) g = placeSymbol(g, c.r, c.c, BLANK_ID) ?? g;
        if (!d.remove && cur?.symbol === BLANK_ID) g = eraseSymbol(g, c.r, c.c);
      }
      return g;
    });
    if (commit(next, d)) bump("carved");
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const p = toWorld(e);
    const d = drag.current;
    if (!d) {
      const hit = hitGrid(p);
      const nh = hit ? { gridId: hit.g.id, c: hit.c, r: hit.r } : null;
      if (nh?.gridId !== hover?.gridId || nh?.c !== hover?.c || nh?.r !== hover?.r) setHover(nh);
      const band = mode === "select" && !hit ? (hitBand(p)?.id ?? null) : null;
      if (band !== bandHover) setBandHover(band);
      return;
    }
    const D = h.get();
    switch (d.kind) {
      case "pan":
        touchView();
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
        else if (
          commit(
            mapGrid(D, d.gridId, (gg) => paintCells(gg, cells, d.color)),
            d,
          )
        )
          bump("painted");
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
          for (let r = 0; r < g.rows; r++) for (let c = 0; c < g.cols; c++) if (inside(g.x + (c + 0.5) * geo.cw, g.y + (r + 0.5) * geo.ch)) list.push({ c, r });
          count += list.length;
          return list.length ? paintCells(g, list, brushColor) : g;
        }),
      };
      if (!count) toast("올가미 안에 칠할 칸이 없어요");
      else {
        h.set(next);
        bump("painted");
      }
      return;
    }
    if (d.kind === "resize") {
      setPreview(null);
      if (d.cp) bump("resized");
    }
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
        setHelpOpen(true);
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
      if (k === "!" || (e.shiftKey && k === "1")) {
        touchView();
        return fit();
      }
      if (e.altKey) return;
      if (lower === "v") switchMode("select");
      else if (lower === "e") switchMode("edit");
      else if (lower === "h") switchMode("pan");
      else if (lower === "k") switchMode("grid");
      else if (lower === "g") switchMode(mode === "gridEdit" ? "select" : "gridEdit");
      else if (lower === "b") switchMode(mode === "brush" ? "select" : "brush");
      else if (lower === "m") openSaveMine();
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
    const svg = buildSvg(h.get(), geo, { numbers: true, labels: h.get().grids.filter((g) => g.visible).length > 1, legend: true, background: "#ffffff" });
    if (!svg) return false;
    await exportSvg(svg, format, safeName(title));
    return true;
  };

  // ---------- render ----------
  const defs = useMemo(() => {
    const used = new Set<string>();
    for (const g of doc.grids) for (const c of g.cells) if (c?.symbol && !knitSymbol(c.symbol)?.group) used.add(c.symbol);
    return symbolDefs(geo.cw, geo.ch) + (used.size ? symbolDefs(geo.cw, geo.ch, "ks", used) : "");
  }, [geo, doc.grids]);
  const z = view.zoom;
  const cursor =
    mode === "pan" || space
      ? drag.current?.kind === "pan"
        ? "grabbing"
        : "grab"
      : mode === "select"
        ? bandHover || drag.current?.kind === "gridMove"
          ? "move"
          : "default"
        : mode === "brush" && brushTool === "eyedropper"
          ? "copy"
          : "cell";

  const hoverGrid = hover ? (doc.grids.find((g) => g.id === hover.gridId) ?? null) : null;
  const pickW = knitSymbol(pick ?? undefined)?.width ?? 1;
  const bg = doc.bg ? hexA(doc.bg.color, doc.bg.opacity) : "#fff";

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
        <g>
          <rect x={x} y={y} width={pickW * geo.cw} height={geo.ch} fill={fits ? "var(--seed-color-palette-lime-500)" : "#e5484d"} fillOpacity={0.14} stroke={fits ? "var(--seed-color-palette-lime-700)" : "#e5484d"} strokeWidth={1.5 / z} />
          {pick !== ERASE_ID && <use href={`#ks-${canonicalSymbol(pick)}`} x={x} y={y} width={pickW * geo.cw} height={geo.ch} color="#222" opacity={0.45} />}
        </g>
      );
    } else if (mode === "brush" && brushTool === "paint") {
      hoverOverlay = <rect x={x} y={y} width={geo.cw} height={geo.ch} fill={brushColor ?? "#fff"} fillOpacity={0.6} stroke="#222" strokeWidth={1 / z} />;
    } else if (mode === "brush" && brushTool === "eyedropper") {
      hoverOverlay = <rect x={x} y={y} width={geo.cw} height={geo.ch} fill="none" stroke="#222" strokeWidth={1.5 / z} />;
    } else if (mode === "gridEdit" && hoverGrid.id === activeId) {
      hoverOverlay = <rect x={x} y={y} width={geo.cw} height={geo.ch} fill="var(--seed-color-palette-amber-500, #f59e0b)" fillOpacity={0.12} stroke="none" />;
    }
  }

  let selOverlay: ReactNode = null;
  if (sel && selGrid && selGrid.visible && mode !== "gridEdit") {
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
        <rect x={x} y={y} width={w} height={hh} fill="rgb(14 165 233)" fillOpacity={0.12} stroke="rgb(14 165 233)" strokeWidth={2 / z} />
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
              stroke="rgb(14 165 233)"
              strokeWidth={1.5 / z}
              pointerEvents="all"
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
    const t = 12 / z;
    const bar = (edge: "l" | "r" | "t" | "b", x: number, y: number, w: number, hh: number, cur: string) => (
      <rect key={edge} data-edge={edge} x={x} y={y} width={w} height={hh} fill="transparent" pointerEvents="all" style={{ cursor: cur }} />
    );
    editOverlay = (
      <g transform={`translate(${active.x} ${active.y})`}>
        {bar("l", -t / 2, 0, t, H, "ew-resize")}
        {bar("r", W - t / 2, 0, t, H, "ew-resize")}
        {bar("t", 0, -t / 2, W, t, "ns-resize")}
        {bar("b", 0, H - t / 2, W, t, "ns-resize")}
      </g>
    );
  }

  let trackOverlay: ReactNode = null;
  if (tracker.on && active && active.visible) {
    const rev = (active.numbering ?? DEFAULT_NUMBERING).reverseRows !== false;
    const r = rev ? active.rows - tracker.row : tracker.row - 1;
    if (r >= 0 && r < active.rows)
      trackOverlay = (
        <g>
          <rect x={active.x} y={active.y} width={active.cols * geo.cw} height={r * geo.ch} fill="#fff" fillOpacity={0.55} />
          <rect x={active.x} y={active.y + r * geo.ch} width={active.cols * geo.cw} height={geo.ch} fill="rgb(14 165 233)" fillOpacity={0.14} stroke="rgb(14 165 233)" strokeWidth={1.5 / z} />
        </g>
      );
  }

  // selection summary pill (top right): the selected range, or the whole grid while editing it
  const pillRect: (Rect & { g: KGrid }) | null =
    sel && selGrid ? { ...sel, g: selGrid } : mode === "gridEdit" && active ? { c0: 0, r0: 0, c1: active.cols - 1, r1: active.rows - 1, g: active } : null;
  const pillItems = useMemo(() => {
    if (!pillRect) return [];
    const m = new Map<string, number>();
    const g = pillRect.g;
    for (let r = pillRect.r0; r <= pillRect.r1; r++) {
      const owners = rowOwners(g, r);
      for (let c = pillRect.c0; c <= pillRect.c1; c++) {
        const o = owners[c];
        const id = o >= 0 ? g.cells[r * g.cols + o]?.symbol : undefined;
        if (o >= 0 && o !== c && c !== pillRect.c0) continue;
        const name = id ? (knitSymbol(id)?.name ?? id) : "빈칸";
        m.set(name, (m.get(name) ?? 0) + 1);
      }
    }
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [pillRect?.g, pillRect?.c0, pillRect?.c1, pillRect?.r0, pillRect?.r1]); // eslint-disable-line react-hooks/exhaustive-deps

  const menuItems: MenuItem[] = [
    { label: "복사", shortcut: "⌘C", disabled: !sel, onSelect: () => copySel() },
    { label: "잘라내기", shortcut: "⌘X", disabled: !sel, onSelect: () => copySel() && clearSel() },
    { label: "붙여넣기", shortcut: "⌘V", onSelect: paste },
    "separator",
    { label: "좌우 뒤집기", shortcut: "⇧H", disabled: !sel, onSelect: flipH },
    { label: "상하 뒤집기", shortcut: "⇧V", disabled: !sel, onSelect: flipV },
    { label: "오른쪽 회전", shortcut: "R", disabled: !sel, onSelect: rotate },
    "separator",
    { label: "내 무늬로 등록", shortcut: "M", disabled: !active, onSelect: openSaveMine },
    { label: "삭제", shortcut: "Delete", danger: true, disabled: !sel, onSelect: clearSel },
  ];

  const paletteHighlight = mode === "gridEdit" ? BLANK_ID : mode === "edit" && !stamp ? pick : null;
  const navBtn = (id: LeftTab, label: string, icon: ReactNode) => {
    const on = paletteOpen && tab === id;
    return (
      <button
        className={cx(ab(on ? "brandSolid" : "ghost", "small", "iconOnly"), !on && "text-fg-neutral-muted")}
        type="button"
        aria-label={label}
        title={label}
        aria-pressed={on}
        data-maker-nav={id}
        style={seedSize(36, 36)}
        onClick={() => {
          if (on) setPaletteOpen(false);
          else {
            setTab(id);
            setPaletteOpen(true);
          }
        }}
      >
        {icon}
      </button>
    );
  };
  const navSoon = (label: string, icon: ReactNode) => (
    <button className={cx(ab("ghost", "small", "iconOnly"), "text-fg-neutral-muted")} type="button" aria-label={label} title={label} aria-pressed={false} style={seedSize(36, 36)} onClick={soon}>
      {icon}
    </button>
  );

  const writtenRows = useMemo(() => {
    const g = active ?? doc.grids[0];
    if (!written || !g) return null;
    const rev = (g.numbering ?? DEFAULT_NUMBERING).reverseRows !== false;
    const sides = g.sides ?? { worked: "flat", firstRowSide: "RS" };
    const out: { n: number; side: string; text: string }[] = [];
    for (let i = 0; i < g.rows; i++) {
      const r = rev ? g.rows - 1 - i : i;
      const n = i + 1;
      const rs = sides.worked === "round" || (n % 2 === 1) === (sides.firstRowSide === "RS");
      const owners = rowOwners(g, r);
      const seq: string[] = [];
      // right-side rows are read right → left
      const cols = Array.from({ length: g.cols }, (_, k) => k);
      if (rs) cols.reverse();
      for (const c of cols) {
        const o = owners[c];
        if (o >= 0 && o !== c) continue;
        const id = o >= 0 ? g.cells[r * g.cols + o]?.symbol : undefined;
        seq.push(id ? (knitSymbol(id)?.name ?? id) : "겉뜨기");
      }
      const runs: string[] = [];
      for (let k = 0; k < seq.length; ) {
        let e = k + 1;
        while (e < seq.length && seq[e] === seq[k]) e++;
        runs.push(e - k > 1 ? `${seq[k]} ${e - k}` : seq[k]);
        k = e;
      }
      out.push({ n, side: rs ? "겉면" : "안면", text: runs.join(", ") });
    }
    return { name: g.name, rows: out };
  }, [written, active, doc.grids]);

  return (
    <div className="knit-editor fixed top-0 left-0 z-20 h-dvh w-full overflow-hidden overscroll-none" data-editor-shell>
      <svg aria-hidden="true" width="0" height="0" className="absolute">
        <defs dangerouslySetInnerHTML={{ __html: defs }} />
      </svg>
      <div className="h-full min-h-0 overflow-hidden">
        <div className="relative flex h-full min-h-0 flex-col overflow-hidden bg-bg-layer-fill">
          <div className="relative flex min-h-0 flex-1 overflow-hidden">
            {/* icon rail */}
            <nav data-maker-rail="true" className="relative z-[90] flex h-full w-14 shrink-0 flex-col items-center overflow-hidden border-r border-stroke-neutral-muted bg-bg-layer-default px-x1 py-x2 transition-[width,opacity] duration-200">
              <Link
                className="mb-x3 flex size-x9 items-center justify-center rounded-r2 text-fg-neutral hover:bg-bg-layer-default-pressed focus-visible:outline-2 focus-visible:outline-stroke-focus-ring"
                aria-label="PATTERNERS"
                href="/home"
              >
                <span aria-hidden="true" className="flex size-8 items-center justify-center overflow-hidden rounded-md">
                  <svg viewBox="0 0 32 32" className="size-8">
                    <path d="M8.5 27.5V4.5H17.2C22.4 4.5 25.6 7.5 25.6 12.2C25.6 17 22.3 20 17.1 20H13.6V27.5Z M13.6 15.7H16.6C19 15.7 20.4 14.4 20.4 12.2C20.4 10.1 19 8.8 16.6 8.8H13.6Z" fill="currentColor" fillRule="evenodd" />
                  </svg>
                </span>
              </Link>
              <div className="flex flex-col items-center gap-x1" data-tour="nav-tabs">
                {navBtn("symbols", "기호", <Shapes className="seed-icon" />)}
                {navBtn("library", "무늬 라이브러리", <LibraryBig className="seed-icon" />)}
                {navBtn("mine", "내 무늬", <Box className="seed-icon" />)}
                {navSoon("원문·파일로 만들기", <FileUp className="seed-icon" />)}
                {navSoon("AI 어시스턴트", <Sparkle className="seed-icon" />)}
                <span className="relative">
                  {navSoon("실체화 (β)", <Rotate3d className="seed-icon" />)}
                  <span className="t1-bold pointer-events-none absolute -top-1 -right-1 rounded-r1 bg-bg-brand-weak px-x1 text-fg-brand">β</span>
                </span>
              </div>
              <div className="mt-auto flex flex-col items-center gap-x1 pb-x2">
                <div className="mb-x1 h-px w-7 bg-stroke-neutral-muted" />
                <button
                  className={cx(ab("ghost", "small", "iconOnly"), "text-fg-neutral-muted")}
                  type="button"
                  data-tour="export"
                  aria-label="내보내기"
                  title="내보내기"
                  aria-haspopup="dialog"
                  aria-expanded={exportOpen}
                  style={seedSize(36, 36)}
                  onClick={() => setExportOpen(true)}
                >
                  <Download className="seed-icon" />
                </button>
              </div>
            </nav>

            <div className="relative flex min-h-0 min-w-0 flex-1 overflow-hidden">
              <Palette
                width={paletteW}
                onWidth={setPaletteW}
                open={paletteOpen}
                onCollapse={() => setPaletteOpen(false)}
                title={title}
                onRename={practice ? undefined : rename}
                save={practice ? undefined : save.status}
                onRetrySave={save.retry}
                tab={tab}
                geo={geo}
                picked={paletteHighlight}
                onPick={(id) => {
                  setPick(id);
                  setStamp(null);
                  setMode("edit");
                  setSel(null);
                  if (practice) setProg((p) => ({ ...p, picked: true }));
                }}
                onCreateGlyph={() => {
                  if (practice) setProg((p) => ({ ...p, glyphOpened: true }));
                  soon();
                }}
                stamp={stamp}
                onStamp={chooseStamp}
                active={active}
                onFillGrid={fillGrid}
                onNewGridFromStamp={newGridFromStamp}
                mine={mine}
                onSaveMine={openSaveMine}
                onDeleteMine={deleteMine}
              />

              <div className="relative flex min-h-0 min-w-0 flex-1 overflow-hidden">
                <div
                  ref={wrapRef}
                  className="@container/maker-canvas relative min-h-0 min-w-0 flex-1 overflow-hidden"
                  data-tour="canvas"
                  style={{ ["--maker-top-right" as string]: "3.5rem", ["--maker-bottom-chrome" as string]: `${BOTTOM_CHROME}px` }}
                >
                  <div className="h-full min-h-0 w-full">
                    <div
                      ref={surfaceRef}
                      data-canvas-surface="true"
                      role="application"
                      aria-label="대바늘 차트 캔버스"
                      className="relative z-0 h-full w-full touch-none overflow-hidden select-none"
                      style={{
                        cursor,
                        backgroundColor: "rgb(255, 255, 255)",
                        backgroundImage: "radial-gradient(oklch(0.78 0.01 260 / 0.35) 1px, transparent 1px)",
                        backgroundSize: `${20 * z}px ${20 * z}px`,
                        backgroundPosition: `${view.x}px ${view.y}px`,
                      }}
                      onPointerDown={onPointerDown}
                      onPointerMove={onPointerMove}
                      onPointerUp={onPointerUp}
                      onPointerCancel={onPointerUp}
                      onPointerLeave={() => {
                        if (!drag.current) {
                          setHover(null);
                          setBandHover(null);
                        }
                      }}
                      onContextMenu={(e) => {
                        e.preventDefault();
                        if (mode === "select") setCtx({ x: e.clientX, y: e.clientY });
                      }}
                    >
                      <div data-export-root="true" className="relative origin-top-left overflow-visible" style={{ transform: `translate(${tx}px, ${ty}px) scale(${z})`, willChange: viewLive === "idle" ? "auto" : "transform" }}>
                        {visibleGrids.map((g) => (
                          <GridView key={g.id} grid={g} geo={geo} active={g.id === activeId} bg={bg} />
                        ))}
                      </div>
                      <svg className="pointer-events-none absolute inset-0 size-full overflow-visible" aria-hidden="true">
                        <g transform={`translate(${tx} ${ty}) scale(${z})`}>
                          {trackOverlay}
                          {hoverOverlay}
                          {selOverlay}
                          {editOverlay}
                          {bandHover && mode === "select" && (() => {
                            const g = doc.grids.find((x) => x.id === bandHover);
                            return g ? <rect x={g.x} y={g.y} width={g.cols * geo.cw} height={g.rows * geo.ch} fill="none" stroke="rgb(14 165 233)" strokeWidth={2 / z} /> : null;
                          })()}
                          {preview?.create && (
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
                          )}
                          {preview?.lasso && (
                            <polygon
                              points={preview.lasso.map((q) => `${q.x},${q.y}`).join(" ")}
                              fill={brushColor ?? "#888"}
                              fillOpacity={0.15}
                              stroke="#222"
                              strokeWidth={1.2 / z}
                              strokeDasharray={`${4 / z} ${3 / z}`}
                            />
                          )}
                        </g>
                      </svg>

                      {preview?.create && (
                        <div
                          className="pointer-events-none absolute rounded-r1_5 bg-bg-neutral-inverted px-x2 py-x1 text-[0.75rem] font-semibold whitespace-nowrap text-fg-neutral-inverted tabular-nums"
                          style={{ left: (preview.create.x + preview.create.w) * z + tx + 8, top: (preview.create.y + preview.create.h) * z + ty + 8 }}
                        >
                          {preview.create.cols}코 × {preview.create.rows}단
                        </div>
                      )}
                      {preview?.resize && (
                        <div className="pointer-events-none absolute top-3 left-1/2 -translate-x-1/2 rounded-r1_5 bg-bg-neutral-inverted px-x2_5 py-x1 text-[0.8125rem] font-semibold text-fg-neutral-inverted tabular-nums">
                          {preview.resize}
                        </div>
                      )}

                      {/* selection summary */}
                      {pillRect && (
                        <div className="pointer-events-none absolute top-[var(--maker-top-right,0.75rem)] right-3 z-[80]">
                          <div className="pointer-events-auto" onPointerDown={(e) => e.stopPropagation()}>
                            <div className="flex max-w-64 min-w-[9rem] flex-col gap-1 rounded-md border border-stroke-neutral-muted bg-bg-layer-default/90 px-2.5 py-1.5 shadow-s1 backdrop-blur-sm select-none" data-selection-ui="true">
                              <button type="button" className="flex w-full items-center justify-between gap-2 text-left" aria-expanded={pillOpen} title={pillOpen ? "접기" : "펼치기"} onClick={() => setPillOpen((v) => !v)}>
                                <span className="text-[11px] font-semibold text-fg-neutral tabular-nums">
                                  {rectW(pillRect) * rectH(pillRect)}개 선택
                                  <span className="ml-1.5 font-medium text-fg-neutral-muted">
                                    {rectW(pillRect)}×{rectH(pillRect)}
                                  </span>
                                </span>
                                <ChevronDown className={cx("size-3.5 shrink-0 text-fg-neutral-muted transition-transform", pillOpen && "rotate-180")} />
                              </button>
                              {pillOpen && (
                                <ul className="flex max-h-48 flex-col gap-0.5 overflow-y-auto overscroll-y-contain pr-0.5">
                                  {pillItems.map(([name, n]) => (
                                    /* layout-audit-ignore: tiny-text — the reference selection summary lists counts at 10px */
                                    <li key={name} className="text-[10px] leading-snug text-fg-neutral-muted">
                                      {name} {n}개
                                    </li>
                                  ))}
                                </ul>
                              )}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* top-left: written pattern */}
                  <div className="contents">
                    <div className="pointer-events-none absolute inset-0 z-80">
                      <div className="pointer-events-none absolute top-3 left-3" data-tour="written-toggle">
                        <button
                          className={cx(
                            ab("neutralOutline"),
                            AB_TAIL,
                            "pointer-events-auto h-8 gap-1.5 !rounded-r2 border-stroke-neutral-muted px-2.5 shadow-s2",
                            written ? "bg-bg-layer-default-pressed text-fg-neutral" : "bg-bg-layer-default text-fg-neutral hover:bg-bg-layer-default-pressed/80",
                          )}
                          type="button"
                          aria-pressed={written}
                          aria-label="서술도안 보기"
                          style={seedSize(78.78, 32)}
                          onClick={() => setWritten((v) => !v)}
                        >
                          <ScrollText className="size-3.5" />
                          <span className="text-[11px] leading-none font-medium">서술도안</span>
                        </button>
                        {writtenRows && (
                          <div className="pointer-events-auto mt-2 flex max-h-[min(60vh,520px)] w-80 flex-col overflow-hidden rounded-r3 border border-stroke-neutral-muted bg-bg-layer-default shadow-s2">
                            <div className="flex h-10 shrink-0 items-center justify-between border-b border-stroke-neutral-muted px-x3">
                              <span className="t2-bold truncate text-fg-neutral">{writtenRows.name} · 서술도안</span>
                              <button type="button" aria-label="닫기" className="flex size-7 items-center justify-center rounded-r2 text-fg-neutral-muted hover:bg-bg-layer-default-pressed" onClick={() => setWritten(false)}>
                                <X className="size-3.5" />
                              </button>
                            </div>
                            <ol className="min-h-0 flex-1 overflow-y-auto px-x3 py-x2">
                              {writtenRows.rows.map((r) => (
                                <li key={r.n} className="py-1 text-[12px] leading-[1.5] text-fg-neutral">
                                  <span className="mr-x1_5 font-semibold tabular-nums">{r.n}단</span>
                                  <span className="mr-x1_5 text-fg-neutral-muted">({r.side})</span>
                                  {r.text}
                                </li>
                              ))}
                            </ol>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* top-right: mode */}
                  <div className="pointer-events-none absolute top-3 right-3 z-50 flex items-center gap-2">
                    <Menu
                      align="end"
                      trigger={({ toggle }) => (
                        <button
                          className={cx(
                            ab("neutralOutline"),
                            AB_TAIL,
                            "pointer-events-auto h-8 gap-1.5 !rounded-r2 border-stroke-neutral-muted bg-bg-layer-default px-2.5 text-fg-neutral shadow-s2 hover:bg-bg-layer-default-pressed/80 [&_svg]:size-3.5",
                          )}
                          type="button"
                          data-maker-mode={mode}
                          aria-label={`지금 모드: ${MODE_INFO[mode].label} · 눌러서 바꾸기`}
                          aria-haspopup="menu"
                          onClick={toggle}
                        >
                          {MODE_INFO[mode].icon("size-4")}
                          <span className="text-[11px] leading-none font-medium">{MODE_INFO[mode].label}</span>
                          <ChevronDown className="!size-3 text-fg-neutral-muted" />
                        </button>
                      )}
                      items={(Object.keys(MODE_INFO) as Mode[]).map((m) => ({
                        label: MODE_INFO[m].label,
                        shortcut: MODE_INFO[m].key,
                        disabled: m === "gridEdit" && !active,
                        onSelect: () => switchMode(m),
                      }))}
                    />
                  </div>

                  {/* bottom toolbar + its popovers */}
                  <div className="pointer-events-none absolute bottom-3 z-50 flex max-w-[calc(100%-1.5rem)] -translate-x-1/2 flex-col items-center gap-2 pb-[env(safe-area-inset-bottom)]" style={{ left: "50%" }}>
                    <div className="flex flex-col items-center gap-2">
                      {mode === "grid" && (
                        <div className="pointer-events-auto flex flex-wrap items-center gap-x2 rounded-r3 border border-stroke-neutral-muted bg-bg-layer-floating/95 px-x3 py-x2 shadow-s2">
                          <span className="text-[12px] text-fg-neutral-muted">캔버스를 끌거나 수를 적어 만드세요</span>
                          <form
                            className="flex items-center gap-x2"
                            onSubmit={(e) => {
                              e.preventDefault();
                              addGrid(gridPop.cols, gridPop.rows);
                              setMode("select");
                            }}
                          >
                            <label className="flex items-center gap-x1 text-[12px] text-fg-neutral-muted">
                              가로
                              <input
                                type="number"
                                min={1}
                                max={400}
                                value={gridPop.cols}
                                aria-label="가로 코 수"
                                onChange={(e) => setGridPop((s) => ({ ...s, cols: clamp(Number(e.target.value) || 1, 1, 400) }))}
                                className="h-8 w-16 rounded-r2 bg-bg-layer-fill px-x2 text-[13px] text-fg-neutral tabular-nums outline-none focus:ring-1 focus:ring-stroke-neutral-contrast"
                              />
                            </label>
                            <label className="flex items-center gap-x1 text-[12px] text-fg-neutral-muted">
                              세로
                              <input
                                type="number"
                                min={1}
                                max={400}
                                value={gridPop.rows}
                                aria-label="세로 단 수"
                                onChange={(e) => setGridPop((s) => ({ ...s, rows: clamp(Number(e.target.value) || 1, 1, 400) }))}
                                className="h-8 w-16 rounded-r2 bg-bg-layer-fill px-x2 text-[13px] text-fg-neutral tabular-nums outline-none focus:ring-1 focus:ring-stroke-neutral-contrast"
                              />
                            </label>
                            <button type="submit" className={cx(ab("brandSolid"), AB_TAIL, "h-8 px-x3 text-[12px] font-medium")}>
                              만들기
                            </button>
                          </form>
                        </div>
                      )}
                      {mode === "brush" && (
                        <div data-tour="brush-palette" className="pointer-events-auto flex max-w-full flex-wrap items-center gap-x1_5 rounded-r3 border border-stroke-neutral-muted bg-bg-layer-floating/95 px-x3 py-x2 shadow-s2">
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
                              className={cx("size-6 rounded-full border border-black/10", brushTool !== "eyedropper" && brushColor === c && "ring-2 ring-stroke-neutral-contrast ring-offset-2")}
                              style={{ background: c }}
                            />
                          ))}
                          <label className="relative flex size-6 cursor-pointer items-center justify-center rounded-full border border-dashed border-stroke-neutral-weak text-fg-neutral-muted hover:bg-bg-layer-default-pressed" title="직접 색 고르기">
                            <Plus className="size-3.5" />
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
                          <Divider />
                          <ToolBtn label="지우개 (색 지우기)" active={brushTool !== "eyedropper" && brushColor === null} onClick={() => setBrushColor(null)}>
                            <Eraser className="size-4" />
                          </ToolBtn>
                          <ToolBtn label="스포이드" active={brushTool === "eyedropper"} onClick={() => setBrushTool((t) => (t === "eyedropper" ? "paint" : "eyedropper"))}>
                            <Pipette className="size-4" />
                          </ToolBtn>
                          <ToolBtn label="올가미 채우기" active={brushTool === "lasso"} onClick={() => setBrushTool((t) => (t === "lasso" ? "paint" : "lasso"))}>
                            <Lasso className="size-4" />
                          </ToolBtn>
                        </div>
                      )}
                      {tracker.on && active && (
                        <div className="pointer-events-auto flex items-center gap-x1 rounded-r3 border border-stroke-neutral-muted bg-bg-layer-floating/95 px-x2 py-x1 shadow-s2">
                          <span className="px-x1 text-[12px] font-medium text-fg-neutral tabular-nums">따라 뜨기 · {tracker.row}단</span>
                          <button className={cx(ab("ghost"), AB_TAIL, "h-7 px-x2 text-[12px]")} type="button" disabled={tracker.row <= 1} onClick={() => setTracker((t) => ({ ...t, row: Math.max(1, t.row - 1) }))}>
                            이전 단
                          </button>
                          <button className={cx(ab("brandSolid"), AB_TAIL, "h-7 px-x2 text-[12px]")} type="button" disabled={tracker.row >= active.rows} onClick={() => setTracker((t) => ({ ...t, row: Math.min(active.rows, t.row + 1) }))}>
                            다음 단
                          </button>
                        </div>
                      )}
                      <div className="maker-bottom-tools pointer-events-auto flex items-center gap-x1 rounded-r4 border border-stroke-neutral-muted bg-bg-layer-floating/95 p-x1_5 shadow-s3 backdrop-blur-md @max-[38rem]/maker-canvas:max-w-full @max-[38rem]/maker-canvas:flex-wrap @max-[38rem]/maker-canvas:justify-center @max-[38rem]/maker-canvas:gap-x-x3 @max-[38rem]/maker-canvas:gap-y-x1">
                        <div className="flex items-center gap-0.5">
                          <ToolBtn label="실행 취소" onClick={h.undo}>
                            <Undo2 />
                          </ToolBtn>
                          <ToolBtn label="다시 실행" onClick={h.redo}>
                            <Redo2 />
                          </ToolBtn>
                        </div>
                        <Divider className="@max-[38rem]/maker-canvas:hidden" />
                        <div className="relative h-8 overflow-hidden @max-[38rem]/maker-canvas:order-first" style={{ width: 236 }}>
                          <div data-tour="toolbar-tools" className="relative flex h-8 w-max items-center gap-0.5 opacity-100" role="toolbar" aria-label="도구">
                            <ToolBtn label="선택 (V)" active={mode === "select"} onClick={() => switchMode("select")}>
                              <MousePointer2 />
                            </ToolBtn>
                            <ToolBtn label="삽입 (E)" active={mode === "edit"} onClick={() => switchMode("edit")}>
                              <Pencil />
                            </ToolBtn>
                            <ToolBtn label="이동" active={mode === "pan"} onClick={() => switchMode("pan")}>
                              <Hand />
                            </ToolBtn>
                            <ToolBtn label="격자 만들기 (K)" tour="toolbar-grid" active={mode === "grid"} onClick={() => switchMode("grid")}>
                              <Grid3x3 className="size-4" />
                            </ToolBtn>
                            <span className="inline-flex">
                              <ToolBtn label="격자 편집 (G)" tour="toolbar-grid-edit" active={mode === "gridEdit"} disabled={!active} onClick={() => switchMode(mode === "gridEdit" ? "select" : "gridEdit")}>
                                <Scaling className="size-4" />
                              </ToolBtn>
                            </span>
                            <ToolBtn label="칸 색칠 (B)" tour="toolbar-brush" className="relative" active={mode === "brush"} onClick={() => switchMode(mode === "brush" ? "select" : "brush")}>
                              <Paintbrush className="size-4" />
                              <span aria-hidden="true" className="absolute right-0.5 bottom-0.5 size-1.5 rounded-full ring-1 ring-bg-layer-default" style={{ backgroundColor: brushColor ?? "#ffffff" }} />
                            </ToolBtn>
                            <ToolBtn
                              label="따라 뜨기"
                              pressed={tracker.on}
                              active={tracker.on}
                              onClick={() => {
                                if (!active && !tracker.on) {
                                  toast("따라 뜰 격자를 먼저 골라 주세요");
                                  return;
                                }
                                setTracker((t) => ({ on: !t.on, row: t.row }));
                              }}
                            >
                              <Footprints className="size-4" />
                            </ToolBtn>
                          </div>
                        </div>
                        <Divider className="@max-[38rem]/maker-canvas:hidden" />
                        <div data-tour="register-icon" className="flex items-center gap-0.5">
                          <ToolBtn label="내 무늬로 등록 (M)" onClick={openSaveMine}>
                            <BookmarkPlus />
                          </ToolBtn>
                        </div>
                        <Divider className="@max-[38rem]/maker-canvas:hidden" />
                        <div data-tour="help">
                          <Menu
                            align="end"
                            trigger={({ toggle }) => (
                              <button className={cx(ab("ghost"), AB_TAIL, "w-x8 px-0")} type="button" aria-label="단축키 도움말" aria-haspopup="menu" style={seedSize(32, 32)} onClick={toggle}>
                                <CircleHelp />
                              </button>
                            )}
                            items={[
                              { label: "심화 레슨", onSelect: onLessons, disabled: !!practice },
                              { label: "단축키 보기", shortcut: "?", onSelect: () => setHelpOpen(true) },
                            ]}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <RightPanel
                  doc={doc}
                  activeId={activeId}
                  zoom={z}
                  savedAt={save.savedAt}
                  practice={!!practice}
                  onZoom={(a) => (a === "in" ? zoomAt(1.25) : a === "out" ? zoomAt(0.8) : a === "reset" ? zoomAt(1 / viewRef.current.zoom) : (touchView(), fit()))}
                  onHistory={soon}
                  onActivate={(id) => {
                    setActiveId(id);
                    if (sel && sel.gridId !== id) setSel(null);
                  }}
                  onRename={(id, name) => editGrid(id, (g) => (g.name === name ? g : { ...g, name }))}
                  onToggle={(id) => editGrid(id, (g) => ({ ...g, visible: !g.visible }))}
                  onDelete={deleteGrid}
                  onAddGrid={() => addGrid(gridPop.cols, gridPop.rows)}
                  onAddFolder={soon}
                  onNumbering={(n) => active && editGrid(active.id, (g) => ({ ...g, numbering: n }))}
                  onSides={(s) => active && editGrid(active.id, (g) => ({ ...g, sides: s }))}
                  onGaugeOn={(on) => h.set((d) => ({ ...d, gaugeOn: on }))}
                  onGauge={(gauge) => h.set((d) => ({ ...d, gauge: { sts: clamp(Math.round(gauge.sts) || 1, 4, 60), rows: clamp(Math.round(gauge.rows) || 1, 4, 80) } }))}
                  onClearRows={clearRows}
                  onBg={(b) => h.set((d) => ({ ...d, bg: b }))}
                />
              </div>
            </div>
          </div>

          {practice && (
            <LessonTour
              lesson={practice}
              step={step}
              progress={prog}
              onStep={setStep}
              onExit={() => {
                toast(`${LESSONS.find((l) => l.id === practice)?.title} 레슨을 마쳤어요`);
                onExitPractice?.();
              }}
            />
          )}
          {overlay}
        </div>
      </div>

      <ContextMenu at={ctx} items={menuItems} onClose={() => setCtx(null)} />
      <ExportDialog open={exportOpen} onClose={() => setExportOpen(false)} onExport={onExport} />
      <ShortcutDialog open={helpOpen} onClose={() => setHelpOpen(false)} groups={SHORTCUTS} />

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
    </div>
  );
}
