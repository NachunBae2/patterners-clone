"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button, Dialog, IconButton, Menu, NumberField, cx, isMod, useToast, type MenuItem } from "@/components/app/ui";
import { download, exportSvg, safeName, svgThumbnail } from "@/lib/export";
import { uid } from "@/lib/id";
import { works } from "@/lib/store";
import type { CrochetData, CrochetFolder, CrochetItem, CrochetLayer, GatherItem, StitchItem, StrokeItem, TextItem, View, Work } from "@/lib/types";
import { versions, type Version } from "@/lib/versions";
import { useAutosave } from "@/lib/useAutosave";
import { useHistory } from "@/lib/useHistory";
import { INK, STROKE_WIDTH, defaultSpread, getSymbol, symbolSize } from "@/lib/symbols/crochet";
import { QuickSlots, RadialIcon, Toolbar, slotGlyph, type Mode, type Slot } from "./BottomChrome";
import { CtxMenu, type CtxItem } from "./CtxMenu";
import {
  boxCenter,
  buildSvg,
  cloneItems,
  flipItem,
  itemAnchor,
  itemBounds,
  itemGeom,
  linearAutoCount,
  linearPlacements,
  moveItem,
  normDeg,
  geomFoot,
  heightFactor,
  placeTemplate,
  radialAutoCount,
  radialPlacements,
  rotateItem,
  setStitchHeights,
  snap,
  stitchGeom,
  stitchTransform,
  unionBounds,
  type Box,
  type Pt,
} from "./geometry";
import { ExportDialog, ShortcutDialog, type ExportFormat, type ShortcutGroup } from "./EditorDialogs";
import { MyIconPreview, Palette, type PaletteTab, type Picked } from "./Palette";
import { Rail, type NavTab } from "./Rail";
import { BTN, el, sab } from "./seed";
import { ArrowRightLeft, ChevronDown, Hand, Hash, Minus, MousePointer2, PanelLeft, PenTool, Pencil, Plus, ScrollText } from "./uiIcons";
import "./crochet-editor.css";
import { SpotlightTour, tourSeen } from "@/components/tour/SpotlightTour";
import { makerTourSteps } from "@/components/tour/makerSteps";
import { myIcons, useMyIcons } from "./myIcons";
import { ItemsPreview, LayerView } from "./render";
import { RightPanel, type LayerActions, type PropActions } from "./RightPanel";
import { interpret } from "./assistant";
import { insertChart, insertLayersAsFolder, nextFolderName, type Doc } from "./docops";
import { HeightsDialog, VersionDialog, versionTime } from "./PanelDialogs";
import { AssistantPanel, ImportPanel, TemplatePanel, type ChatMsg, type ImportOptions } from "./SidePanels";
import type { ParseResult } from "./parser";
import { WrittenPanel } from "./WrittenPanel";
import { TEMPLATES } from "./templates";

// ---------- types ----------

type Template = { items: CrochetItem[]; w: number; h: number };

type Drag =
  | { k: "pan"; sx: number; sy: number; vx: number; vy: number }
  | {
      k: "move";
      sx: number;
      sy: number;
      start: Pt;
      ids: string[];
      hitIds: string[];
      anchor: Pt;
      orig: Map<string, CrochetItem> | null;
      alt: boolean;
      shift: boolean;
      wasSelected: boolean;
    }
  | { k: "marquee"; start: Pt; add: boolean; base: string[] }
  | { k: "rotate"; center: Pt; startAngle: number; orig: Map<string, CrochetItem>; started: boolean }
  | { k: "stretch"; orig: StitchItem; base: number; axis: "v" | "h"; started: boolean }
  | { k: "linear"; a: Pt }
  | { k: "radial"; start: Pt; fromCenter: boolean }
  | { k: "vertex"; id: string; i: number; started: boolean };

/** Left panel content: the symbol palette tabs or one of the rail's other panels. */
type LeftTab = PaletteTab | "library" | "aiConvert" | "ai";

type LinearDraft = { a: Pt; b: Pt; count: number; final: boolean };
type RadialDraft = { c: Pt; rx: number; ry: number; count: number; final: boolean };

const MIN_ZOOM = 0.1;
const MAX_ZOOM = 8;
const clampZoom = (z: number) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z));
const CLIP_KEY = "pt:crochet:clipboard";
const NUMBER_COLOR = "#4b5563";

/** Height of the quick slots + toolbar stack; the empty canvas centres above it (reference --maker-bottom-chrome). */
const BOTTOM_CHROME = 154;
const PALETTE_W = 264;
const PALETTE_MIN = 224;
const PALETTE_MAX = 480;
const DEFAULT_SLOTS = ["sc", "dc", "ch", "hdc", "slst"];
const LEGACY_DEFAULT_SLOTS = ["ch", "sc", "hdc", "dc", null];

const MODES: { mode: Mode; label: string; key: string; icon: (p: { className?: string }) => React.ReactNode }[] = [
  { mode: "select", label: "선택", key: "V", icon: MousePointer2 },
  { mode: "insert", label: "삽입", key: "E", icon: Pencil },
  { mode: "pan", label: "이동", key: "H", icon: Hand },
  { mode: "pen", label: "펜", key: "P", icon: PenTool },
  { mode: "linear", label: "평면", key: "L", icon: ArrowRightLeft },
  { mode: "radial", label: "원형", key: "O", icon: RadialIcon },
  { mode: "number", label: "단 숫자", key: "N", icon: Hash },
];

const SHORTCUTS: ShortcutGroup[] = [
  {
    title: "필수 단축키",
    items: [
      { keys: "⌘Z", label: "실행 취소" },
      { keys: "⇧⌘Z", label: "다시 실행" },
      { keys: "⌘C / ⌘V", label: "복사 / 붙여넣기" },
      { keys: "⌘X", label: "잘라내기" },
      { keys: "⌘D", label: "복제" },
      { keys: "Delete", label: "삭제" },
      { keys: "?", label: "단축키 보기" },
    ],
  },
  {
    title: "도구 단축키",
    items: [
      { keys: "V", label: "선택" },
      { keys: "E", label: "삽입" },
      { keys: "H / Space", label: "화면 이동" },
      { keys: "P", label: "펜 (Enter 완료 · Esc 취소)" },
      { keys: "L", label: "평면 만들기" },
      { keys: "O", label: "원형 만들기" },
      { keys: "N", label: "단 숫자 넣기" },
      { keys: "1–5", label: "퀵 슬롯" },
      { keys: "Esc", label: "도구·반복·선택 해제" },
    ],
  },
  {
    title: "선택 단축키",
    items: [
      { keys: "Shift + 클릭", label: "선택 추가·빼기" },
      { keys: "⌘A", label: "모두 선택" },
      { keys: "방향키", label: "선택 옮기기 (Shift ×10)" },
      { keys: "Alt + 드래그", label: "드래그로 복제" },
      { keys: "⌘ + 드래그", label: "드래그 중 스냅 잠시 끄기" },
    ],
  },
  {
    title: "편집 단축키",
    items: [
      { keys: "R / ⇧R", label: "±15° 회전" },
      { keys: "⇧H / ⇧V", label: "좌우 / 상하 뒤집기" },
      { keys: "⌘G", label: "그룹" },
      { keys: "⇧⌘G", label: "그룹 해제" },
      { keys: "M", label: "내 기호로 등록" },
    ],
  },
  {
    title: "보기 단축키",
    items: [
      { keys: "휠", label: "화면 이동" },
      { keys: "⌘ + 휠", label: "확대·축소" },
      { keys: "G", label: "점/격자 표시 토글" },
      { keys: "⌘0", label: "화면에 맞추기" },
    ],
  },
];

// ---------- doc helpers ----------

function normalize(d: CrochetData): CrochetData {
  let layers: CrochetLayer[] = d.layers ?? [];
  // a fresh chart has no rounds yet: the first placed stitch creates 1단
  if (layers.length === 1 && !layers[0].items.length && layers[0].name === "1단" && layers[0].visible && !layers[0].color) layers = [];
  const activeLayerId = layers.some((l) => l.id === d.activeLayerId) ? d.activeLayerId : (layers[layers.length - 1]?.id ?? "");
  let slots = d.quickSlots ?? [];
  if (!slots.length || JSON.stringify(slots) === JSON.stringify(LEGACY_DEFAULT_SLOTS)) slots = DEFAULT_SLOTS;
  const quickSlots = [...slots, null, null, null, null, null].slice(0, 5);
  // optional fields added later (folders, background, stitch heights): absent in older charts
  const folders = (Array.isArray(d.folders) ? d.folders : []).filter((f): f is CrochetFolder => !!f && typeof f.id === "string" && typeof f.name === "string");
  const known = new Set(folders.map((f) => f.id));
  if (layers.some((l) => l.folderId && !known.has(l.folderId)))
    layers = layers.map((l) => {
      if (!l.folderId || known.has(l.folderId)) return l;
      const c = { ...l };
      delete c.folderId;
      return c;
    });
  return {
    layers,
    activeLayerId,
    quickSlots,
    showGrid: d.showGrid ?? true,
    view: d.view ?? { x: 0, y: 0, zoom: 1 },
    ...(folders.length ? { folders } : {}),
    ...(typeof d.background === "string" ? { background: d.background } : {}),
    ...(typeof d.backgroundOpacity === "number" ? { backgroundOpacity: Math.max(0, Math.min(100, d.backgroundOpacity)) } : {}),
    ...(d.heights && typeof d.heights === "object" ? { heights: d.heights } : {}),
  };
}

function docOf(d: CrochetData): Doc {
  const out: Partial<CrochetData> = { ...d };
  delete out.view;
  return out as Doc;
}

const DEFAULT_BG = "#ffffff";
/** CSS colour for the canvas background (hex + opacity %). */
function bgColor(hex: string | undefined, pct: number | undefined) {
  const c = hex ?? DEFAULT_BG;
  const a = (pct ?? 100) / 100;
  if (a >= 1 && c === DEFAULT_BG) return "rgb(255, 255, 255)";
  const m = c.match(/^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i);
  if (!m) return c;
  const [r, g, b] = [m[1], m[2], m[3]].map((x) => parseInt(x, 16));
  return a >= 1 ? `rgb(${r}, ${g}, ${b})` : `rgba(${r}, ${g}, ${b}, ${a})`;
}

/** Path-like symbols that "경로 편집" turns into an editable stroke: their outline in world coordinates. */
function pathOutline(it: CrochetItem): { points: [number, number][]; closed: boolean } | null {
  if (it.type === "stroke") return { points: it.points, closed: !!it.closed };
  if (it.type !== "stitch") return null;
  const s = getSymbol(it.symbol);
  if (!s) return null;
  const { w, h } = itemGeom(it);
  let local: [number, number][];
  let closed = true;
  if (s.id === "shape_line") {
    local = [[-w / 2 + 1, 0], [w / 2 - 1, 0]];
    closed = false;
  } else if (s.id === "shape_rect") local = [[-w / 2 + 2, -h / 2 + 2], [w / 2 - 2, -h / 2 + 2], [w / 2 - 2, h / 2 - 2], [-w / 2 + 2, h / 2 - 2]];
  else if (s.id === "shape_triangle") local = [[0, -h / 2 + 2], [w / 2 - 2, h / 2 - 2], [-w / 2 + 2, h / 2 - 2]];
  else if (s.id === "shape_star") {
    const r = w / 2 - 1.5;
    local = Array.from({ length: 10 }, (_, i) => {
      const a = ((-90 + i * 36) * Math.PI) / 180;
      const rr = i % 2 ? r * 0.45 : r;
      return [Math.cos(a) * rr, Math.sin(a) * rr] as [number, number];
    });
  } else return null;
  const rad = (it.rotation * Math.PI) / 180;
  const c = Math.cos(rad), sn = Math.sin(rad);
  const points = local.map(([x, y]) => {
    const fx = it.flipH ? -x : x, fy = it.flipV ? -y : y;
    return [Math.round((it.x + fx * c - fy * sn) * 100) / 100, Math.round((it.y + fx * sn + fy * c) * 100) / 100] as [number, number];
  });
  return { points, closed };
}

function mapItems(d: Doc, ids: Set<string>, fn: (it: CrochetItem) => CrochetItem | null): Doc {
  return {
    ...d,
    layers: d.layers.map((l) => {
      if (!l.items.some((it) => ids.has(it.id))) return l;
      const items: CrochetItem[] = [];
      for (const it of l.items) {
        if (!ids.has(it.id)) items.push(it);
        else {
          const r = fn(it);
          if (r) items.push(r);
        }
      }
      return { ...l, items };
    }),
  };
}

/** Adds items to a layer; with no layers yet, creates 1단 for them (and makes it active). */
const addItems = (d: Doc, layerId: string, items: CrochetItem[]): Doc => {
  if (!d.layers.length) {
    const layer: CrochetLayer = { id: uid(), name: "1단", visible: true, items };
    return { ...d, layers: [layer], activeLayerId: layer.id };
  }
  const target = d.layers.some((l) => l.id === layerId) ? layerId : d.layers[d.layers.length - 1].id;
  return { ...d, layers: d.layers.map((l) => (l.id === target ? { ...l, items: [...l.items, ...items] } : l)) };
};

function findItem(d: Doc, id: string): { item: CrochetItem; layer: CrochetLayer } | null {
  for (const layer of d.layers) for (const item of layer.items) if (item.id === id) return { item, layer };
  return null;
}

