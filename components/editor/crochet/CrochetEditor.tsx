"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button, Dialog, IconButton, Menu, NumberField, cx, isMod, useToast, type MenuItem } from "@/components/app/ui";
import { exportSvg, safeName, svgThumbnail } from "@/lib/export";
import { uid } from "@/lib/id";
import { works } from "@/lib/store";
import type { CrochetData, CrochetItem, CrochetLayer, GatherItem, StitchItem, TextItem, View, Work } from "@/lib/types";
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
  placeTemplate,
  radialAutoCount,
  radialPlacements,
  rotateItem,
  snap,
  stitchTransform,
  unionBounds,
  type Box,
  type Pt,
} from "./geometry";
import { ExportDialog, ShortcutDialog, type ShortcutGroup } from "./EditorDialogs";
import { MyIconPreview, Palette, type PaletteTab, type Picked } from "./Palette";
import { Rail, type NavTab } from "./Rail";
import { BTN, el, sab } from "./seed";
import { ArrowRightLeft, ChevronDown, Hand, Hash, Minus, MousePointer2, PanelLeft, PenTool, Pencil, Plus, ScrollText } from "./uiIcons";
import "./crochet-editor.css";
import { myIcons, useMyIcons } from "./myIcons";
import { ItemsPreview, LayerView } from "./render";
import { RightPanel, type LayerActions, type PropActions } from "./RightPanel";

// ---------- types ----------