function nextLayerName(layers: CrochetLayer[]) {
  let n = layers.length + 1;
  const names = new Set(layers.map((l) => l.name));
  while (names.has(`${n}단`)) n++;
  return `${n}단`;
}

function templateFor(p: Picked): Template | null {
  if (!p) return null;
  if (p.kind === "symbol") {
    const s = getSymbol(p.id);
    if (!s) return null;
    if (s.gather) {
      const g: GatherItem = { id: "tpl", type: "gather", kind: s.gather.kind, symbol: s.gather.leg, count: s.gather.count, spread: s.gather.spread, x: 0, y: 0, rotation: 0 };
      return { items: [g], w: s.w, h: s.h };
    }
    const st: StitchItem = { id: "tpl", type: "stitch", symbol: s.id, x: 0, y: 0, rotation: 0 };
    const { w, h } = symbolSize(s);
    return { items: [st], w, h };
  }
  const m = myIcons.get(p.id);
  if (!m) return null;
  const b = unionBounds(m.items);
  if (!b) return null;
  return { items: m.items, w: b.x1 - b.x0, h: b.y1 - b.y0 };
}

const slotToPick = (v: string | null): Picked => (!v ? null : v.startsWith("my:") ? { kind: "my", id: v.slice(3) } : { kind: "symbol", id: v });
const pickToSlot = (p: Picked) => (!p ? null : p.kind === "my" ? `my:${p.id}` : p.id);
const pickName = (p: Picked) => (!p ? "" : p.kind === "symbol" ? getSymbol(p.id)?.name ?? "" : myIcons.get(p.id)?.name ?? "내 기호");

// ---------- component ----------