type Doc = Omit<CrochetData, "view">;
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
  | { k: "radial"; start: Pt; fromCenter: boolean };

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
  return { layers, activeLayerId, quickSlots, showGrid: d.showGrid ?? true, view: d.view ?? { x: 0, y: 0, zoom: 1 } };
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
  const h = useHistory<Doc>({ layers: init.layers, activeLayerId: init.activeLayerId, quickSlots: init.quickSlots, showGrid: init.showGrid });
  const doc = h.state;
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

  const [tab, setTab] = useState<PaletteTab>("symbols");
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
    const svg = buildSvg(doc.layers, { fit: { w: 320, h: 240 }, margin: 16, background: "#ffffff" });
    return svgThumbnail(svg ?? `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="240"><rect width="320" height="240" fill="#ffffff"/></svg>`);
  }, [doc.layers]);
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
  const soon = useCallback((what?: string) => toast(what ? `${what} · 준비 중이에요` : "준비 중이에요"), [toast]);
  const openPalette = useCallback((t: PaletteTab) => {
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
    [commitPen, h],
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
        const layer: CrochetLayer = { id: uid(), name: nextLayerName(d.layers), visible: true, items: [] };
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
    }),
    [h],
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
        dragRef.current = { k: "stretch", orig: st, base: s.stretch === "h" ? s.w : s.h, axis: s.stretch === "h" ? "h" : "v", started: false };
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
        const { w, h: hh } = itemGeom(o);
        const r = (o.rotation * Math.PI) / 180;
        const sV = o.flipV ? -1 : 1, sH = o.flipH ? -1 : 1;
        let dir: Pt, fixed: Pt;
        if (d.axis === "v") {
          dir = { x: Math.sin(r) * sV, y: -Math.cos(r) * sV };
          fixed = { x: o.x - (dir.x * hh) / 2, y: o.y - (dir.y * hh) / 2 };
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
        const next: StitchItem = { ...o, scale, x: Math.round((fixed.x + (dir.x * L) / 2) * 100) / 100, y: Math.round((fixed.y + (dir.y * L) / 2) * 100) / 100 };
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
    async (format: "png" | "jpg" | "svg") => {
      const svg = buildSvg(h.get().layers, { background: format === "svg" ? undefined : "#ffffff" });
      if (!svg) return false;
      await exportSvg(svg, format, safeName(works.get(work.id)?.title ?? work.title));
      return true;
    },
    [h, work.id, work.title],
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

  const hint = (() => {
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
    const { w, h: hh } = itemGeom(single);
    const r = (single.rotation * Math.PI) / 180;
    if (s.stretch === "v") {
      const sV = single.flipV ? -1 : 1;
      const dir = { x: Math.sin(r) * sV, y: -Math.cos(r) * sV };
      const p = toScreen({ x: single.x + (dir.x * hh) / 2, y: single.y + (dir.y * hh) / 2 });
      return { x: p.x + dir.x * 12, y: p.y + dir.y * 12, label: "위·아래로 드래그 · 늘리기 / 줄이기" };
    }
    const sH = single.flipH ? -1 : 1;
    const dir = { x: Math.cos(r) * sH, y: Math.sin(r) * sH };
    const p = toScreen({ x: single.x + (dir.x * w) / 2, y: single.y + (dir.y * w) / 2 });
    return { x: p.x + dir.x * 12, y: p.y + dir.y * 12, label: "좌·우로 드래그 · 늘리기 / 줄이기" };
  })();

  const showRight = !narrow || rightOpen;
  const navTab: NavTab = tab === "mine" ? "components" : "symbols";
  const onNav = (t: NavTab) => {
    if (t === "symbols" || t === "components") {
      const want: PaletteTab = t === "components" ? "mine" : "symbols";
      if (paletteOpen && tab === want) setPaletteOpen(false);
      else {
        openPalette(want);
        if (narrow) setRightOpen(false);
      }
      return;
    }
    soon(t === "library" ? "템플릿" : t === "aiConvert" ? "원문·파일로 만들기" : "AI 어시스턴트");
  };

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
    backgroundColor: "rgb(255, 255, 255)",
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
                  <Palette
                    title={title}
                    onRename={rename}
                    status={status}
                    onCollapse={() => setPaletteOpen(false)}
                    tab={tab}
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
                        <LayerView key={l.id} layer={l} dim={activeOnly && l.id !== doc.activeLayerId} />
                      ))}

                      {/* per-item selection outlines */}
                      {sel.length > 0 && sel.length <= 400 && (
                        <g pointerEvents="none" stroke="#5f9c1a" strokeWidth={1.25} vectorEffect="non-scaling-stroke">
                          {selItems.map((it) => {
                            if (it.type === "stitch" || it.type === "gather") {
                              const { w, h: hh } = itemGeom(it);
                              return <rect key={it.id} x={-w / 2 - 2} y={-hh / 2 - 2} width={w + 4} height={hh + 4} rx={3} transform={stitchTransform(it)} vectorEffect="non-scaling-stroke" />;
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
                    {mode === "select" && selScreen && !marquee && (
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
                      aria-pressed={false}
                      aria-label="서술도안 보기"
                      title="서술도안 보기"
                      onClick={() => soon("서술도안")}
                      className={cx(sab("neutralOutline"), BTN, "pointer-events-auto h-8 gap-1.5 !rounded-r2 border-stroke-neutral-muted bg-bg-layer-default px-2.5 text-fg-neutral shadow-s2 hover:bg-bg-layer-default-pressed/80")}
                      style={el(79, 32)}
                    >
                      <ScrollText className="size-3.5" />
                      {/* layout-audit-ignore: tiny-text — reference chip label is 11px */}
                      <span className="text-[11px] leading-none font-medium">서술도안</span>
                    </button>
                  </div>
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
                      canEditPath={selItems.length === 1 && selItems[0].type === "stroke"}
                      onEditPath={() => soon("경로 편집")}
                      canGroup={sel.length >= 2}
                      canUngroup={selItems.some((it) => it.groupId)}
                      onGroup={groupSel}
                      onUngroup={ungroupSel}
                      canRegister={sel.length > 0}
                      onRegister={openRegister}
                      onHelp={() => setHelpOpen(true)}
                    />
                  </div>
                </div>
              </div>

              {/* right: zoom, properties, layers */}
              {showRight && (
                <div className={cx("h-full shrink-0", narrow && "absolute inset-y-0 right-0 z-[90] shadow-s3")}>
                  <RightPanel
                    layers={doc.layers}
                    activeLayerId={doc.activeLayerId}
                    activeOnly={activeOnly}
                    onActiveOnly={setActiveOnly}
                    layer={layerActions}
                    selected={selectedForPanel}
                    props={propActions}
                    savedAt={savedAt}
                    zoom={zoom}
                    zoomItems={zoomItems}
                    onSoon={soon}
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <CtxMenu at={ctx} items={ctxItems} onClose={closeCtx} />

      <ExportDialog open={exportOpen} onClose={() => setExportOpen(false)} onExport={onExport} />
      <ShortcutDialog open={helpOpen} onClose={() => setHelpOpen(false)} groups={SHORTCUTS} />

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