export default function CrochetEditor({ work, data }: { work: Work; data: CrochetData }) {
  const toast = useToast();
  const init = useMemo(() => normalize(data), [data]);
  const h = useHistory<Doc>(docOf(init));
  const doc = h.state;
  // 기호 높이 applies to every geometry call below; hk re-renders memoised items when it changes
  const hk = setStitchHeights(doc.heights);
  const folders = useMemo(() => doc.folders ?? [], [doc.folders]);
  const [view, setView] = useState<View>(init.view);
  const viewRef = useRef(view);
  viewRef.current = view;

  const [mode, setModeState] = useState<Mode>("select");
  const [picked, setPicked] = useState<Picked>({ kind: "symbol", id: "sc" });
  const [selection, setSelectionState] = useState<string[]>([]);
  const selRef = useRef(selection);
  const setSelection = useCallback((ids: string[]) => {
    selRef.current = ids;
    setSelectionState(ids);
  }, []);

  const [tab, setTab] = useState<LeftTab>("symbols");
  const narrowRef = useRef(false);
  const [query, setQuery] = useState("");
  const [activeOnly, setActiveOnly] = useState(false);
  const [space, setSpace] = useState(false);
  const spaceRef = useRef(false);
  const [panning, setPanning] = useState(false);
  const [hover, setHover] = useState<Pt | null>(null);
  const [marquee, setMarquee] = useState<{ a: Pt; b: Pt } | null>(null);
  const [pen, setPenState] = useState<[number, number][]>([]);
  const penRef = useRef(pen);
  const setPenPts = useCallback((pts: [number, number][]) => {
    penRef.current = pts;
    setPenState(pts);
  }, []);
  const [linear, setLinear] = useState<LinearDraft | null>(null);
  const [radial, setRadial] = useState<RadialDraft | null>(null);
  const [numberNext, setNumberNext] = useState(1);
  const numberStack = useRef<string[]>([]);
  const [assignSlot, setAssignSlot] = useState<number | null>(null);
  const [ctx, setCtx] = useState<{ x: number; y: number; slot?: number } | null>(null);
  const [registerOpen, setRegisterOpen] = useState(false);
  const [registerName, setRegisterName] = useState("");
  const [deleteIconId, setDeleteIconId] = useState<string | null>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [narrow, setNarrow] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(true);
  const [paletteW, setPaletteW] = useState(PALETTE_W);
  const [rightOpen, setRightOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [tour, setTour] = useState(false);
  const [writtenOpen, setWrittenOpen] = useState(false);
  const [versionsOpen, setVersionsOpen] = useState(false);
  const [heightsOpen, setHeightsOpen] = useState(false);
  const [chat, setChat] = useState<ChatMsg[]>([]);
  const [pathVertex, setPathVertex] = useState<number | null>(null);
  const lastVertexDown = useRef<{ i: number; t: number } | null>(null);
  const [pathEdit, setPathEditState] = useState<string | null>(null);
  const pathEditRef = useRef<string | null>(null);
  const setPathEdit = useCallback((id: string | null) => {
    pathEditRef.current = id;
    setPathEditState(id);
    setPathVertex(null);
  }, []);
  const [title, setTitle] = useState(work.title);
  const [savedAt, setSavedAt] = useState(work.updatedAt);
  const icons = useMyIcons();

  const wrapRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const dragRef = useRef<Drag | null>(null);
  const pasteCount = useRef(0);
  const lastDup = useRef<{ src: string; copy: string } | null>(null);

  const template = useMemo(() => templateFor(picked), [picked, icons]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---------- derived ----------

  const index = useMemo(() => {
    const m = new Map<string, { item: CrochetItem; layer: CrochetLayer }>();
    for (const layer of doc.layers) for (const item of layer.items) m.set(item.id, { item, layer });
    return m;
  }, [doc.layers]);

  const editable = useCallback(
    (l: CrochetLayer) => l.visible && !l.locked && (!activeOnly || l.id === doc.activeLayerId),
    [activeOnly, doc.activeLayerId],
  );

  const sel = useMemo(() => selection.filter((id) => index.has(id) && editable(index.get(id)!.layer)), [selection, index, editable]);
  const selSet = useMemo(() => new Set(sel), [sel]);
  const selItems = useMemo(() => sel.map((id) => index.get(id)!.item), [sel, index]);
  const selectedForPanel = useMemo(() => sel.map((id) => ({ item: index.get(id)!.item, fallback: index.get(id)!.layer.color ?? INK })), [sel, index]);
  const selBounds = useMemo(() => unionBounds(selItems), [selItems]);
  const activeLayer = doc.layers.find((l) => l.id === doc.activeLayerId) ?? doc.layers[0];
  const activeColor = activeLayer?.color ?? INK;

  // ---------- autosave ----------

  const saveData = useMemo<CrochetData>(() => ({ ...doc, view }), [doc, view]);
  const thumb = useCallback(() => {
    const svg = buildSvg(doc.layers, { fit: { w: 320, h: 240 }, margin: 16, background: doc.background ?? "#ffffff" });
    return svgThumbnail(svg ?? `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="240"><rect width="320" height="240" fill="#ffffff"/></svg>`);
  }, [doc.layers, doc.background]);
  const status = useAutosave(work.id, saveData, thumb);
  // last save time of the chart itself (view-only saves keep the stamp)
  const prevStatus = useRef(status);
  const initialDoc = useRef(doc);
  useEffect(() => {
    if (prevStatus.current === "saving" && status === "saved" && doc !== initialDoc.current) setSavedAt(Date.now());
    prevStatus.current = status;
  }, [status, doc]);
  const rename = useCallback(
    (t: string) => {
      setTitle(t);
      works.update(work.id, { title: t, updatedAt: Date.now() });
    },
    [work.id],
  );
  const openPalette = useCallback((t: LeftTab) => {
    setTab(t);
    setPaletteOpen(true);
  }, []);

  // ---------- canvas size, initial view, responsive ----------

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setSize({ w: e.contentRect.width, h: e.contentRect.height }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // first-run tour ("코바늘 도안 만들기"), once per browser
  useEffect(() => {
    const raf = requestAnimationFrame(() => {
      if (!tourSeen.maker("crochet")) setTour(true);
    });
    return () => cancelAnimationFrame(raf);
  }, []);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 1023px)");
    const on = () => {
      narrowRef.current = mq.matches;
      setNarrow(mq.matches);
      if (mq.matches) setPaletteOpen(false);
    };
    on();
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);

  const fitTo = useCallback(
    (b: Box | null) => {
      const el = svgRef.current;
      if (!el) return;
      const W = el.clientWidth, H = Math.max(120, el.clientHeight - BOTTOM_CHROME);
      if (!b) {
        setView({ x: Math.round(W / 2), y: Math.round(H / 2), zoom: 1 });
        return;
      }
      const pad = 72;
      const bw = Math.max(b.x1 - b.x0, 40), bh = Math.max(b.y1 - b.y0, 40);
      const zoom = clampZoom(Math.min((W - pad * 2) / bw, (H - pad * 2) / bh, 2.5));
      const c = boxCenter(b);
      setView({ x: W / 2 - c.x * zoom, y: H / 2 - c.y * zoom, zoom });
    },
    [],
  );
  const fitAll = useCallback(() => fitTo(unionBounds(h.get().layers.filter((l) => l.visible).flatMap((l) => l.items))), [fitTo, h]);

  const didInitView = useRef(false);
  useEffect(() => {
    if (didInitView.current || !size.w) return;
    didInitView.current = true;
    const v = init.view;
    if (v.x === 0 && v.y === 0 && v.zoom === 1) fitAll();
  }, [size.w, init.view, fitAll]);

  // ---------- coordinates ----------

  const toWorld = useCallback((clientX: number, clientY: number): Pt => {
    const r = svgRef.current!.getBoundingClientRect();
    const v = viewRef.current;
    return { x: (clientX - r.left - v.x) / v.zoom, y: (clientY - r.top - v.y) / v.zoom };
  }, []);

  const zoomAt = useCallback((sx: number, sy: number, factor: number) => {
    setView((v) => {
      const zoom = clampZoom(v.zoom * factor);
      const k = zoom / v.zoom;
      return { zoom, x: sx - (sx - v.x) * k, y: sy - (sy - v.y) * k };
    });
  }, []);
  const zoomCenter = useCallback(
    (factor: number) => {
      const el = svgRef.current;
      if (el) zoomAt(el.clientWidth / 2, el.clientHeight / 2, factor);
    },
    [zoomAt],
  );

  // wheel: pan, ⌘/Ctrl (and pinch) zooms around the pointer
  useEffect(() => {
    const el = svgRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 400 : 1;
      if (e.ctrlKey || e.metaKey) {
        const r = el.getBoundingClientRect();
        const dy = Math.max(-60, Math.min(60, e.deltaY * unit));
        zoomAt(e.clientX - r.left, e.clientY - r.top, Math.exp(-dy * 0.01));
      } else {
        const dx = e.shiftKey && !e.deltaX ? e.deltaY : e.deltaX;
        const dy = e.shiftKey && !e.deltaX ? 0 : e.deltaY;
        setView((v) => ({ ...v, x: v.x - dx * unit, y: v.y - dy * unit }));
      }
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [zoomAt]);

  // ---------- mode ----------

  const commitPen = useCallback(
    (closed = false) => {
      const pts = penRef.current;
      const clean = pts.filter((p, i) => i === 0 || p[0] !== pts[i - 1][0] || p[1] !== pts[i - 1][1]);
      if (clean.length >= 2) {
        const d = h.get();
        const layer = d.layers.find((l) => l.id === d.activeLayerId);
        const item: CrochetItem = { id: uid(), type: "stroke", points: clean, closed: closed || undefined, width: STROKE_WIDTH, dash: "solid", ...(layer?.color ? { color: layer.color } : {}) };
        h.set(addItems(d, d.activeLayerId, [item]));
      }
      setPenPts([]);
    },
    [h, setPenPts],
  );

  const setMode = useCallback(
    (m: Mode) => {
      if (m !== "pen") commitPen();
      if (m !== "select") setPathEdit(null);
      setLinear(null);
      setRadial(null);
      setAssignSlot(null);
      setHover(null);
      if (m === "number") {
        // continue after the largest round number already on the chart
        let max = 0;
        for (const l of h.get().layers) for (const it of l.items) if (it.type === "text" && /^\d+$/.test(it.text)) max = Math.max(max, Number(it.text));
        setNumberNext(max + 1);
        numberStack.current = [];
      }
      setModeState(m);
    },
    [commitPen, h, setPathEdit],
  );

  const pick = useCallback(
    (p: Picked) => {
      if (assignSlot !== null) {
        const slot = assignSlot;
        h.set((d) => ({ ...d, quickSlots: d.quickSlots.map((v, i) => (i === slot ? pickToSlot(p) : v)) }));
        setAssignSlot(null);
        toast(`슬롯 ${slot + 1}에 「${pickName(p)}」을(를) 등록했어요`);
      }
      setPicked(p);
      if (narrowRef.current) setPaletteOpen(false);
      setModeState((m) => (m === "linear" || m === "radial" ? m : "insert"));
      setLinear((l) => (l && l.final ? l : null));
    },
    [assignSlot, h, toast],
  );

  // ---------- edits ----------

  const expandGroups = useCallback((ids: string[]) => {
    const d = h.get();
    const groups = new Set<string>();
    const set = new Set(ids);
    for (const l of d.layers) for (const it of l.items) if (set.has(it.id) && it.groupId) groups.add(it.groupId);
    if (!groups.size) return ids;
    const out = [...ids];
    for (const l of d.layers) for (const it of l.items) if (it.groupId && groups.has(it.groupId) && !set.has(it.id)) out.push(it.id);
    return out;
  }, [h]);

  const editSel = useCallback(
    (fn: (it: CrochetItem) => CrochetItem | null) => {
      const ids = new Set(selRef.current);
      if (!ids.size) return;
      h.set((d) => mapItems(d, ids, fn));
    },
    [h],
  );

  const selCenter = useCallback((): Pt | null => {
    const ids = new Set(selRef.current);
    const items = h.get().layers.flatMap((l) => l.items.filter((it) => ids.has(it.id)));
    const b = unionBounds(items);
    return b ? boxCenter(b) : null;
  }, [h]);

  const rotateSel = useCallback(
    (deg: number) => {
      const c = selCenter();
      if (c) editSel((it) => rotateItem(it, c, deg));
    },
    [editSel, selCenter],
  );
  const flipSel = useCallback(
    (axis: "h" | "v") => {
      const c = selCenter();
      if (c) editSel((it) => flipItem(it, axis, c));
    },
    [editSel, selCenter],
  );
  const deleteSel = useCallback(() => {
    if (!selRef.current.length) return;
    editSel(() => null);
    setSelection([]);
  }, [editSel, setSelection]);

  const selectedDocOrder = useCallback(() => {
    const ids = new Set(selRef.current);
    return h.get().layers.flatMap((l) => l.items.filter((it) => ids.has(it.id)));
  }, [h]);

  const copySel = useCallback(() => {
    const items = selectedDocOrder();
    if (!items.length) return false;
    try {
      localStorage.setItem(CLIP_KEY, JSON.stringify(items));
    } catch {
      /* ignore */
    }
    pasteCount.current = 0;
    return true;
  }, [selectedDocOrder]);

  const paste = useCallback(() => {
    let items: CrochetItem[] = [];
    try {
      items = JSON.parse(localStorage.getItem(CLIP_KEY) ?? "[]");
    } catch {
      items = [];
    }
    if (!items.length) return;
    pasteCount.current += 1;
    const off = 20 * pasteCount.current;
    const copies = cloneItems(items, off, off);
    h.set((d) => addItems(d, d.activeLayerId, copies));
    setSelection(copies.map((c) => c.id));
  }, [h, setSelection]);

  const duplicateSel = useCallback(() => {
    const items = selectedDocOrder();
    if (!items.length) return;
    const d = h.get();
    // repeat the offset of the previous duplicate if it was moved
    let dx = 20, dy = 20;
    const ld = lastDup.current;
    if (ld && selRef.current.includes(ld.copy)) {
      const src = findItem(d, ld.src)?.item, cp = findItem(d, ld.copy)?.item;
      if (src && cp) {
        const a = itemAnchor(src), b = itemAnchor(cp);
        dx = b.x - a.x;
        dy = b.y - a.y;
      }
    }
    const ids = new Set(items.map((i) => i.id));
    const newIds: string[] = [];
    const layers = d.layers.map((l) => {
      const mine = l.items.filter((it) => ids.has(it.id));
      if (!mine.length) return l;
      const copies = cloneItems(mine, dx, dy);
      newIds.push(...copies.map((c) => c.id));
      return { ...l, items: [...l.items, ...copies] };
    });
    h.set({ ...d, layers });
    lastDup.current = { src: items[0].id, copy: newIds[0] };
    setSelection(newIds);
  }, [h, selectedDocOrder, setSelection]);

  const groupSel = useCallback(() => {
    if (selRef.current.length < 2) return;
    const g = uid();
    editSel((it) => ({ ...it, groupId: g }));
    toast("그룹을 만들었어요");
  }, [editSel, toast]);
  const ungroupSel = useCallback(() => {
    editSel((it) => {
      if (!it.groupId) return it;
      const c = { ...it };
      delete c.groupId;
      return c;
    });
  }, [editSel]);

  const openRegister = useCallback(() => {
    if (!selRef.current.length) {
      toast("등록할 기호나 선을 선택한 뒤 다시 눌러 주세요");
      return;
    }
    setRegisterName(`기호 ${myIcons.list().length + 1}`);
    setRegisterOpen(true);
  }, [toast]);
  const confirmRegister = () => {
    const name = registerName.trim();
    if (!name) return toast("이름을 입력해 주세요");
    const icon = myIcons.add(name.slice(0, 30), selectedDocOrder());
    setRegisterOpen(false);
    if (icon) {
      toast(`「${icon.name}」을(를) 내 기호에 등록했어요`);
      setTab("mine");
    }
  };

  // increase / decrease
  const legStitches = useCallback(
    () => selectedDocOrder().filter((it): it is StitchItem => it.type === "stitch" && !!getSymbol(it.symbol)?.leg),
    [selectedDocOrder],
  );
  const mergeGather = useCallback(
    (kind: "increase" | "decrease") => {
      const legs = legStitches();
      if (legs.length < 2) return;
      const counts = new Map<string, number>();
      legs.forEach((l) => counts.set(l.symbol, (counts.get(l.symbol) ?? 0) + 1));
      const leg = [...counts].sort((a, b) => b[1] - a[1])[0][0];
      const cx0 = legs.reduce((s, l) => s + l.x, 0) / legs.length;
      const cy0 = legs.reduce((s, l) => s + l.y, 0) / legs.length;
      const sx = legs.reduce((s, l) => s + Math.sin((l.rotation * Math.PI) / 180), 0);
      const cy = legs.reduce((s, l) => s + Math.cos((l.rotation * Math.PI) / 180), 0);
      const rotation = normDeg((Math.atan2(sx, cy) * 180) / Math.PI);
      const d = h.get();
      const layerId = findItem(d, legs[0].id)!.layer.id;
      const g: GatherItem = {
        id: uid(),
        type: "gather",
        kind,
        symbol: leg,
        count: Math.min(9, legs.length),
        x: Math.round(cx0 * 100) / 100,
        y: Math.round(cy0 * 100) / 100,
        rotation,
        spread: defaultSpread(leg, Math.min(9, legs.length)),
        ...(legs[0].color ? { color: legs[0].color } : {}),
      };
      const ids = new Set(legs.map((l) => l.id));
      h.set(addItems(mapItems(d, ids, () => null), layerId, [g]));
      setSelection([g.id]);
      toast(kind === "increase" ? `${legs.length}코 늘려뜨기로 합쳤어요` : `${legs.length}코 모아뜨기로 합쳤어요`);
    },
    [h, legStitches, setSelection, toast],
  );
  const convertGather = useCallback(
    (kind: "increase" | "decrease", count: number) => {
      const st = legStitches()[0];
      if (!st) return;
      const g: GatherItem = { id: uid(), type: "gather", kind, symbol: st.symbol, count, x: st.x, y: st.y, rotation: st.rotation, spread: defaultSpread(st.symbol, count), ...(st.color ? { color: st.color } : {}), ...(st.groupId ? { groupId: st.groupId } : {}) };
      h.set((d) => mapItems(d, new Set([st.id]), () => g));
      setSelection([g.id]);
    },
    [h, legStitches, setSelection],
  );
  const splitGather = useCallback(() => {
    const gathers = selectedDocOrder().filter((it): it is GatherItem => it.type === "gather");
    if (!gathers.length) return;
    const newIds: string[] = [];
    const map = new Map<string, CrochetItem[]>();
    for (const g of gathers) {
      const s = getSymbol(g.symbol);
      const w = s?.w ?? 20;
      const r = (g.rotation * Math.PI) / 180;
      const parts = Array.from({ length: g.count }, (_, i) => {
        const off = (i - (g.count - 1) / 2) * w;
        const st: StitchItem = { id: uid(), type: "stitch", symbol: g.symbol, x: Math.round((g.x + off * Math.cos(r)) * 100) / 100, y: Math.round((g.y + off * Math.sin(r)) * 100) / 100, rotation: g.rotation, ...(g.color ? { color: g.color } : {}) };
        newIds.push(st.id);
        return st;
      });
      map.set(g.id, parts);
    }
    h.set((d) => ({ ...d, layers: d.layers.map((l) => (l.items.some((it) => map.has(it.id)) ? { ...l, items: l.items.flatMap((it) => map.get(it.id) ?? [it]) } : l)) }));
    setSelection(newIds);
  }, [h, selectedDocOrder, setSelection]);

  const deleteVertex = useCallback(
    (i: number) => {
      const id = pathEditRef.current;
      if (!id) return;
      const found = findItem(h.get(), id);
      if (!found || found.item.type !== "stroke") return;
      if (found.item.points.length <= 2) {
        toast("점이 두 개 남은 선은 더 지울 수 없어요");
        return;
      }
      h.set((d) =>
        mapItems(d, new Set([id]), (it) => {
          if (it.type !== "stroke") return it;
          const next: StrokeItem = { ...it, points: it.points.filter((_, j) => j !== i) };
          if (next.closed && next.points.length < 3) delete next.closed;
          return next;
        }),
      );
      setPathVertex(null);
    },
    [h, toast],
  );

  const selectAll = useCallback(() => {
    const d = h.get();
    const ids = d.layers.filter((l) => l.visible && !l.locked && (!activeOnly || l.id === d.activeLayerId)).flatMap((l) => l.items.map((i) => i.id));
    setSelection(ids);
    if (mode !== "select") setMode("select");
  }, [activeOnly, h, mode, setMode, setSelection]);

  const nudge = useCallback((dx: number, dy: number) => editSel((it) => moveItem(it, dx, dy)), [editSel]);

  const takeSlot = useCallback(
    (i: number) => {
      const p = slotToPick(h.get().quickSlots[i] ?? null);
      if (!p || !templateFor(p)) {
        setAssignSlot(i);
        openPalette("symbols");
        return;
      }
      setPicked(p);
      setModeState((m) => (m === "linear" || m === "radial" ? m : "insert"));
    },
    [h],
  );

  // ---------- layer / property actions (stable) ----------

  const layerActions = useMemo<LayerActions>(
    () => ({
      add: () => {
        const d = h.get();
        const active = d.layers.find((l) => l.id === d.activeLayerId);
        const scope = active?.folderId ? d.layers.filter((l) => l.folderId === active.folderId) : d.layers.filter((l) => !l.folderId);
        const layer: CrochetLayer = { id: uid(), name: nextLayerName(scope.length ? scope : d.layers), visible: true, items: [], ...(active?.folderId ? { folderId: active.folderId } : {}) };
        const i = d.layers.findIndex((l) => l.id === d.activeLayerId);
        const layers = [...d.layers];
        layers.splice(i + 1, 0, layer);
        h.set({ ...d, layers, activeLayerId: layer.id });
      },
      rename: (id, name) => h.set((d) => ({ ...d, layers: d.layers.map((l) => (l.id === id ? { ...l, name } : l)) })),
      toggle: (id) => h.set((d) => ({ ...d, layers: d.layers.map((l) => (l.id === id ? { ...l, visible: !l.visible } : l)) })),
      remove: (id) =>
        h.set((d) => {
          if (d.layers.length <= 1) return d;
          const i = d.layers.findIndex((l) => l.id === id);
          const layers = d.layers.filter((l) => l.id !== id);
          const activeLayerId = d.activeLayerId === id ? layers[Math.max(0, i - 1)].id : d.activeLayerId;
          return { ...d, layers, activeLayerId };
        }),
      move: (id, to) =>
        h.set((d) => {
          const from = d.layers.findIndex((l) => l.id === id);
          const t = Math.max(0, Math.min(d.layers.length - 1, to));
          if (from < 0 || from === t) return d;
          const layers = [...d.layers];
          const [l] = layers.splice(from, 1);
          layers.splice(t, 0, l);
          return { ...d, layers };
        }),
      activate: (id) => h.set((d) => (d.activeLayerId === id ? d : { ...d, activeLayerId: id })),
      setColor: (id, color) => h.set((d) => ({ ...d, layers: d.layers.map((l) => (l.id === id ? { ...l, color } : l)) })),
      place: (id, to, folderId) =>
        h.set((d) => {
          const from = d.layers.findIndex((l) => l.id === id);
          if (from < 0) return d;
          const layers = [...d.layers];
          const [l] = layers.splice(from, 1);
          const moved: CrochetLayer = { ...l };
          if (folderId) moved.folderId = folderId;
          else delete moved.folderId;
          layers.splice(Math.max(0, Math.min(layers.length, to)), 0, moved);
          return { ...d, layers };
        }),
      addFolder: () => {
        const d = h.get();
        const f: CrochetFolder = { id: uid(), name: nextFolderName(d) };
        const active = d.layers.find((l) => l.id === d.activeLayerId);
        // the active layer goes into the new folder when it is not in one yet
        const layers = active && !active.folderId ? d.layers.map((l) => (l.id === active.id ? { ...l, folderId: f.id } : l)) : d.layers;
        h.set({ ...d, folders: [...(d.folders ?? []), f], layers });
        toast(active && !active.folderId ? `「${f.name}」을(를) 만들고 ${active.name}을(를) 넣었어요` : `「${f.name}」을(를) 만들었어요`);
      },
      renameFolder: (id, name) => h.set((d) => ({ ...d, folders: (d.folders ?? []).map((f) => (f.id === id ? { ...f, name } : f)) })),
      toggleFolder: (id) =>
        h.set((d) => {
          const members = d.layers.filter((l) => l.folderId === id);
          if (!members.length) return d;
          const show = !members.some((l) => l.visible);
          return { ...d, layers: d.layers.map((l) => (l.folderId === id ? { ...l, visible: show } : l)) };
        }),
      collapseFolder: (id) => h.set((d) => ({ ...d, folders: (d.folders ?? []).map((f) => (f.id === id ? { ...f, collapsed: !f.collapsed } : f)) })),
      ungroupFolder: (id) =>
        h.set((d) => ({
          ...d,
          folders: (d.folders ?? []).filter((f) => f.id !== id),
          layers: d.layers.map((l) => {
            if (l.folderId !== id) return l;
            const c = { ...l };
            delete c.folderId;
            return c;
          }),
        })),
      deleteFolder: (id) =>
        h.set((d) => {
          const layers = d.layers.filter((l) => l.folderId !== id);
          const activeLayerId = layers.some((l) => l.id === d.activeLayerId) ? d.activeLayerId : (layers[layers.length - 1]?.id ?? "");
          return { ...d, folders: (d.folders ?? []).filter((f) => f.id !== id), layers, activeLayerId };
        }),
      moveToFolder: (layerId, folderId) =>
        h.set((d) => {
          const from = d.layers.findIndex((l) => l.id === layerId);
          if (from < 0 || (d.layers[from].folderId ?? null) === folderId) return d;
          const layers = [...d.layers];
          const [l] = layers.splice(from, 1);
          const moved: CrochetLayer = { ...l };
          if (folderId) moved.folderId = folderId;
          else delete moved.folderId;
          // keep a folder's layers next to each other, in their stacking order:
          // a layer from below joins under the folder's lowest layer, one from above over its top-most
          let at = from;
          if (folderId) {
            const ids = layers.map((x) => x.folderId);
            const first = ids.indexOf(folderId), last = ids.lastIndexOf(folderId);
            if (first >= 0) at = from <= first ? first : from > last ? last + 1 : from;
          }
          layers.splice(at, 0, moved);
          return { ...d, layers };
        }),
      newFolderWith: (layerId) => {
        const d = h.get();
        const f: CrochetFolder = { id: uid(), name: nextFolderName(d) };
        h.set({ ...d, folders: [...(d.folders ?? []), f], layers: d.layers.map((l) => (l.id === layerId ? { ...l, folderId: f.id } : l)) });
      },
    }),
    [h, toast],
  );

  const propActions = useMemo<PropActions>(
    () => ({
      recolor: (color) => editSel((it) => ({ ...it, color })),
      setRotation: (deg) => editSel((it) => (it.type === "stitch" || it.type === "gather" ? { ...it, rotation: normDeg(deg) } : it)),
      setScale: (s) => editSel((it) => (it.type === "stitch" && getSymbol(it.symbol)?.stretch ? { ...it, scale: Math.round(s * 100) / 100 } : it)),
      setGather: (patch) => editSel((it) => (it.type === "gather" ? { ...it, ...patch } : it)),
      setText: (patch) => editSel((it) => (it.type === "text" ? { ...it, ...patch } : it)),
      setStroke: (patch) => editSel((it) => (it.type === "stroke" ? { ...it, ...patch } : it)),
      flip: flipSel,
      remove: deleteSel,
      group: groupSel,
      ungroup: ungroupSel,
    }),
    [deleteSel, editSel, flipSel, groupSel, ungroupSel],
  );

  // ---------- pointer ----------

  const snapPt = (p: Pt, on: boolean): Pt => ({ x: snap(p.x, on), y: snap(p.y, on) });

  const placeAt = (p: Pt) => {
    if (!template) {
      toast("왼쪽에서 기호·도형·컴포넌트를 선택하세요");
      return;
    }
    const d = h.get();
    const layer = d.layers.find((l) => l.id === d.activeLayerId);
    if (layer && !layer.visible) {
      toast("숨긴 레이어에는 놓을 수 없어요. 레이어를 표시해 주세요");
      return;
    }
    const items = placeTemplate(template.items, { x: p.x, y: p.y, rotation: 0 });
    h.set(addItems(d, d.activeLayerId, items));
  };

  const placeNumber = (p: Pt) => {
    const d = h.get();
    const t: TextItem = { id: uid(), type: "text", text: String(numberNext), x: Math.round(p.x), y: Math.round(p.y), size: 14, color: NUMBER_COLOR };
    h.set(addItems(d, d.activeLayerId, [t]));
    numberStack.current.push(t.id);
    setNumberNext((n) => n + 1);
  };

  const undoLastNumber = () => {
    const id = numberStack.current.pop();
    if (!id) return;
    h.set((d) => mapItems(d, new Set([id]), () => null));
    setNumberNext((n) => Math.max(1, n - 1));
  };

  const applyLinear = useCallback(() => {
    if (!linear || !template) return;
    const pl = linearPlacements(linear.a, linear.b, linear.count, template.h);
    const items = pl.flatMap((p) => placeTemplate(template.items, p));
    h.set((d) => addItems(d, d.activeLayerId, items));
    setLinear(null);
    toast(`${pl.length}개를 놓았어요`);
  }, [h, linear, template, toast]);

  const applyRadial = useCallback(() => {
    if (!radial || !template) return;
    const pl = radialPlacements(radial.c, radial.rx, radial.ry, radial.count, template.h);
    const items = pl.flatMap((p) => placeTemplate(template.items, p));
    h.set((d) => addItems(d, d.activeLayerId, items));
    setRadial(null);
    toast(`${pl.length}개를 원형으로 놓았어요`);
  }, [h, radial, template, toast]);

  const onPointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    if (e.button === 2) return;
    setCtx(null);
    const svg = svgRef.current!;
    const v = viewRef.current;
    if (e.button === 1 || spaceRef.current || mode === "pan") {
      e.preventDefault();
      svg.setPointerCapture(e.pointerId);
      dragRef.current = { k: "pan", sx: e.clientX, sy: e.clientY, vx: v.x, vy: v.y };
      setPanning(true);
      return;
    }
    if (e.button !== 0) return;
    const P = toWorld(e.clientX, e.clientY);
    const target = e.target as Element;
    const snapOn = !isMod(e);
    svg.setPointerCapture(e.pointerId);

    if (mode === "select" && pathEditRef.current) {
      const id = pathEditRef.current;
      const found = findItem(h.get(), id);
      const vtx = target.closest("[data-vertex]")?.getAttribute("data-vertex");
      const seg = target.closest("[data-seg]")?.getAttribute("data-seg");
      if (found?.item.type === "stroke") {
        if (vtx != null) {
          const i = Number(vtx);
          // Alt+click or a second press on the same point deletes it (pointer capture hides dblclick targets)
          const last = lastVertexDown.current;
          lastVertexDown.current = { i, t: e.timeStamp };
          if (e.altKey || (last && last.i === i && e.timeStamp - last.t < 450)) {
            lastVertexDown.current = null;
            deleteVertex(i);
            return;
          }
          setPathVertex(i);
          dragRef.current = { k: "vertex", id, i, started: false };
          return;
        }
        if (seg != null) {
          const i = Number(seg);
          const q = snapPt(P, snapOn);
          h.set((d) => mapItems(d, new Set([id]), (it) => (it.type === "stroke" ? { ...it, points: [...it.points.slice(0, i + 1), [q.x, q.y] as [number, number], ...it.points.slice(i + 1)] } : it)));
          setPathVertex(i + 1);
          // the insert is the undo step; dragging the new point folds into it
          dragRef.current = { k: "vertex", id, i: i + 1, started: true };
          return;
        }
        if (target.closest("[data-id]")?.getAttribute("data-id") === id) return;
      }
      setPathEdit(null);
    }
    if (mode === "select") {
      const handle = target.closest("[data-handle]")?.getAttribute("data-handle");
      if (handle === "rotate" && selBounds) {
        const c = boxCenter(selBounds);
        dragRef.current = { k: "rotate", center: c, startAngle: Math.atan2(P.y - c.y, P.x - c.x), orig: new Map(selItems.map((i) => [i.id, i])), started: false };
        return;
      }
      if (handle === "stretch" && selItems.length === 1 && selItems[0].type === "stitch") {
        const st = selItems[0];
        const s = getSymbol(st.symbol)!;
        dragRef.current = { k: "stretch", orig: st, base: s.stretch === "h" ? s.w : s.h * heightFactor(s.id), axis: s.stretch === "h" ? "h" : "v", started: false };
        return;
      }
      const hitId = target.closest("[data-id]")?.getAttribute("data-id");
      const hit = hitId ? index.get(hitId) : undefined;
      if (hit && editable(hit.layer)) {
        const hitIds = expandGroups([hit.item.id]);
        const cur = new Set(selRef.current);
        const wasSelected = cur.has(hit.item.id);
        let next: string[];
        if (e.shiftKey) next = wasSelected ? selRef.current : [...selRef.current, ...hitIds.filter((i) => !cur.has(i))];
        else next = wasSelected ? selRef.current : hitIds;
        setSelection(next);
        dragRef.current = { k: "move", sx: e.clientX, sy: e.clientY, start: P, ids: next, hitIds, anchor: itemAnchor(hit.item), orig: null, alt: e.altKey, shift: e.shiftKey, wasSelected };
      } else {
        dragRef.current = { k: "marquee", start: P, add: e.shiftKey, base: e.shiftKey ? selRef.current : [] };
        if (!e.shiftKey) setSelection([]);
        setMarquee({ a: P, b: P });
      }
      return;
    }
    if (mode === "insert") {
      placeAt(snapPt(P, snapOn));
      return;
    }
    if (mode === "number") {
      placeNumber(P);
      return;
    }
    if (mode === "pen") {
      const q = snapPt(P, snapOn);
      if (pen.length >= 3) {
        const [fx, fy] = pen[0];
        if (Math.hypot(fx - q.x, fy - q.y) * v.zoom < 10) {
          commitPen(true);
          return;
        }
      }
      setPenPts([...penRef.current, [q.x, q.y]]);
      return;
    }
    if (mode === "linear" || mode === "radial") {
      if (!template) {
        toast("왼쪽에서 기호·도형·컴포넌트를 선택하세요");
        return;
      }
      if (mode === "linear") {
        const a = snapPt(P, snapOn);
        dragRef.current = { k: "linear", a };
        setLinear({ a, b: a, count: 1, final: false });
      } else {
        // starting on a magic ring centres the round on it
        let start = snapPt(P, snapOn);
        let fromCenter = e.altKey;
        for (const l of h.get().layers) {
          if (!l.visible) continue;
          for (const it of l.items) {
            if (it.type === "stitch" && (it.symbol === "magic_ring" || it.symbol === "mr") && Math.hypot(it.x - P.x, it.y - P.y) < 18) {
              start = { x: it.x, y: it.y };
              fromCenter = true;
            }
          }
        }
        dragRef.current = { k: "radial", start, fromCenter };
        setRadial({ c: start, rx: 0, ry: 0, count: 3, final: false });
      }
    }
  };

  const onPointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const d = dragRef.current;
    const P = toWorld(e.clientX, e.clientY);
    if (!d) {
      if (mode === "insert" || mode === "pen" || mode === "number" || ((mode === "linear" || mode === "radial") && !linear?.final && !radial?.final)) {
        setHover(mode === "insert" ? snapPt(P, !isMod(e)) : P);
      }
      return;
    }
    const snapOn = !isMod(e);
    switch (d.k) {
      case "pan":
        setView((v) => ({ ...v, x: d.vx + (e.clientX - d.sx), y: d.vy + (e.clientY - d.sy) }));
        return;
      case "move": {
        if (!d.orig) {
          if (Math.hypot(e.clientX - d.sx, e.clientY - d.sy) < 3) return;
          h.checkpoint();
          let ids = d.ids;
          if (d.alt) {
            const cur = h.get();
            const idSet = new Set(ids);
            const newIds: string[] = [];
            const layers = cur.layers.map((l) => {
              const mine = l.items.filter((it) => idSet.has(it.id));
              if (!mine.length) return l;
              const copies = cloneItems(mine);
              newIds.push(...copies.map((c) => c.id));
              return { ...l, items: [...l.items, ...copies] };
            });
            h.set({ ...cur, layers }, { merge: true });
            ids = newIds;
            d.ids = newIds;
            setSelection(newIds);
          }
          const cur = h.get();
          const want = new Set(ids);
          d.orig = new Map(cur.layers.flatMap((l) => l.items.filter((it) => want.has(it.id)).map((it) => [it.id, it] as const)));
        }
        const ax = snap(d.anchor.x + P.x - d.start.x, snapOn) - d.anchor.x;
        const ay = snap(d.anchor.y + P.y - d.start.y, snapOn) - d.anchor.y;
        const orig = d.orig;
        h.set((doc) => mapItems(doc, new Set(orig.keys()), (it) => moveItem(orig.get(it.id)!, ax, ay)), { merge: true });
        return;
      }
      case "marquee":
        setMarquee((m) => (m ? { a: m.a, b: P } : m));
        return;
      case "vertex": {
        const q = snapPt(P, snapOn);
        if (!d.started) {
          d.started = true;
          h.checkpoint();
        }
        h.set((doc) => mapItems(doc, new Set([d.id]), (it) => (it.type === "stroke" ? { ...it, points: it.points.map((p, j) => (j === d.i ? ([q.x, q.y] as [number, number]) : p)) } : it)), { merge: true });
        return;
      }
      case "rotate": {
        let deg = ((Math.atan2(P.y - d.center.y, P.x - d.center.x) - d.startAngle) * 180) / Math.PI;
        if (e.shiftKey) deg = Math.round(deg / 15) * 15;
        if (!d.started) {
          if (Math.abs(deg) < 0.5) return;
          d.started = true;
          h.checkpoint();
        }
        const orig = d.orig;
        h.set((doc) => mapItems(doc, new Set(orig.keys()), (it) => rotateItem(orig.get(it.id)!, d.center, deg)), { merge: true });
        return;
      }
      case "stretch": {
        const o = d.orig;
        const g0 = itemGeom(o);
        const { w, h: hh } = g0;
        const r = (o.rotation * Math.PI) / 180;
        const sV = o.flipV ? -1 : 1, sH = o.flipH ? -1 : 1;
        let dir: Pt, fixed: Pt;
        if (d.axis === "v") {
          dir = { x: Math.sin(r) * sV, y: -Math.cos(r) * sV };
          fixed = { x: o.x - dir.x * geomFoot(g0), y: o.y - dir.y * geomFoot(g0) };
        } else {
          dir = { x: Math.cos(r) * sH, y: Math.sin(r) * sH };
          fixed = { x: o.x - (dir.x * w) / 2, y: o.y - (dir.y * w) / 2 };
        }
        let L = (P.x - fixed.x) * dir.x + (P.y - fixed.y) * dir.y;
        let scale = Math.max(0.3, Math.min(8, L / d.base));
        if (snapOn) scale = d.axis === "h" ? Math.max(1, Math.round(scale)) : Math.round(scale * 4) / 4;
        L = scale * d.base;
        if (!d.started) {
          d.started = true;
          h.checkpoint();
        }
        // the new centre sits so the foot stays at `fixed` (기호 높이 lifts tall stitches, see geomFoot)
        const half = d.axis === "v" ? geomFoot(stitchGeom({ ...o, scale })) : L / 2;
        const next: StitchItem = { ...o, scale, x: Math.round((fixed.x + dir.x * half) * 100) / 100, y: Math.round((fixed.y + dir.y * half) * 100) / 100 };
        h.set((doc) => mapItems(doc, new Set([o.id]), () => next), { merge: true });
        return;
      }
      case "linear": {
        let b = snapPt(P, snapOn);
        if (e.shiftKey) {
          if (Math.abs(b.x - d.a.x) > Math.abs(b.y - d.a.y)) b = { x: b.x, y: d.a.y };
          else b = { x: d.a.x, y: b.y };
        }
        setLinear({ a: d.a, b, count: template ? linearAutoCount(d.a, b, template.w) : 2, final: false });
        return;
      }
      case "radial": {
        const q = snapPt(P, snapOn);
        let c: Pt, rx: number, ry: number;
        if (d.fromCenter) {
          c = d.start;
          rx = Math.abs(q.x - c.x);
          ry = Math.abs(q.y - c.y);
          if (e.shiftKey) rx = ry = Math.hypot(q.x - c.x, q.y - c.y);
        } else {
          let dx = q.x - d.start.x, dy = q.y - d.start.y;
          if (e.shiftKey) {
            const m = Math.max(Math.abs(dx), Math.abs(dy));
            dx = Math.sign(dx || 1) * m;
            dy = Math.sign(dy || 1) * m;
          }
          c = { x: d.start.x + dx / 2, y: d.start.y + dy / 2 };
          rx = Math.abs(dx) / 2;
          ry = Math.abs(dy) / 2;
        }
        setRadial({ c, rx, ry, count: template ? radialAutoCount(rx, ry, template.w) : 6, final: false });
        return;
      }
    }
  };

  const onPointerUp = (e: React.PointerEvent<SVGSVGElement>) => {
    const d = dragRef.current;
    dragRef.current = null;
    try {
      svgRef.current?.releasePointerCapture(e.pointerId);
    } catch {
      /* not captured */
    }
    if (!d) return;
    switch (d.k) {
      case "pan":
        setPanning(false);
        return;
      case "vertex":
        return;
      case "move":
        if (!d.orig) {
          // plain click on an already selected item
          if (d.shift && d.wasSelected) setSelection(selRef.current.filter((id) => !d.hitIds.includes(id)));
          else if (!d.shift && d.wasSelected && selRef.current.length > d.hitIds.length) setSelection(d.hitIds);
        }
        return;
      case "marquee": {
        const m = marquee;
        setMarquee(null);
        if (!m) return;
        const x0 = Math.min(m.a.x, m.b.x), x1 = Math.max(m.a.x, m.b.x), y0 = Math.min(m.a.y, m.b.y), y1 = Math.max(m.a.y, m.b.y);
        if ((x1 - x0) * viewRef.current.zoom < 3 && (y1 - y0) * viewRef.current.zoom < 3) return;
        const hits: string[] = [];
        for (const l of h.get().layers) {
          if (!editable(l)) continue;
          for (const it of l.items) {
            const c = boxCenter(itemBounds(it));
            if (c.x >= x0 && c.x <= x1 && c.y >= y0 && c.y <= y1) hits.push(it.id);
          }
        }
        const all = expandGroups(hits);
        const base = new Set(d.base);
        setSelection([...d.base, ...all.filter((i) => !base.has(i))]);
        return;
      }
      case "linear":
        setLinear((l) => {
          if (!l || !template) return null;
          if (Math.hypot(l.b.x - l.a.x, l.b.y - l.a.y) < 8) return null;
          return { ...l, final: true };
        });
        setHover(null);
        return;
      case "radial":
        setRadial((r) => {
          if (!r || Math.max(r.rx, r.ry) < 4) return null;
          return { ...r, final: true };
        });
        setHover(null);
        return;
    }
  };

  const onContextMenu = (e: React.MouseEvent<SVGSVGElement>) => {
    e.preventDefault();
    if (mode === "pen" && pen.length >= 2) {
      commitPen();
      return;
    }
    const hitId = (e.target as Element).closest("[data-id]")?.getAttribute("data-id");
    const hit = hitId ? index.get(hitId) : undefined;
    if (hit && editable(hit.layer)) {
      if (!selRef.current.includes(hit.item.id)) setSelection(expandGroups([hit.item.id]));
      if (mode !== "select") setModeState("select");
    }
    setCtx({ x: e.clientX, y: e.clientY });
  };

  const onDoubleClick = () => {
    if (mode === "pen" && pen.length >= 2) commitPen();
  };

  // ---------- keyboard ----------

  const keyRef = useRef<(e: KeyboardEvent) => void>(() => {});
  keyRef.current = (e: KeyboardEvent) => {
    if (registerOpen || deleteIconId) return;
    if (document.querySelector("dialog[open]")) return;
    const k = e.key;
    const lower = k.length === 1 ? k.toLowerCase() : k;
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
          deleteSel();
        }
      } else if (lower === "v") {
        e.preventDefault();
        paste();
      } else if (lower === "d") {
        e.preventDefault();
        duplicateSel();
      } else if (lower === "a") {
        e.preventDefault();
        selectAll();
      } else if (lower === "g") {
        e.preventDefault();
        if (e.shiftKey) ungroupSel();
        else groupSel();
      } else if (k === "0") {
        e.preventDefault();
        fitAll();
      } else if (k === "=" || k === "+") {
        e.preventDefault();
        zoomCenter(1.25);
      } else if (k === "-") {
        e.preventDefault();
        zoomCenter(0.8);
      }
      return;
    }
    if (e.altKey) return;
    switch (k) {
      case "Escape":
        if (ctx) return setCtx(null);
        if (pathEditRef.current) return setPathEdit(null);
        if (pen.length) return setPenPts([]);
        if (linear) return setLinear(null);
        if (radial) return setRadial(null);
        if (assignSlot !== null) return setAssignSlot(null);
        if (mode !== "select") return setMode("select");
        setSelection([]);
        return;
      case "Enter":
        if (mode === "pen") return commitPen();
        if (linear?.final) return applyLinear();
        if (radial?.final) return applyRadial();
        return;
      case "Delete":
      case "Backspace":
        e.preventDefault();
        if (mode === "number") return undoLastNumber();
        if (mode === "pen" && pen.length) return setPenPts(penRef.current.slice(0, -1));
        if (pathEditRef.current && pathVertex !== null) return deleteVertex(pathVertex);
        deleteSel();
        return;
      case "ArrowLeft":
      case "ArrowRight":
      case "ArrowUp":
      case "ArrowDown": {
        if (!selRef.current.length) return;
        e.preventDefault();
        const s = e.shiftKey ? 10 : 1;
        nudge(k === "ArrowLeft" ? -s : k === "ArrowRight" ? s : 0, k === "ArrowUp" ? -s : k === "ArrowDown" ? s : 0);
        return;
      }
      case "?":
        setHelpOpen(true);
        return;
    }
    if (/^[1-5]$/.test(k)) return takeSlot(Number(k) - 1);
    switch (lower) {
      case "v":
        return e.shiftKey ? flipSel("v") : setMode("select");
      case "h":
        return e.shiftKey ? flipSel("h") : setMode("pan");
      case "e":
        return setMode("insert");
      case "p":
        return setMode("pen");
      case "l":
        return setMode("linear");
      case "o":
        return setMode("radial");
      case "n":
        return setMode("number");
      case "g":
        return h.set((d) => ({ ...d, showGrid: !d.showGrid }));
      case "m":
        return openRegister();
      case "r":
        return rotateSel(e.shiftKey ? -15 : 15);
    }
  };
  useEffect(() => {
    const typing = (t: EventTarget | null) => {
      const el = t as HTMLElement | null;
      return !!el && (el.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName));
    };
    const down = (e: KeyboardEvent) => {
      if (typing(e.target)) return;
      if (e.key === " ") {
        e.preventDefault();
        if (!spaceRef.current) {
          spaceRef.current = true;
          setSpace(true);
        }
        return;
      }
      keyRef.current(e);
    };
    const up = (e: KeyboardEvent) => {
      if (e.key === " ") {
        spaceRef.current = false;
        setSpace(false);
      }
    };
    const blur = () => {
      spaceRef.current = false;
      setSpace(false);
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", blur);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", blur);
    };
  }, []);

  // ---------- export ----------

  const onExport = useCallback(
    async (format: ExportFormat) => {
      const d = h.get();
      const name = safeName(works.get(work.id)?.title ?? work.title);
      if (format === "json") {
        if (!d.layers.some((l) => l.items.length)) return false;
        const file = { app: "patterners-clone", kind: "crochet-chart", version: 1, title: works.get(work.id)?.title ?? work.title, craft: "crochet", data: { ...d, view: viewRef.current } };
        download(new Blob([JSON.stringify(file, null, 2)], { type: "application/json" }), `${name}.json`);
        return true;
      }
      const opacity = (d.backgroundOpacity ?? 100) / 100;
      const bg = format === "svg" ? (d.background || opacity < 1 ? (d.background ?? DEFAULT_BG) : undefined) : format === "jpg" ? (d.background ?? DEFAULT_BG) : (d.background ?? DEFAULT_BG);
      const svg = buildSvg(d.layers, { background: bg, backgroundOpacity: format === "jpg" ? 1 : opacity });
      if (!svg) return false;
      await exportSvg(svg, format, name);
      return true;
    },
    [h, work.id, work.title],
  );

  // ---------- rail panels: templates, written import, assistant ----------

  const viewCenter = useCallback((): Pt => {
    const el = svgRef.current;
    const v = viewRef.current;
    const W = el?.clientWidth ?? 800, H = Math.max(120, (el?.clientHeight ?? 600) - BOTTOM_CHROME);
    return { x: Math.round((W / 2 - v.x) / v.zoom), y: Math.round((H / 2 - v.y) / v.zoom) };
  }, []);

  /** Selects freshly inserted layers and zooms out when they do not fit on screen. */
  const showInserted = useCallback(
    (layers: CrochetLayer[], select = true) => {
      const items = layers.flatMap((l) => l.items);
      if (select) {
        setSelection(items.map((i) => i.id));
        setModeState("select");
      }
      const b = unionBounds(items);
      const el = svgRef.current;
      if (!b || !el) return;
      const v = viewRef.current;
      const W = el.clientWidth, H = el.clientHeight - BOTTOM_CHROME;
      if ((b.x1 - b.x0) * v.zoom > W - 80 || (b.y1 - b.y0) * v.zoom > H - 80) fitTo(b);
      else if (b.x0 * v.zoom + v.x < 20 || b.x1 * v.zoom + v.x > W - 20 || b.y0 * v.zoom + v.y < 20 || b.y1 * v.zoom + v.y > H - 20) {
        // off screen but small enough: pan to it at the current zoom
        const c = boxCenter(b);
        setView({ ...v, x: W / 2 - c.x * v.zoom, y: H / 2 - c.y * v.zoom });
      }
    },
    [fitTo, setSelection],
  );

  const insertTemplate = useCallback(
    (t: (typeof TEMPLATES)[number], params: Record<string, number>) => {
      const res = insertChart(h.get(), t.build(params), { layout: t.layout, at: viewCenter(), name: t.name });
      if (!res.layers.length) return toast("넣지 못했어요. 다시 시도해 주세요.");
      h.set(res.doc);
      showInserted(res.layers);
      toast(`‘${t.name}’ 템플릿을 넣었어요. (${res.stitches}코)`);
      if (narrowRef.current) setPaletteOpen(false);
    },
    [h, showInserted, toast, viewCenter],
  );

  const saveVersion = useCallback((label?: string) => versions.save(work.id, { ...h.get(), view: viewRef.current }, label), [h, work.id]);

  const buildImport = useCallback(
    (res: ParseResult, o: ImportOptions) => {
      const cur = h.get();
      if (cur.layers.some((l) => l.items.length)) saveVersion("가져오기 전");
      const r = insertChart(cur, res.rounds, { layout: o.layout, at: viewCenter(), name: "서술도안", ring: o.ring, roundGap: o.roundGap, spacing: o.spacing });
      if (!r.layers.length) return toast("배치할 기호가 없어요.");
      h.set(r.doc);
      showInserted(r.layers);
      toast(`${res.rounds.filter((x) => !x.foundation).length}단 · ${r.stitches}코를 배치했어요`);
    },
    [h, saveVersion, showInserted, toast, viewCenter],
  );

  const importLayers = useCallback(
    (raw: CrochetLayer[], name: string) => {
      const ok = (it: CrochetItem) =>
        !!it && typeof it === "object" && (((it.type === "stitch" || it.type === "gather" || it.type === "text") && Number.isFinite((it as StitchItem).x) && Number.isFinite((it as StitchItem).y)) || (it.type === "stroke" && Array.isArray(it.points) && it.points.length >= 2));
      const layers = raw.map((l, i) => ({ id: String(l.id ?? i), name: typeof l.name === "string" ? l.name.slice(0, 30) : `${i + 1}단`, visible: l.visible !== false, ...(typeof l.color === "string" ? { color: l.color } : {}), items: (l.items ?? []).filter(ok) }));
      const count = layers.reduce((s, l) => s + l.items.length, 0);
      if (!count) return toast("가져올 기호가 없어요.");
      const cur = h.get();
      if (cur.layers.some((l) => l.items.length)) saveVersion("가져오기 전");
      const r = insertLayersAsFolder(cur, layers, name, viewCenter());
      h.set(r.doc);
      showInserted(r.doc.layers.slice(cur.layers.length));
      toast(`‘${name}’에서 레이어 ${layers.length}개, 기호 ${count}개를 가져왔어요`);
    },
    [h, saveVersion, showInserted, toast, viewCenter],
  );

  const sendChat = useCallback(
    (text: string) => {
      const r = interpret(text, { doc: h.get(), selection: selRef.current, center: viewCenter() });
      if (r.action === "undo") h.undo();
      else if (r.action === "redo") h.redo();
      else if (r.action === "fit") fitAll();
      if (r.doc) {
        const before = new Set(h.get().layers.map((l) => l.id));
        h.set(r.doc);
        const added = r.doc.layers.filter((l) => !before.has(l.id));
        if (added.length) showInserted(added, false);
      }
      if (r.select) {
        setSelection(r.select);
        if (r.select.length) setModeState("select");
      }
      setChat((c) => {
        const id = (c[c.length - 1]?.id ?? 0) + 1;
        return [...c, { id, role: "user", text }, { id: id + 1, role: "assistant", text: r.reply }];
      });
    },
    [fitAll, h, setSelection, showInserted, viewCenter],
  );

  // ---------- context menu ----------

  const ctxItems = useMemo<CtxItem[]>(() => {
    if (!ctx) return [];
    if (ctx.slot !== undefined) {
      const i = ctx.slot;
      return [
        { label: "슬롯 수정", onSelect: () => (setAssignSlot(i), openPalette("symbols")) },
        { label: "슬롯 해제", danger: true, onSelect: () => h.set((d) => ({ ...d, quickSlots: d.quickSlots.map((v, j) => (j === i ? null : v)) })) },
      ];
    }
    const items = selItems;
    const hasClip = (() => {
      try {
        return !!localStorage.getItem(CLIP_KEY);
      } catch {
        return false;
      }
    })();
    if (!items.length) {
      return [
        { label: "붙여넣기", shortcut: "⌘V", disabled: !hasClip, onSelect: paste },
        { label: "모두 선택", shortcut: "⌘A", onSelect: selectAll },
        { label: "화면에 맞추기", shortcut: "⌘0", onSelect: fitAll },
        "separator",
        { label: h.get().showGrid ? "점 격자 숨기기" : "점 격자 표시", shortcut: "G", onSelect: () => h.set((d) => ({ ...d, showGrid: !d.showGrid })) },
      ];
    }
    const legs = items.filter((it) => it.type === "stitch" && getSymbol(it.symbol)?.leg);
    const out: CtxItem[] = [];
    if (legs.length >= 2)
      out.push({
        label: "늘려뜨기·모아뜨기로 합치기",
        children: [
          { label: "늘려뜨기", onSelect: () => mergeGather("increase") },
          { label: "모아뜨기", onSelect: () => mergeGather("decrease") },
        ],
      });
    if (items.length === 1 && legs.length === 1)
      out.push({
        label: "늘려뜨기·모아뜨기로 바꾸기",
        children: [
          { label: "2코 늘려뜨기", onSelect: () => convertGather("increase", 2) },
          { label: "3코 늘려뜨기", onSelect: () => convertGather("increase", 3) },
          "separator",
          { label: "2코 모아뜨기", onSelect: () => convertGather("decrease", 2) },
          { label: "3코 모아뜨기", onSelect: () => convertGather("decrease", 3) },
        ],
      });
    if (items.some((it) => it.type === "gather")) out.push({ label: "늘려뜨기·모아뜨기 풀기", onSelect: splitGather });
    if (out.length) out.push("separator");
    out.push(
      { label: "복사하기", shortcut: "⌘C", onSelect: () => void copySel() },
      { label: "잘라내기", shortcut: "⌘X", onSelect: () => copySel() && deleteSel() },
      { label: "붙여넣기", shortcut: "⌘V", disabled: !hasClip, onSelect: paste },
      { label: "복제", shortcut: "⌘D", onSelect: duplicateSel },
      "separator",
      {
        label: "회전·뒤집기",
        children: [
          { label: "오른쪽으로 15° 회전", shortcut: "R", onSelect: () => rotateSel(15) },
          { label: "왼쪽으로 15° 회전", shortcut: "⇧R", onSelect: () => rotateSel(-15) },
          "separator",
          { label: "좌우 뒤집기", shortcut: "⇧H", onSelect: () => flipSel("h") },
          { label: "상하 뒤집기", shortcut: "⇧V", onSelect: () => flipSel("v") },
        ],
      },
      items.some((it) => it.groupId)
        ? { label: "그룹 해제", shortcut: "⇧⌘G", onSelect: ungroupSel }
        : { label: "그룹 만들기", shortcut: "⌘G", disabled: items.length < 2, onSelect: groupSel },
      { label: "내 기호로 등록", shortcut: "M", onSelect: openRegister },
      "separator",
      { label: "삭제하기", shortcut: "Del", danger: true, onSelect: deleteSel },
    );
    return out;
  }, [ctx, selItems, h, paste, selectAll, fitAll, mergeGather, convertGather, splitGather, copySel, deleteSel, duplicateSel, ungroupSel, groupSel, openRegister, rotateSel, flipSel]);
  const closeCtx = useCallback(() => setCtx(null), []);

  // ---------- render helpers ----------

  const { x: vx, y: vy, zoom } = view;
  const worldT = `translate(${vx} ${vy}) scale(${zoom})`;
  const toScreen = (p: Pt) => ({ x: p.x * zoom + vx, y: p.y * zoom + vy });

  const gridStep = zoom < 0.35 ? 100 : 20;
  const gs = gridStep * zoom;

  const ghost = useMemo(() => {
    if (!template) return null;
    if (mode === "insert" && hover && !space) return placeTemplate(template.items, { x: hover.x, y: hover.y, rotation: 0 });
    if (linear && template) return linearPlacements(linear.a, linear.b, linear.count, template.h).flatMap((p) => placeTemplate(template.items, p));
    if (radial && template && Math.max(radial.rx, radial.ry) > 0) return radialPlacements(radial.c, radial.rx, radial.ry, radial.count, template.h).flatMap((p) => placeTemplate(template.items, p));
    return null;
  }, [template, mode, hover, space, linear, radial]);

  // 경로 편집: one stroke, or a path-like shape that becomes one
  const pathCandidate = (() => {
    const c = selItems.filter((it) => pathOutline(it) !== null);
    if (c.length !== 1) return null;
    const it = c[0];
    return selItems.length === 1 || selItems.every((x) => x.groupId && x.groupId === it.groupId) ? it : null;
  })();
  const pathItem = pathEdit ? index.get(pathEdit)?.item : undefined;
  const pathStroke = pathItem?.type === "stroke" ? pathItem : null;
  const startPathEdit = () => {
    if (pathEdit) return setPathEdit(null);
    const it = pathCandidate;
    if (!it) return;
    if (it.type !== "stroke") {
      const o = pathOutline(it)!;
      const stroke: StrokeItem = { id: it.id, type: "stroke", points: o.points, width: STROKE_WIDTH, dash: "solid", ...(o.closed ? { closed: true } : {}), ...(it.color ? { color: it.color } : {}), ...(it.groupId ? { groupId: it.groupId } : {}) };
      h.set((d) => mapItems(d, new Set([it.id]), () => stroke));
      toast("도형을 점으로 바꿨어요. 꼭짓점을 드래그해 형태를 수정하세요");
    }
    if (mode !== "select") setMode("select");
    setPathEdit(it.id);
  };

  const hint = (() => {
    if (pathStroke) return "꼭짓점을 드래그해 형태를 수정하세요 · 선을 눌러 점 추가 · 점을 두 번 눌러 삭제";
    if (assignSlot !== null) return "왼쪽에서 기호를 선택하세요";
    if (space || mode === "pan") return null;
    if ((mode === "insert" || mode === "linear" || mode === "radial") && !template) return "왼쪽에서 기호·도형·컴포넌트를 선택하세요";
    if (mode === "pen") return "클릭: 점 · 우클릭/Enter: 완료 · 시작점: 닫기 · Esc: 취소";
    if (mode === "linear" && !linear?.final) return "드래그로 나열 · Shift: 가로/세로 · Space/휠로 이동·확대";
    if (mode === "radial" && !radial?.final) return "드래그로 원(타원) · Shift: 정원 · 매직링에서 시작하면 가운데에 맞춰요";
    if (mode === "number") return `캔버스를 클릭해 놓기 (다음 ${numberNext}) · Backspace 직전 취소 · Esc 종료`;
    return null;
  })();

  const cursor = panning ? "grabbing" : space || mode === "pan" ? "grab" : mode === "select" ? "default" : "crosshair";

  // selection overlay (screen space)
  const selScreen = selBounds ? { a: toScreen({ x: selBounds.x0, y: selBounds.y0 }), b: toScreen({ x: selBounds.x1, y: selBounds.y1 }) } : null;
  const single = selItems.length === 1 ? selItems[0] : null;
  const stretchHandle = (() => {
    if (mode !== "select" || !single || single.type !== "stitch") return null;
    const s = getSymbol(single.symbol);
    if (!s?.stretch || s.stretch === "u") return null;
    const { w, h: hh, oy = 0 } = itemGeom(single);
    const r = (single.rotation * Math.PI) / 180;
    if (s.stretch === "v") {
      const sV = single.flipV ? -1 : 1;
      const dir = { x: Math.sin(r) * sV, y: -Math.cos(r) * sV };
      const p = toScreen({ x: single.x + dir.x * (hh / 2 - oy), y: single.y + dir.y * (hh / 2 - oy) });
      return { x: p.x + dir.x * 12, y: p.y + dir.y * 12, label: "위·아래로 드래그 · 늘리기 / 줄이기" };
    }
    const sH = single.flipH ? -1 : 1;
    const dir = { x: Math.cos(r) * sH, y: Math.sin(r) * sH };
    const p = toScreen({ x: single.x + (dir.x * w) / 2, y: single.y + (dir.y * w) / 2 });
    return { x: p.x + dir.x * 12, y: p.y + dir.y * 12, label: "좌·우로 드래그 · 늘리기 / 줄이기" };
  })();

  const setBackground = useCallback(
    (c: string) =>
      h.set((d) => {
        const n = { ...d };
        if (c.toLowerCase() === DEFAULT_BG) delete n.background;
        else n.background = c.toLowerCase();
        return n;
      }),
    [h],
  );
  const setBackgroundOpacity = useCallback(
    (pct: number) =>
      h.set((d) => {
        const n = { ...d };
        if (pct >= 100) delete n.backgroundOpacity;
        else n.backgroundOpacity = pct;
        return n;
      }),
    [h],
  );
  const openVersions = useCallback(() => setVersionsOpen(true), []);
  const openHeights = useCallback(() => setHeightsOpen(true), []);
  const currentItems = useMemo(() => (versionsOpen ? doc.layers.filter((l) => l.visible).flatMap((l) => l.items) : []), [versionsOpen, doc.layers]);
  const restoreVersion = (v: Version) => {
    const data = normalize(v.data as CrochetData);
    saveVersion("복원 전");
    h.set(docOf(data));
    setSelection([]);
    setPathEdit(null);
    toast(`${versionTime(v.at)} 버전으로 복원했어요`);
  };

  const showRight = !narrow || rightOpen;
  const tourSteps = useMemo(() => makerTourSteps("crochet", narrow), [narrow]);
  const navTab: NavTab = tab === "mine" ? "components" : tab;
  const onNav = (t: NavTab) => {
    openPalette(t === "components" ? "mine" : t);
    if (narrow) setRightOpen(false);
  };
  const shell = { title, onRename: rename, status, onCollapse: () => setPaletteOpen(false) };



  // panel resize (drag the right edge, double-click resets)
  const startResize = (e: React.PointerEvent) => {
    e.preventDefault();
    const x0 = e.clientX, w0 = paletteW;
    const move = (ev: PointerEvent) => setPaletteW(Math.round(Math.min(PALETTE_MAX, Math.max(PALETTE_MIN, w0 + ev.clientX - x0))));
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  const curMode = MODES.find((m) => m.mode === (space ? "pan" : mode)) ?? MODES[0];
  const modeItems: MenuItem[] = MODES.map((m) => ({ label: `${m.label}`, shortcut: m.key, onSelect: () => setMode(m.mode) }));
  const zoomItems: MenuItem[] = [
    { label: "확대", shortcut: "⌘+", onSelect: () => zoomCenter(1.25) },
    { label: "축소", shortcut: "⌘−", onSelect: () => zoomCenter(0.8) },
    { label: "100%로 보기", onSelect: () => zoomCenter(1 / zoom) },
    { label: "화면에 맞추기", shortcut: "⌘0", onSelect: fitAll },
    "separator",
    { label: doc.showGrid ? "점 격자 숨기기" : "점 격자 표시", shortcut: "G", onSelect: () => h.set((d) => ({ ...d, showGrid: !d.showGrid })) },
  ];

  const slots: Slot[] = doc.quickSlots.map((v) => {
    const p = slotToPick(v);
    const myIcon = p?.kind === "my" ? icons.find((m) => m.id === p.id) : undefined;
    const filled = !!p && (p.kind === "symbol" ? !!getSymbol(p.id) : !!myIcon);
    return {
      label: pickName(p),
      filled,
      active: filled && !!picked && pickToSlot(picked) === v && mode === "insert",
      render: () => (p?.kind === "symbol" ? slotGlyph(p.id) : myIcon ? <MyIconPreview icon={myIcon} size={22} /> : null),
    };
  });
  const clearSlot = (i: number) => h.set((d) => ({ ...d, quickSlots: d.quickSlots.map((v, j) => (j === i ? null : v)) }));

  const bgStyle: React.CSSProperties = {
    backgroundColor: bgColor(doc.background, doc.backgroundOpacity),
    ...(doc.showGrid
      ? { backgroundImage: "radial-gradient(oklch(0.78 0.01 260 / 0.35) 1px, transparent 1px)", backgroundSize: `${gs}px ${gs}px`, backgroundPosition: `${vx % gs}px ${vy % gs}px` }
      : {}),
  };

  return (
    <div className="fixed top-0 left-0 z-20 h-dvh w-full overflow-hidden overscroll-none text-fg-neutral select-none" data-editor-shell>
      <div className="relative flex h-full min-h-0 flex-col overflow-hidden bg-bg-layer-fill" data-editor-chrome="true">
        <div className="relative flex min-h-0 flex-1 overflow-hidden">
          <Rail tab={navTab} open={paletteOpen} onTab={onNav} onExport={() => setExportOpen(true)} />
          <div className="relative flex min-h-0 min-w-0 flex-1 overflow-hidden">
            {/* palette */}
            {paletteOpen && (
              <div
                data-tour="palette"
                className={cx("relative z-[90] h-full shrink-0 overflow-visible transition-shadow", narrow && "absolute inset-y-0 left-0 shadow-s3")}
                style={{ width: paletteW }}
              >
                <div className="relative h-full shrink-0" style={{ width: paletteW }}>
                  {tab === "library" ? (
                    <TemplatePanel shell={shell} onInsert={insertTemplate} />
                  ) : tab === "aiConvert" ? (
                    <ImportPanel shell={shell} onBuild={buildImport} onImportLayers={importLayers} onError={toast} />
                  ) : tab === "ai" ? (
                    <AssistantPanel shell={shell} empty={!doc.layers.some((l) => l.items.length)} messages={chat} onSend={sendChat} onClear={() => setChat([])} selected={sel.length} />
                  ) : (
                  <Palette
                    title={title}
                    onRename={rename}
                    status={status}
                    onCollapse={() => setPaletteOpen(false)}
                    tab={tab === "mine" ? "mine" : "symbols"}
                    query={query}
                    onQuery={setQuery}
                    picked={picked}
                    onPick={pick}
                    icons={icons}
                    canSave={sel.length > 0}
                    onSaveSelection={openRegister}
                    onDeleteIcon={setDeleteIconId}
                    assigning={assignSlot !== null}
                  />
                  )}
                </div>
                <div
                  role="separator"
                  aria-orientation="vertical"
                  aria-label="패널 너비 조절 (끌어서 바꾸고, 두 번 누르면 원래대로)"
                  aria-valuemin={PALETTE_MIN}
                  aria-valuemax={PALETTE_MAX}
                  aria-valuenow={paletteW}
                  title="패널 너비 조절 (끌어서 바꾸고, 두 번 누르면 원래대로)"
                  tabIndex={0}
                  onPointerDown={startResize}
                  onDoubleClick={() => setPaletteW(PALETTE_W)}
                  onKeyDown={(e) => {
                    if (e.key === "ArrowLeft") setPaletteW((w) => Math.max(PALETTE_MIN, w - 16));
                    if (e.key === "ArrowRight") setPaletteW((w) => Math.min(PALETTE_MAX, w + 16));
                  }}
                  className="group/resize absolute inset-y-0 -right-[3px] z-[95] w-1.5 cursor-col-resize touch-none outline-none"
                >
                  <span aria-hidden="true" className="pointer-events-none absolute inset-y-0 left-1/2 w-0.5 -translate-x-1/2 bg-transparent transition-colors group-hover/resize:bg-stroke-brand-solid group-focus-visible/resize:bg-stroke-brand-solid" />
                </div>
              </div>
            )}

            <div className="relative flex min-h-0 min-w-0 flex-1 overflow-hidden">
              {/* canvas */}
              <div ref={wrapRef} data-tour="canvas" className="@container/maker-canvas relative min-h-0 min-w-0 flex-1 overflow-hidden">
                <div data-canvas-surface="true" className="absolute inset-0 overflow-hidden" style={bgStyle}>
                  <svg
                    ref={svgRef}
                    data-testid="crochet-canvas"
                    className="absolute inset-0 h-full w-full touch-none"
                    style={{ cursor }}
                    onPointerDown={onPointerDown}
                    onPointerMove={onPointerMove}
                    onPointerUp={onPointerUp}
                    onPointerCancel={onPointerUp}
                    onPointerLeave={() => !dragRef.current && setHover(null)}
                    onContextMenu={onContextMenu}
                    onDoubleClick={onDoubleClick}
                  >
                    <rect width="100%" height="100%" fill="transparent" />

                    {/* world */}
                    <g transform={worldT} fill="none" strokeWidth={STROKE_WIDTH} strokeLinecap="round" strokeLinejoin="round">
                      {doc.layers.map((l) => (
                        <LayerView key={l.id} layer={l} dim={activeOnly && l.id !== doc.activeLayerId} hk={hk} />
                      ))}

                      {/* per-item selection outlines */}
                      {sel.length > 0 && sel.length <= 400 && (
                        <g pointerEvents="none" stroke="#5f9c1a" strokeWidth={1.25} vectorEffect="non-scaling-stroke">
                          {selItems.map((it) => {
                            // the stroke being path-edited shows its points instead of a box
                            if (it.id === pathStroke?.id) return null;
                            if (it.type === "stitch" || it.type === "gather") {
                              const { w, h: hh, oy = 0 } = itemGeom(it);
                              return <rect key={it.id} x={-w / 2 - 2} y={oy - hh / 2 - 2} width={w + 4} height={hh + 4} rx={3} transform={stitchTransform(it)} vectorEffect="non-scaling-stroke" />;
                            }
                            const b = itemBounds(it);
                            return <rect key={it.id} x={b.x0 - 2} y={b.y0 - 2} width={b.x1 - b.x0 + 4} height={b.y1 - b.y0 + 4} rx={3} vectorEffect="non-scaling-stroke" />;
                          })}
                        </g>
                      )}

                      {/* ghosts & drafts */}
                      {ghost && (
                        <g opacity={0.45} pointerEvents="none">
                          <ItemsPreview items={ghost} color={activeColor} />
                        </g>
                      )}
                      {mode === "number" && hover && !space && (
                        <text x={hover.x} y={hover.y} fontSize={14} fontWeight={600} textAnchor="middle" dominantBaseline="central" fill={NUMBER_COLOR} opacity={0.5} stroke="none" pointerEvents="none">
                          {numberNext}
                        </text>
                      )}
                      {pen.length > 0 && (
                        <g pointerEvents="none">
                          <path d={pen.map(([x, y], i) => `${i ? "L" : "M"}${x} ${y}`).join("") + (hover ? `L${hover.x} ${hover.y}` : "")} stroke={activeColor} strokeWidth={STROKE_WIDTH} fill="none" />
                          {pen.map(([x, y], i) => (
                            <circle key={i} cx={x} cy={y} r={3.5 / zoom} fill={i === 0 ? "#5f9c1a" : "#fff"} stroke="#5f9c1a" strokeWidth={1.25 / zoom} />
                          ))}
                        </g>
                      )}
                      {linear && <line x1={linear.a.x} y1={linear.a.y} x2={linear.b.x} y2={linear.b.y} stroke="#5f9c1a" strokeWidth={1.25 / zoom} strokeDasharray={`${4 / zoom} ${4 / zoom}`} pointerEvents="none" />}
                      {radial && (
                        <g pointerEvents="none" stroke="#5f9c1a" strokeWidth={1.25 / zoom}>
                          <ellipse cx={radial.c.x} cy={radial.c.y} rx={radial.rx} ry={radial.ry} strokeDasharray={`${4 / zoom} ${4 / zoom}`} />
                          <path d={`M${radial.c.x - 5 / zoom} ${radial.c.y}h${10 / zoom}M${radial.c.x} ${radial.c.y - 5 / zoom}v${10 / zoom}`} />
                        </g>
                      )}
                    </g>

                    {/* screen-space overlays */}
                    {marquee && (
                      <rect
                        x={Math.min(marquee.a.x, marquee.b.x) * zoom + vx}
                        y={Math.min(marquee.a.y, marquee.b.y) * zoom + vy}
                        width={Math.abs(marquee.b.x - marquee.a.x) * zoom}
                        height={Math.abs(marquee.b.y - marquee.a.y) * zoom}
                        fill="rgba(124,197,34,0.08)"
                        stroke="#5f9c1a"
                        strokeWidth={1}
                        pointerEvents="none"
                      />
                    )}
                    {pathStroke && (
                      <g data-path-editor="">
                        {(pathStroke.closed ? [...pathStroke.points, pathStroke.points[0]] : pathStroke.points).map((p, i, all) => {
                          if (i === all.length - 1) return null;
                          const a = toScreen({ x: p[0], y: p[1] }), b = toScreen({ x: all[i + 1][0], y: all[i + 1][1] });
                          return (
                            <line key={`s${i}`} data-seg={i} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="transparent" strokeWidth={12} style={{ cursor: "copy" }}>
                              <title>눌러서 점 추가</title>
                            </line>
                          );
                        })}
                        <path
                          d={pathStroke.points.map(([x, y], i) => `${i ? "L" : "M"}${x * zoom + vx} ${y * zoom + vy}`).join("") + (pathStroke.closed ? "Z" : "")}
                          stroke="#5f9c1a"
                          strokeDasharray="4 3"
                          fill="none"
                          pointerEvents="none"
                        />
                        {pathStroke.points.map(([x, y], i) => {
                          const q = toScreen({ x, y });
                          return (
                            <circle key={`v${i}`} data-vertex={i} cx={q.x} cy={q.y} r={5.5} fill={pathVertex === i ? "#5f9c1a" : "#fff"} stroke="#5f9c1a" strokeWidth={1.5} style={{ cursor: "move" }}>
                              <title>드래그해 옮기기 · 두 번 눌러 삭제</title>
                            </circle>
                          );
                        })}
                      </g>
                    )}
                    {mode === "select" && selScreen && !marquee && !pathStroke && (
                      <g>
                        {sel.length > 1 && (
                          <rect
                            x={selScreen.a.x - 6}
                            y={selScreen.a.y - 6}
                            width={selScreen.b.x - selScreen.a.x + 12}
                            height={selScreen.b.y - selScreen.a.y + 12}
                            fill="none"
                            stroke="#5f9c1a"
                            strokeDasharray="4 3"
                            pointerEvents="none"
                          />
                        )}
                        <line x1={(selScreen.a.x + selScreen.b.x) / 2} y1={selScreen.a.y - 6} x2={(selScreen.a.x + selScreen.b.x) / 2} y2={selScreen.a.y - 26} stroke="#5f9c1a" pointerEvents="none" />
                        <g data-handle="rotate" style={{ cursor: "grab" }}>
                          <title>드래그해 회전 · Shift: 15°씩</title>
                          <circle cx={(selScreen.a.x + selScreen.b.x) / 2} cy={selScreen.a.y - 32} r={11} fill="transparent" />
                          <circle cx={(selScreen.a.x + selScreen.b.x) / 2} cy={selScreen.a.y - 32} r={6} fill="#fff" stroke="#5f9c1a" strokeWidth={1.5} />
                        </g>
                        {stretchHandle && (
                          <g data-handle="stretch" style={{ cursor: "ns-resize" }}>
                            <title>{stretchHandle.label}</title>
                            <circle cx={stretchHandle.x} cy={stretchHandle.y} r={10} fill="transparent" />
                            <rect x={stretchHandle.x - 5} y={stretchHandle.y - 5} width={10} height={10} rx={2} fill="#5f9c1a" stroke="#fff" strokeWidth={1.5} />
                          </g>
                        )}
                      </g>
                    )}
                  </svg>
                </div>

                {/* top-left: written pattern toggle */}
                <div className="pointer-events-none absolute inset-0 z-80">
                  <div className="pointer-events-none absolute top-3 left-3" data-tour="written-toggle">
                    <button
                      type="button"
                      aria-pressed={writtenOpen}
                      aria-label={writtenOpen ? "서술도안 숨기기" : "서술도안 보기"}
                      title={writtenOpen ? "서술도안 숨기기" : "서술도안 보기"}
                      onClick={() => setWrittenOpen((v) => !v)}
                      className={cx(sab("neutralOutline"), BTN, "pointer-events-auto h-8 gap-1.5 !rounded-r2 border-stroke-neutral-muted bg-bg-layer-default px-2.5 text-fg-neutral shadow-s2 hover:bg-bg-layer-default-pressed/80", writtenOpen && "!border-stroke-neutral-contrast !bg-bg-layer-default-pressed")}
                      style={el(79, 32)}
                    >
                      <ScrollText className="size-3.5" />
                      {/* layout-audit-ignore: tiny-text — reference chip label is 11px */}
                      <span className="text-[11px] leading-none font-medium">서술도안</span>
                    </button>
                  </div>
                  {writtenOpen && <WrittenPanel layers={doc.layers} folders={folders} onClose={() => setWrittenOpen(false)} />}
                </div>

                {/* top centre: selection count / tool hints */}
                <div className="pointer-events-none absolute inset-x-0 top-3 z-40 flex flex-col items-center gap-x1_5 px-[7.5rem]">
                  {sel.length > 0 && (
                    <span className="rounded-full bg-bg-neutral-inverted px-x3 py-x1 text-[12px] font-semibold text-fg-neutral-inverted shadow-s1" data-testid="selection-chip">
                      {sel.length}개 선택
                    </span>
                  )}
                  {hint && (
                    <span className="rounded-full border border-stroke-neutral-muted bg-bg-layer-default/95 px-x3 py-x1 text-[12px] text-fg-neutral-muted shadow-s1" data-testid="canvas-hint">
                      {hint}
                    </span>
                  )}
                </div>

                {/* top-right: mode */}
                <div className="pointer-events-none absolute top-3 right-3 z-50 flex items-center gap-2">
                  {narrow && (
                    <button
                      type="button"
                      aria-label="레이어 패널"
                      aria-pressed={rightOpen}
                      onClick={() => (setRightOpen((v) => !v), setPaletteOpen(false))}
                      className={cx(sab("neutralOutline"), BTN, "pointer-events-auto h-8 gap-1.5 !rounded-r2 border-stroke-neutral-muted bg-bg-layer-default px-2.5 text-fg-neutral shadow-s2 [&_svg]:size-3.5")}
                      style={el(64, 32)}
                    >
                      <PanelLeft className="size-3.5 -scale-x-100" />
                      <span className="text-[12px] leading-none font-medium">레이어</span>
                    </button>
                  )}
                  <div className="pointer-events-auto">
                    <Menu
                      align="end"
                      items={modeItems}
                      trigger={({ open, toggle }) => (
                        <button
                          type="button"
                          data-maker-mode={curMode.mode}
                          aria-label={`지금 모드: ${curMode.label} · 눌러서 바꾸기`}
                          aria-haspopup="menu"
                          aria-expanded={open}
                          onClick={toggle}
                          className={cx(sab("neutralOutline"), BTN, "pointer-events-auto h-8 gap-1.5 !rounded-r2 border-stroke-neutral-muted bg-bg-layer-default px-2.5 text-fg-neutral shadow-s2 hover:bg-bg-layer-default-pressed/80 [&_svg]:size-3.5")}
                          style={el(78, 32)}
                        >
                          <curMode.icon className="size-4" />
                          {/* layout-audit-ignore: tiny-text — reference mode chip label is 11px */}
                          <span className="text-[11px] leading-none font-medium">{curMode.label}</span>
                          <ChevronDown className="!size-3 text-fg-neutral-muted" />
                        </button>
                      )}
                    />
                  </div>
                </div>

                {/* repeat / number popovers (above the bottom chrome) */}
                {(linear?.final || radial?.final) && template && (
                  <div className="absolute bottom-[170px] left-1/2 z-[60] flex -translate-x-1/2 items-center gap-x3 rounded-r3 border border-stroke-neutral-muted bg-bg-layer-default py-x2 pr-x2 pl-x3 shadow-s2" role="dialog" aria-label={linear ? "평면 만들기" : "원형 만들기"}>
                    <span className="text-[13px] font-semibold whitespace-nowrap">{linear ? "평면 만들기" : "원형 만들기"}</span>
                    <NumberField
                      label="반복 개수"
                      value={(linear ?? radial)!.count}
                      min={1}
                      max={300}
                      onChange={(n) => (linear ? setLinear({ ...linear, count: n }) : radial && setRadial({ ...radial, count: n }))}
                    />
                    {radial && (
                      <>
                        <NumberField label="크기" value={Math.round(radial.rx)} min={2} max={4000} onChange={(r) => setRadial({ ...radial, rx: r, ry: radial.rx > 0 ? (radial.ry * r) / radial.rx : r })} />
                        <button
                          type="button"
                          className="text-[12px] whitespace-nowrap text-fg-neutral-muted underline-offset-2 hover:underline"
                          onClick={() => setRadial({ ...radial, count: radialAutoCount(radial.rx, radial.ry, template.w) })}
                        >
                          자동 {radialAutoCount(radial.rx, radial.ry, template.w)}개
                        </button>
                      </>
                    )}
                    <Button size="sm" onClick={() => (setLinear(null), setRadial(null))}>
                      취소
                    </Button>
                    <Button size="sm" variant="primary" onClick={linear ? applyLinear : applyRadial}>
                      만들기
                    </Button>
                  </div>
                )}

                {pathStroke && (
                  <div className="absolute bottom-[170px] left-1/2 z-[60] flex -translate-x-1/2 items-center gap-x2 rounded-r3 border border-stroke-neutral-muted bg-bg-layer-default py-x1_5 pr-x1_5 pl-x3 shadow-s2" role="group" aria-label="경로 편집">
                    <span className="text-[13px] font-semibold whitespace-nowrap">경로 편집</span>
                    <span className="text-[12px] whitespace-nowrap text-fg-neutral-muted tabular-nums">점 {pathStroke.points.length}개</span>
                    <Button size="sm" variant="ghost" disabled={pathVertex === null || pathStroke.points.length <= 2} onClick={() => pathVertex !== null && deleteVertex(pathVertex)}>
                      점 삭제
                    </Button>
                    <Button size="sm" onClick={() => setPathEdit(null)}>
                      완료
                    </Button>
                  </div>
                )}

                {mode === "number" && (
                  <div className="absolute bottom-[170px] left-1/2 z-[60] flex -translate-x-1/2 items-center gap-x2 rounded-r3 border border-stroke-neutral-muted bg-bg-layer-default py-x1_5 pr-x1_5 pl-x3 shadow-s2" role="group" aria-label="단 숫자">
                    <span className="text-[13px] font-semibold whitespace-nowrap">다음 숫자</span>
                    <IconButton label="숫자 줄이기" size="sm" disabled={numberNext <= 1} onClick={() => setNumberNext((n) => Math.max(1, n - 1))}>
                      <Minus />
                    </IconButton>
                    <span className="w-6 text-center text-[15px] font-bold tabular-nums">{numberNext}</span>
                    <IconButton label="숫자 늘리기" size="sm" onClick={() => setNumberNext((n) => n + 1)}>
                      <Plus />
                    </IconButton>
                    <Button size="sm" variant="ghost" disabled={!numberStack.current.length} onClick={undoLastNumber}>
                      직전 취소
                    </Button>
                    <Button size="sm" onClick={() => setMode("select")}>
                      완료
                    </Button>
                  </div>
                )}

                {/* bottom: quick slots + toolbar */}
                <div data-maker-bottom-chrome="" className="pointer-events-none absolute bottom-3 left-1/2 z-50 flex max-w-[calc(100%-1.5rem)] -translate-x-1/2 flex-col items-center gap-2 pb-[env(safe-area-inset-bottom)]">
                  <div className="flex flex-col items-center gap-2">
                    <QuickSlots
                      slots={slots}
                      onTake={takeSlot}
                      onEdit={(i) => (setAssignSlot(i), openPalette("symbols"))}
                      onClear={clearSlot}
                      onContext={(i, e) => setCtx({ x: e.clientX, y: e.clientY, slot: i })}
                    />
                    <Toolbar
                      mode={mode}
                      spaceHeld={space}
                      onMode={setMode}
                      onUndo={h.undo}
                      onRedo={h.redo}
                      canEditPath={!!pathCandidate || !!pathStroke}
                      pathActive={!!pathStroke}
                      onEditPath={startPathEdit}
                      canGroup={sel.length >= 2}
                      canUngroup={selItems.some((it) => it.groupId)}
                      onGroup={groupSel}
                      onUngroup={ungroupSel}
                      canRegister={sel.length > 0}
                      onRegister={openRegister}
                      onHelp={() => setHelpOpen(true)}
                      onTour={() => setTour(true)}
                    />
                  </div>
                </div>
              </div>

              {/* right: zoom, properties, layers */}
              {showRight && (
                <div className={cx("h-full shrink-0", narrow && "absolute inset-y-0 right-0 z-[90] shadow-s3")}>
                  <RightPanel
                    layers={doc.layers}
                    folders={folders}
                    activeLayerId={doc.activeLayerId}
                    activeOnly={activeOnly}
                    onActiveOnly={setActiveOnly}
                    layer={layerActions}
                    selected={selectedForPanel}
                    props={propActions}
                    savedAt={savedAt}
                    zoom={zoom}
                    zoomItems={zoomItems}
                    background={doc.background ?? DEFAULT_BG}
                    backgroundOpacity={doc.backgroundOpacity ?? 100}
                    onBackground={setBackground}
                    onBackgroundOpacity={setBackgroundOpacity}
                    onVersions={openVersions}
                    onHeights={openHeights}
                    heightsOn={!!doc.heights}
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <CtxMenu at={ctx} items={ctxItems} onClose={closeCtx} />

      <ExportDialog open={exportOpen} onClose={() => setExportOpen(false)} onExport={onExport} />
      <VersionDialog
        open={versionsOpen}
        onClose={() => setVersionsOpen(false)}
        workId={work.id}
        currentItems={currentItems}
        savedAt={savedAt}
        onSave={(label) => toast(saveVersion(label) ? `버전을 저장했어요${label.trim() ? ` · ${label.trim()}` : ""}` : "저장 공간이 부족해 버전을 저장하지 못했어요")}
        onRestore={restoreVersion}
        onRename={(id, label) => versions.rename(work.id, id, label)}
        onRemove={(id) => versions.remove(work.id, id)}
      />
      <HeightsDialog
        open={heightsOpen}
        onClose={() => setHeightsOpen(false)}
        heights={doc.heights}
        onBegin={h.checkpoint}
        onChange={(hh, merge) =>
          h.set(
            (d) => {
              const n = { ...d };
              if (hh) n.heights = hh;
              else delete n.heights;
              return n;
            },
            { merge },
          )
        }
      />
      <ShortcutDialog open={helpOpen} onClose={() => setHelpOpen(false)} groups={SHORTCUTS} />
      <SpotlightTour
        open={tour}
        steps={tourSteps}
        onClose={() => {
          tourSeen.markMaker("crochet");
          setTour(false);
        }}
      />

      <Dialog
        open={registerOpen}
        onClose={() => setRegisterOpen(false)}
        title="내 기호로 등록"
        width={380}
        footer={
          <>
            <Button onClick={() => setRegisterOpen(false)}>취소</Button>
            <Button variant="primary" onClick={confirmRegister}>
              등록
            </Button>
          </>
        }
      >
        <p className="mb-x3 text-[13px] text-fg-neutral-muted">선택한 {sel.length}개를 하나의 기호로 저장해요. 다른 도안에서도 같이 쓸 수 있어요.</p>
        <input
          autoFocus
          aria-label="기호 이름"
          placeholder="예: 꽃잎"
          value={registerName}
          onChange={(e) => setRegisterName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && confirmRegister()}
          className="h-10 w-full rounded-r2 border border-stroke-neutral-weak bg-bg-layer-default px-x3 text-[15px] outline-none focus:border-stroke-neutral-contrast"
        />
      </Dialog>

      <Dialog
        open={!!deleteIconId}
        onClose={() => setDeleteIconId(null)}
        title="내 기호 삭제"
        width={380}
        footer={
          <>
            <Button onClick={() => setDeleteIconId(null)}>취소</Button>
            <Button
              variant="danger"
              onClick={() => {
                if (deleteIconId) myIcons.remove(deleteIconId);
                if (picked?.kind === "my" && picked.id === deleteIconId) setPicked(null);
                setDeleteIconId(null);
              }}
            >
              삭제
            </Button>
          </>
        }
      >
        <p className="text-[14px] text-fg-neutral-muted">이 기호를 라이브러리에서 삭제할까요? 이미 도안에 놓은 기호는 그대로 남아요.</p>
      </Dialog>
    </div>
  );
}
