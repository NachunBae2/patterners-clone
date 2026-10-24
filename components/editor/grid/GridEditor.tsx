"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button, Dialog, cx, isMod, useHotkeys, useToast } from "@/components/app/ui";
import { AtelierDialog } from "@/components/app/AtelierDialog";
import { ShareDialog } from "@/components/app/ShareDialog";
import { safeName, exportSvg, svgThumbnail } from "@/lib/export";
import { works } from "@/lib/store";
import { useAutosave } from "@/lib/useAutosave";
import { useHistory } from "@/lib/useHistory";
import type { GridData, GridMode, GridPage, View, Work } from "@/lib/types";
import { KnitPreviewWindow, type PChart } from "@/components/editor/common/KnitPreview";
import type { Converted } from "./convert";
import { Checkbox, Seg, ab, abBase, el } from "./fields";
import { GridCanvas, ZOOM_MAX, ZOOM_MIN, type Tool } from "./GridCanvas";
import { LCloud, LCloudAlert, LCloudCheck, LCopy, LPanelLeft, LScrollText, LX, PanelRight } from "./icons";
import { MakePanel, type MakeKind } from "./MakePanel";
import {
  type AnchorH,
  type AnchorV,
  type Block,
  type GridDoc,
  type Numbering,
  type Rect,
  type Tension,
  DEFAULT_FLOAT,
  MAX_COLORS,
  activePage,
  blankPage,
  cellAspect,
  clamp,
  cleanupCells,
  clipRect,
  estimateGauge,
  fillRect,
  findFloats,
  getBlock,
  isBrandNew,
  isEmptyPage,
  isolatedCells,
  numberingOf,
  padPage,
  putBlock,
  removeYarn,
  resizePage,
  rowNoOf,
  safeZoneHit,
  scalePage,
  stNoOf,
  stitchCounts,
  transformPage,
  transformSelection,
  withSafe,
  writtenRows,
} from "./model";
import { RightPanel, YarnPanel } from "./Panels";
import { Rail, type RailTab } from "./Rail";
import { CELL, chartSvg, thumbSvg } from "./render";
import { StartDialog } from "./StartDialog";
import "./grid.css";
import { Toolbar, yarnName } from "./Toolbar";

const SHORTCUTS: { title: string; items: { keys: string; label: string }[] }[] = [
  {
    title: "도구",
    items: [
      { keys: "B", label: "연필" },
      { keys: "Shift+드래그", label: "네모 칠하기" },
      { keys: "U", label: "사각형" },
      { keys: "G", label: "채우기" },
      { keys: "I", label: "스포이트" },
      { keys: "Alt+클릭", label: "연필 중 색 집기" },
      { keys: "M", label: "선택" },
      { keys: "H", label: "화면 이동" },
      { keys: "오른쪽 클릭", label: "배경 실로 지우기" },
      { keys: "1–9", label: "실 고르기" },
    ],
  },
  {
    title: "편집",
    items: [
      { keys: "Ctrl(Cmd)+Z", label: "실행 취소" },
      { keys: "Ctrl(Cmd)+Shift+Z", label: "다시 실행" },
      { keys: "Ctrl(Cmd)+C", label: "복사" },
      { keys: "Ctrl(Cmd)+X", label: "잘라내기" },
      { keys: "Ctrl(Cmd)+V", label: "붙여넣기" },
      { keys: "Ctrl(Cmd)+A", label: "전체 선택" },
      { keys: "Delete", label: "선택한 칸 지우기" },
      { keys: "Alt+드래그", label: "선택한 칸 복사해 옮기기" },
      { keys: "Shift+H", label: "좌우 반전" },
      { keys: "Shift+V", label: "상하 반전" },
      { keys: "]", label: "시계 방향으로 90° 회전" },
      { keys: "[", label: "반시계 방향으로 90° 회전" },
    ],
  },
  {
    title: "보기",
    items: [
      { keys: "Space", label: "스페이스 + 드래그로 화면 이동" },
      { keys: "Ctrl(Cmd)+휠", label: "확대·축소" },
      { keys: "Shift+1", label: "전체 맞춤" },
      { keys: "+ / -", label: "확대 / 축소" },
      { keys: "Esc", label: "선택 해제" },
      { keys: "?", label: "이 도움말" },
    ],
  },
];

const PANEL_W = 296;

function normalize(data: GridData): GridDoc {
  const d = structuredClone(data) as GridDoc;
  if (!d.yarns?.length) d.yarns = ["#f4f1ea", "#2b2b2b"];
  if (d.yarns.length < 2) d.yarns.push("#2b2b2b");
  if (!d.pages?.length) d.pages = [blankPage("페이지 1", 40, 30)];
  if (!d.pages.some((p) => p.id === d.activePageId)) d.activePageId = d.pages[0].id;
  d.mode ??= "knit";
  d.gauge ??= { sts: 20, rows: 22 };
  // the 안전구역 switch was added later: older docs with a margin count as switched on
  if (d.safeOn === undefined && (d.safe?.sts || d.safe?.rows)) d.safeOn = true;
  return d;
}

export default function GridEditor({ work, data }: { work: Work; data: GridData }) {
  const toast = useToast();
  const h = useHistory<GridDoc>(useMemo(() => normalize(data), [data]));
  const doc = h.state;
  const page = activePage(doc);
  const aspect = cellAspect(doc.mode, doc.gauge);
  const safe = doc.safeOn ? doc.safe ?? { sts: 0, rows: 0 } : { sts: 0, rows: 0 };
  const numbering = numberingOf(doc);
  // 뜬 모습 미리보기: every cell is a knit stitch in its yarn (empty = background yarn)
  const previewChart = useMemo<PChart>(
    () => ({ cols: page.cols, rows: page.rows, cells: page.cells.map((v) => ({ k: "knit" as const, color: doc.yarns[v < 0 ? 0 : v] ?? doc.yarns[0] })) }),
    [page, doc.yarns],
  );

  // ---- view state (not history) ----
  const [view, setView] = useState<View>({ x: 0, y: 0, zoom: 1 });
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [tool, setToolState] = useState<Tool>("pencil");
  const prevTool = useRef<Tool>("pencil");
  const [spaceHeld, setSpaceHeld] = useState(false);
  const [mirror, setMirror] = useState(false);
  const [cur, setCur] = useState(1);
  const [sel, setSel] = useState<Rect | null>(null);
  const [hover, setHover] = useState<{ c: number; r: number } | null>(null);
  const brandNew = useMemo(() => isBrandNew(normalize(data)), [data]);
  const [startOpen, setStartOpen] = useState(brandNew);
  const [tab, setTab] = useState<RailTab | null>(brandNew ? "make" : "yarns");
  const [makeKind, setMakeKind] = useState<MakeKind>("text");
  const [attention, setAttention] = useState(false);
  const [panelW, setPanelW] = useState(PANEL_W);
  const [rightOpen, setRightOpen] = useState(false);
  const [written, setWritten] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [title, setTitle] = useState(work.title);
  const [renaming, setRenaming] = useState(false);
  const [preview, setPreview] = useState(false);
  const clip = useRef<Block | null>(null);

  const setTool = (t: Tool) => {
    if (t !== "pick") prevTool.current = t;
    setToolState(t);
    if (t !== "select") setSel(null);
  };
  const current = Math.min(cur, doc.yarns.length - 1);
  const paintValue = doc.mode === "filet" ? (current >= 1 ? 1 : -1) : current === 0 ? -1 : current;

  // ---- doc edits ----
  const lastKey = useRef<{ key: string; t: number } | null>(null);
  const setDoc = useCallback(
    (fn: (d: GridDoc) => GridDoc, key?: string) => {
      const now = Date.now();
      const merge = !!key && lastKey.current?.key === key && now - lastKey.current.t < 1200;
      lastKey.current = key ? { key, t: now } : null;
      h.set(fn, { merge });
    },
    [h],
  );
  const commitPage = useCallback(
    (p: GridPage, merge: boolean) => {
      lastKey.current = null;
      h.set((d) => ({ ...d, pages: d.pages.map((x) => (x.id === p.id ? p : x)) }), { merge });
    },
    [h],
  );
  const editPage = (fn: (p: GridPage) => GridPage) => commitPage(fn(page), false);

  // ---- fit ----
  const fit = useCallback(() => {
    if (!size.w || !size.h) return;
    const W = page.cols * CELL;
    const H = page.rows * CELL * aspect;
    const z = clamp(Math.min((size.w - 80) / W, (size.h - 240) / H), ZOOM_MIN, ZOOM_MAX);
    setView({ zoom: z, x: (size.w - W * z) / 2, y: (size.h - H * z) / 2 });
  }, [size.w, size.h, page.cols, page.rows, aspect]);
  const fitKey = `${page.id}:${page.cols}x${page.rows}:${aspect.toFixed(3)}:${size.w}x${size.h}`;
  const lastFit = useRef("");
  const holdFit = useRef(false);
  useEffect(() => {
    if (!size.w || lastFit.current === fitKey) return;
    lastFit.current = fitKey;
    if (holdFit.current) {
      holdFit.current = false; // edge drag: keep the view still
      return;
    }
    fit();
  }, [fitKey, fit, size.w]);
  const zoomTo = (z: number) =>
    setView((v) => {
      const nz = clamp(z, ZOOM_MIN, ZOOM_MAX);
      const mx = size.w / 2;
      const my = size.h / 2;
      return { zoom: nz, x: mx - ((mx - v.x) * nz) / v.zoom, y: my - ((my - v.y) * nz) / v.zoom };
    });
  const zoomBy = (k: number) => zoomTo(view.zoom * k);

  // ---- derived checks ----
  const counts = useMemo(() => stitchCounts(page, doc.yarns.length), [page, doc.yarns.length]);
  const floatLimit = doc.floatLimit ?? DEFAULT_FLOAT;
  const floats = useMemo(() => (doc.mode === "knit" ? findFloats(page, floatLimit) : []), [page, doc.mode, floatLimit]);
  const isolated = useMemo(() => isolatedCells(page).length, [page]);
  const safeHit = useMemo(() => safeZoneHit(page, safe), [page, safe]);

  // ---- autosave + thumbnail ----
  const status = useAutosave(work.id, doc, () => svgThumbnail(thumbSvg(doc, page, aspect)));

  // ---- operations ----
  const transform = (op: "flipH" | "flipV" | "cw" | "ccw") => {
    if (sel) {
      const r = transformSelection(page, sel, op);
      commitPage(r.page, false);
      setSel(r.sel.w && r.sel.h ? r.sel : null);
    } else if (op === "flipH" || op === "flipV") toast("먼저 영역을 선택하세요");
    else editPage((p) => transformPage(p, op));
  };

  const copySel = () => {
    if (!sel) return false;
    clip.current = getBlock(page, sel);
    return true;
  };
  const paste = () => {
    const b = clip.current;
    if (!b) return;
    const at = sel ?? (hover ? { c: hover.c, r: hover.r } : { c: 0, r: 0 });
    commitPage(putBlock(page, b, at.c, at.r), false);
    setToolState("select");
    const s = clipRect({ c: at.c, r: at.r, w: b.cols, h: b.rows }, page.cols, page.rows);
    setSel(s.w && s.h ? s : null);
  };
  const clearSel = () => sel && commitPage(fillRect(page, sel, -1), false);

  const pick = (v: number) => {
    setCur(doc.mode === "filet" ? (v > 0 ? 1 : 0) : v < 0 ? 0 : v);
    if (tool === "pick") setToolState(prevTool.current);
  };

  const addYarn = (c: string) => {
    if (doc.yarns.length >= MAX_COLORS) return toast(`색은 최대 ${MAX_COLORS}개까지예요.`);
    setDoc((d) => ({ ...d, yarns: [...d.yarns, c] }));
    setCur(doc.yarns.length);
  };
  const recolor = (i: number, c: string) => setDoc((d) => ({ ...d, yarns: d.yarns.map((y, j) => (j === i ? c : y)) }), `yarn${i}`);
  const dropYarn = (i: number) => {
    setDoc((d) => removeYarn(d, i));
    if (cur >= i) setCur(Math.max(1, cur - 1));
  };

  const setMode = (m: GridMode) => {
    setDoc((d) => ({ ...d, mode: m }));
    if (m === "filet" && cur > 1) setCur(1);
  };
  const setGauge = (g: { sts: number; rows: number }) => setDoc((d) => ({ ...d, gauge: g }), "gauge");
  const setGaugeTool = (t: { yarn: number; needle: number; tension: Tension }) => setDoc((d) => ({ ...d, gaugeTool: t, gauge: estimateGauge(t) }), "gaugeTool");
  const setNumbering = (n: Numbering, key?: string) =>
    setDoc((d) => ({ ...d, numbering: n, working: n.alternate ? "flat" : "round", hand: n.flipSts ? "right" : "left" }), key);

  const marginNow = doc.safeOn ? doc.safe ?? { sts: 0, rows: 0 } : { sts: 0, rows: 0 };
  const applyMargin = (next: { sts: number; rows: number }, on: boolean, keep: { sts: number; rows: number }) => {
    const ds = next.sts - marginNow.sts;
    const dr = next.rows - marginNow.rows;
    setDoc((d) => ({ ...d, safe: keep, safeOn: on, pages: d.pages.map((p) => padPage(p, ds, dr, ds, dr)) }), "safe");
    setSel(null);
  };
  const setSafeZone = (s: { sts: number; rows: number }) => applyMargin(s, true, s);
  const setSafeOn = (on: boolean) => {
    const sizes = doc.safe && (doc.safe.sts || doc.safe.rows) ? doc.safe : { sts: 2, rows: 2 };
    applyMargin(on ? sizes : { sts: 0, rows: 0 }, on, sizes);
  };

  const resizeBase = useRef<GridPage | null>(null);
  const resize = (cols: number, rows: number, ah: AnchorH, av: AnchorV) => {
    if (!resizeBase.current || resizeBase.current.id !== page.id) resizeBase.current = page;
    const base = resizeBase.current;
    setDoc((d) => ({ ...d, pages: d.pages.map((p) => (p.id === base.id ? resizePage(base, cols, rows, ah, av) : p)) }), "resize");
    setSel(null);
  };
  const resizeEnd = () => {
    resizeBase.current = null;
    lastKey.current = null;
  };
  const scale = (cols: number, rows: number) => {
    editPage((p) => scalePage(p, cols, rows));
    setSel(null);
  };
  const onEdge = (side: "left" | "right" | "top" | "bottom", n: number, base: GridPage) => {
    const nn = side === "left" || side === "right" ? Math.max(n, 1 - base.cols) : Math.max(n, 1 - base.rows);
    const pad = { left: 0, top: 0, right: 0, bottom: 0, [side]: nn };
    const next = padPage(base, pad.left, pad.top, pad.right, pad.bottom);
    if (next.cols === page.cols && next.rows === page.rows) return;
    holdFit.current = true;
    commitPage(next, true);
    // keep the opposite edge still while dragging the left / top handle
    const dc = next.cols - page.cols;
    const dr = next.rows - page.rows;
    if (side === "left") setView((v) => ({ ...v, x: v.x - dc * CELL * v.zoom }));
    if (side === "top") setView((v) => ({ ...v, y: v.y - dr * CELL * aspect * v.zoom }));
    setSel(null);
  };

  const selectPage = (id: string) => {
    h.replace((d) => ({ ...d, activePageId: id }));
    setSel(null);
  };
  const addPage = () => {
    const p = blankPage(`페이지 ${doc.pages.length + 1}`, page.cols, page.rows);
    setDoc((d) => ({ ...d, pages: [...d.pages, p], activePageId: p.id }));
    setSel(null);
  };
  const renamePage = (id: string, name: string) => setDoc((d) => ({ ...d, pages: d.pages.map((p) => (p.id === id ? { ...p, name: name.slice(0, 40) } : p)) }));
  const duplicatePage = (id: string) => {
    const i = doc.pages.findIndex((p) => p.id === id);
    const src = doc.pages[i];
    const copy = { ...blankPage(`${src.name} 복사본`, src.cols, src.rows), cells: src.cells.slice() };
    setDoc((d) => ({ ...d, pages: [...d.pages.slice(0, i + 1), copy, ...d.pages.slice(i + 1)], activePageId: copy.id }));
  };
  const movePage = (id: string, dir: -1 | 1) =>
    setDoc((d) => {
      const i = d.pages.findIndex((p) => p.id === id);
      const j = i + dir;
      if (j < 0 || j >= d.pages.length) return d;
      const pages = d.pages.slice();
      [pages[i], pages[j]] = [pages[j], pages[i]];
      return { ...d, pages };
    });
  const deletePage = (id: string) => {
    if (doc.pages.length <= 1) return;
    const i = doc.pages.findIndex((p) => p.id === id);
    const removed = doc.pages[i];
    setDoc((d) => {
      const pages = d.pages.filter((p) => p.id !== id);
      return { ...d, pages, activePageId: d.activePageId === id ? pages[Math.max(0, i - 1)].id : d.activePageId };
    });
    setSel(null);
    toast(`${removed.name}을(를) 지웠어요`, {
      label: "되돌리기",
      run: () =>
        setDoc((d) =>
          d.pages.some((p) => p.id === removed.id) ? d : { ...d, pages: [...d.pages.slice(0, i), removed, ...d.pages.slice(i)], activePageId: removed.id },
        ),
    });
  };

  const applyMake = (kind: MakeKind, r: Converted) => {
    const wrapped = withSafe(r.cells, r.cols, r.rows, safe);
    setDoc((d) => {
      let yarns = d.yarns;
      if (kind === "image" && r.yarns?.length) {
        yarns = r.yarns.slice(0, MAX_COLORS);
        if (yarns.length < 2) yarns.push("#2b2b2b");
      }
      return { ...d, yarns, pages: d.pages.map((p) => (p.id === page.id ? { ...p, ...wrapped } : p)) };
    });
    if (kind === "image") setCur(1);
    setSel(null);
    setStartOpen(false);
  };

  const pickStart = (k: MakeKind) => {
    setStartOpen(false);
    setTab("make");
    setMakeKind(k);
    setAttention(k === "image");
  };

  const cleanup = () => editPage((p) => ({ ...p, cells: cleanupCells(p.cells, p.cols, p.rows) }));

  // ---- export ----
  const [format, setFormat] = useState<"png" | "jpg" | "svg">("png");
  const [busy, setBusy] = useState(false);
  const runExport = async () => {
    if (isEmptyPage(page) && doc.mode !== "filet") return toast("내보낼 내용이 없어요.");
    setBusy(true);
    try {
      const t = works.get(work.id)?.title ?? title;
      const name = doc.pages.length > 1 ? `${t}-${page.name}` : t;
      await exportSvg(chartSvg(doc, page, aspect), format, safeName(name));
      setExportOpen(false);
    } catch {
      toast("내보내기에 실패했어요");
    } finally {
      setBusy(false);
    }
  };

  const commitTitle = (v: string) => {
    const t = v.trim().slice(0, 60) || "제목 없는 배색 도안";
    setTitle(t);
    works.update(work.id, { title: t, updatedAt: Date.now() });
    setRenaming(false);
  };

  // ---- written (서술형) ----
  const names = (v: number) => (doc.mode === "filet" ? (v > 0 ? "채운칸" : "빈칸") : yarnName(v));
  const writtenText = useMemo(() => (written ? writtenRows(page, names, numbering).join("\n") : ""), [written, page, numbering, doc.mode]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---- keyboard ----
  useHotkeys(
    (e) => {
      const k = e.key.toLowerCase();
      if (startOpen) return;
      if (isMod(e)) {
        if (k === "z") {
          e.preventDefault();
          if (e.shiftKey) h.redo();
          else h.undo();
        } else if (k === "y") {
          e.preventDefault();
          h.redo();
        } else if (k === "c") {
          if (copySel()) e.preventDefault();
        } else if (k === "x") {
          if (copySel()) {
            e.preventDefault();
            clearSel();
          }
        } else if (k === "v") {
          if (clip.current) {
            e.preventDefault();
            paste();
          }
        } else if (k === "a") {
          e.preventDefault();
          setToolState("select");
          setSel({ c: 0, r: 0, w: page.cols, h: page.rows });
        } else if (k === "0") {
          e.preventDefault();
          fit();
        }
        return;
      }
      if (e.key === " ") {
        e.preventDefault();
        if (!e.repeat) setSpaceHeld(true);
        return;
      }
      if (e.key === "?") return setHelpOpen(true);
      if (e.key === "Escape") return setSel(null);
      if (e.key === "Delete" || e.key === "Backspace") {
        if (sel) {
          e.preventDefault();
          clearSel();
        }
        return;
      }
      if (e.shiftKey && (e.key === "!" || e.code === "Digit1")) return fit();
      if (e.shiftKey && k === "h") return transform("flipH");
      if (e.shiftKey && k === "v") return transform("flipV");
      if (e.key === "]") return transform("cw");
      if (e.key === "[") return transform("ccw");
      if (e.key === "+" || e.key === "=") return zoomBy(1.25);
      if (e.key === "-" || e.key === "_") return zoomBy(0.8);
      if (e.altKey || e.shiftKey) return;
      if (/^[1-9]$/.test(e.key)) {
        const i = Number(e.key) - 1;
        if (doc.mode === "filet") setCur(i === 0 ? 0 : 1);
        else if (i < doc.yarns.length) setCur(i);
        return;
      }
      const map: Record<string, Tool> = { b: "pencil", p: "pencil", u: "rect", r: "rect", g: "fill", f: "fill", i: "pick", m: "select", v: "select", h: "pan" };
      if (map[k]) return setTool(map[k]);
    },
    [h, page, sel, hover, doc, tool, fit, size, startOpen],
  );
  useEffect(() => {
    const up = (e: KeyboardEvent) => e.key === " " && setSpaceHeld(false);
    const blur = () => setSpaceHeld(false);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", blur);
    return () => {
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", blur);
    };
  }, []);

  // ---- panel width drag ----
  const sizer = useRef<{ x: number; w: number } | null>(null);

  const filet = doc.mode === "filet";
  const rowNo = hover ? rowNoOf(hover.r, page.rows, numbering) : null;
  const stNo = hover ? stNoOf(hover.c, page.cols, numbering) : null;
  const leftOpen = tab !== null;
  const onTab = (t: RailTab) => setTab((v) => (v === t ? null : t));
  const [appDialog, setAppDialog] = useState<"share" | "atelier" | null>(null);

  const StatusIcon = status === "error" ? LCloudAlert : status === "saving" ? LCloud : LCloudCheck;
  const statusText = status === "error" ? "저장하지 못했어요" : status === "saving" ? "저장 중" : "저장됨";

  return (
    <div className="flex h-dvh min-h-0 flex-col overflow-hidden bg-bg-layer-fill text-fg-neutral" data-editor-shell>
      <StartDialog open={startOpen} onPick={pickStart} onClose={() => setStartOpen(false)} />
      <ShareDialog open={appDialog === "share"} onClose={() => setAppDialog(null)} work={{ title, craft: "grid", data: doc }} />
      <AtelierDialog open={appDialog === "atelier"} onClose={() => setAppDialog(null)} work={{ id: work.id, title, craft: "grid", data: doc }} />
      <div className="relative flex min-h-0 flex-1 overflow-hidden">
        <Rail tab={tab} onTab={onTab} onPreview={() => (doc.mode === "knit" ? setPreview((v) => !v) : toast("뜬 모습 미리보기는 대바늘 배색에서 볼 수 있어요"))} previewOn={preview && doc.mode === "knit"} onAtelier={() => setAppDialog("atelier")} onShare={() => setAppDialog("share")} onExport={() => setExportOpen(true)} />

        {leftOpen && (
          <div className="absolute inset-y-0 left-14 z-[60] h-full shadow-s3 lg:relative lg:left-0 lg:z-auto lg:shadow-none">
            <div
              role="separator"
              aria-label="패널 너비 조절 (끌어서 바꾸고, 두 번 누르면 원래대로)"
              title="패널 너비 조절 (끌어서 바꾸고, 두 번 누르면 원래대로)"
              className="group/resize absolute inset-y-0 -right-[3px] z-[95] w-1.5 cursor-col-resize touch-none outline-none"
              onDoubleClick={() => setPanelW(PANEL_W)}
              onPointerDown={(e) => {
                (e.currentTarget as Element).setPointerCapture(e.pointerId);
                sizer.current = { x: e.clientX, w: panelW };
              }}
              onPointerMove={(e) => sizer.current && setPanelW(clamp(sizer.current.w + e.clientX - sizer.current.x, 240, 480))}
              onPointerUp={() => (sizer.current = null)}
            >
              <span className="pointer-events-none absolute inset-y-0 left-1/2 w-0.5 -translate-x-1/2 bg-transparent transition-colors group-hover/resize:bg-stroke-brand-solid" />
            </div>
            <aside className="flex h-full min-h-0 shrink-0 flex-col overflow-hidden border-r border-stroke-neutral-muted bg-bg-layer-default" style={{ width: panelW }}>
              <div className="flex h-11 shrink-0 items-center gap-x1 border-b border-stroke-neutral-muted px-x2">
                {renaming ? (
                  <input
                    autoFocus
                    aria-label="도안 이름"
                    defaultValue={title}
                    onFocus={(e) => e.target.select()}
                    onBlur={(e) => commitTitle(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                      if (e.key === "Escape") setRenaming(false);
                    }}
                    className="t4-medium h-8 min-w-0 flex-1 rounded-r2 bg-bg-layer-fill px-x2 text-[1rem] outline-none md:text-size-t4"
                  />
                ) : (
                  <button
                    type="button"
                    title={title}
                    aria-label="도안 이름"
                    onClick={() => setRenaming(true)}
                    className="t4-medium h-8 min-w-0 flex-1 truncate rounded-r2 px-x2 text-left text-fg-neutral enabled:hover:bg-bg-layer-default-pressed"
                  >
                    {title}
                  </button>
                )}
                <span className="inline-flex" title={statusText}>
                  <span role="status" aria-label={statusText} className={cx("flex size-7 shrink-0 items-center justify-center rounded-r2", status === "error" ? "text-fg-critical" : "text-fg-neutral-subtle")}>
                    <StatusIcon className="size-3.5" />
                  </span>
                </span>
                <button type="button" className={cx(ab("ghost", "xsmall"), abBase, "w-x8 px-0")} aria-label="패널 접기" title="패널 접기" onClick={() => setTab(null)} style={el(32, 32)}>
                  <LPanelLeft className="size-4" />
                </button>
              </div>
              {tab === "make" ? (
                <MakePanel
                  kind={makeKind}
                  setKind={(k) => {
                    setMakeKind(k);
                    setAttention(false);
                  }}
                  attention={attention}
                  mode={doc.mode}
                  aspect={aspect}
                  yarns={doc.yarns}
                  fg={current}
                  hasContent={!isEmptyPage(page)}
                  size={{ cols: Math.max(1, page.cols - safe.sts * 2), rows: Math.max(1, page.rows - safe.rows * 2) }}
                  onApply={applyMake}
                />
              ) : (
                <YarnPanel
                  doc={doc}
                  counts={counts}
                  current={current}
                  setCurrent={setCur}
                  onAddYarn={addYarn}
                  onRecolor={recolor}
                  onRemoveYarn={dropYarn}
                  onSelectPage={selectPage}
                  onAddPage={addPage}
                  onRenamePage={renamePage}
                  onDuplicatePage={duplicatePage}
                  onMovePage={movePage}
                  onDeletePage={deletePage}
                />
              )}
            </aside>
          </div>
        )}

        <div className="relative min-h-0 min-w-0 flex-1">
          <div className="h-full w-full">
            <GridCanvas
              page={page}
              yarns={doc.yarns}
              mode={doc.mode}
              aspect={aspect}
              safe={safe}
              numbering={numbering}
              floats={doc.mode === "knit" && doc.showFloats ? floats : null}
              view={view}
              setView={setView}
              tool={tool}
              spaceHeld={spaceHeld}
              paintValue={paintValue}
              mirror={mirror}
              sel={tool === "select" ? sel : null}
              setSel={setSel}
              hover={hover}
              setHover={setHover}
              checkpoint={h.checkpoint}
              commit={commitPage}
              onPick={pick}
              onSize={setSize}
              onEdge={onEdge}
            />
          </div>

          <div className="pointer-events-none absolute inset-x-3 top-3 z-50 flex flex-wrap items-start gap-x2">
            <div className="flex min-w-fit flex-1 flex-col items-start gap-x2">
              <button
                type="button"
                className={cx(
                  ab("neutralOutline", "xsmall"),
                  abBase,
                  "pointer-events-auto h-8 gap-1.5 !rounded-r2 px-2.5 shadow-s2 border-stroke-neutral-muted",
                  written ? "bg-bg-layer-default-pressed text-fg-neutral" : "bg-bg-layer-default text-fg-neutral hover:bg-bg-layer-default-pressed/80",
                )}
                aria-pressed={written}
                onClick={() => setWritten((v) => !v)}
                style={el(78.78125, 32)}
              >
                <LScrollText className="size-3.5" />
                <span className="text-[11px] font-medium leading-none">서술도안</span>
              </button>
              {written && (
                <div className="pointer-events-auto flex max-h-[min(60vh,480px)] w-[min(340px,calc(100vw-120px))] flex-col rounded-r3 border border-stroke-neutral-muted bg-bg-layer-floating shadow-s3">
                  <div className="flex h-10 shrink-0 items-center justify-between gap-x2 border-b border-stroke-neutral-muted pr-x1 pl-x3">
                    <span className="t2-bold">서술형</span>
                    <div className="flex items-center gap-x0_5">
                      <button
                        type="button"
                        className="t1-medium flex h-7 items-center gap-x1 rounded-r1 px-x1_5 text-fg-neutral-muted hover:bg-bg-layer-default-pressed hover:text-fg-neutral"
                        onClick={async () => {
                          try {
                            await navigator.clipboard.writeText(writtenText);
                            toast("서술형을 복사했어요");
                          } catch {
                            toast("복사하지 못했어요");
                          }
                        }}
                      >
                        <LCopy className="size-3.5" />
                        텍스트 복사
                      </button>
                      <button type="button" aria-label="닫기" title="닫기" onClick={() => setWritten(false)} className="flex size-7 items-center justify-center rounded-r1 text-fg-neutral-muted hover:bg-bg-layer-default-pressed">
                        <LX className="size-4" />
                      </button>
                    </div>
                  </div>
                  <pre className="t2-regular min-h-0 flex-1 overflow-auto px-x3 py-x2 font-sans whitespace-pre-wrap text-fg-neutral select-text">{writtenText}</pre>
                </div>
              )}
            </div>
            <div className="pointer-events-auto shrink-0" data-grid-mode="true">
              <Seg
                variant="floating"
                label="기법"
                value={doc.mode}
                onChange={setMode}
                options={[
                  { value: "knit", label: "대바늘 배색" },
                  { value: "tapestry", label: "코바늘 배색" },
                  { value: "filet", label: "코바늘 방안" },
                ]}
              />
            </div>
            <div className="flex min-w-fit flex-1 items-start justify-end gap-x2">
              <button
                type="button"
                className={cx(ab("neutralOutline", "xsmall"), abBase, "pointer-events-auto h-8 gap-1.5 !rounded-r2 border-stroke-neutral-muted bg-bg-layer-default px-2.5 text-fg-neutral shadow-s2 lg:hidden")}
                aria-pressed={rightOpen}
                onClick={() => setRightOpen((v) => !v)}
              >
                <span className="text-[11px] font-medium leading-none">도안 설정</span>
                <PanelRight className="size-3.5" />
              </button>
            </div>
          </div>

          {rowNo !== null && (
            <div className="pointer-events-none absolute bottom-20 left-3 z-40 hidden sm:block">
              <span className="t1-bold rounded-r1 bg-bg-layer-floating/95 px-x2 py-x1 tabular-nums text-fg-neutral shadow-s1">
                {rowNo}단 / {page.rows} · {stNo}
                {filet ? "칸" : "코"}
              </span>
            </div>
          )}

          {sel && tool === "select" && (
            <div className="t2-medium absolute top-14 left-1/2 z-50 flex -translate-x-1/2 items-center gap-x2 rounded-r2 bg-bg-neutral-inverted py-x1 pr-x1 pl-x3 text-fg-neutral-inverted shadow-s2">
              {sel.w} × {sel.h}칸 선택
              <button type="button" aria-label="선택 해제" title="선택 해제 (Esc)" onClick={() => setSel(null)} className="flex size-7 items-center justify-center rounded-r1 hover:bg-white/15">
                <LX className="size-4" />
              </button>
            </div>
          )}

          {preview && doc.mode === "knit" && (
            <KnitPreviewWindow
              title="뜬 모습 미리보기"
              beta
              subtitle={page.name}
              chart={previewChart}
              gauge={doc.gauge}
              fileName={`${safeName(title)}-미리보기`}
              emptyTitle="미리 볼 칸이 없어요"
              emptyHint="칸을 칠하면 대바늘로 뜬 모습으로 보여 드려요."
              closeLabel="차트로 돌아가기"
              onClose={() => setPreview(false)}
            />
          )}

          <Toolbar
            canUndo={h.canUndo}
            canRedo={h.canRedo}
            onUndo={h.undo}
            onRedo={h.redo}
            tool={tool}
            spaceHeld={spaceHeld}
            setTool={setTool}
            mirror={mirror}
            setMirror={setMirror}
            hasSel={!!sel && tool === "select"}
            transform={transform}
            yarns={doc.yarns}
            filet={filet}
            current={current}
            counts={counts}
            setCurrent={setCur}
            onAddYarn={addYarn}
            onRecolor={recolor}
            onRemoveYarn={dropYarn}
          />
        </div>

        <aside
          aria-label="도안 설정"
          className={cx(
            "h-full w-72 shrink-0 flex-col border-l border-stroke-neutral-muted bg-bg-layer-default",
            rightOpen ? "absolute inset-y-0 right-0 z-[60] flex shadow-s3 lg:static lg:shadow-none" : "hidden lg:flex",
          )}
        >
          <RightPanel
            doc={doc}
            page={page}
            zoomPct={Math.round(view.zoom * 100)}
            onZoom={(z) => (z === "fit" ? fit() : zoomTo(z / 100))}
            setNumbering={setNumbering}
            setGauge={setGauge}
            setGaugeTool={setGaugeTool}
            onResize={resize}
            onResizeEnd={resizeEnd}
            onScale={scale}
            setSafeOn={setSafeOn}
            setSafe={setSafeZone}
            safeHit={safeHit}
            setOpt={(patch) => setDoc((d) => ({ ...d, ...patch }), Object.keys(patch)[0] === "floatLimit" ? "floatLimit" : undefined)}
            showChecks={!isEmptyPage(page)}
            floatsCount={floats.length}
            isolatedCount={isolated}
            onCleanup={cleanup}
          />
        </aside>
      </div>

      <Dialog
        open={exportOpen}
        onClose={() => setExportOpen(false)}
        title="내보내기"
        footer={
          <>
            <Button onClick={() => setExportOpen(false)}>취소</Button>
            <Button variant="primary" disabled={busy} onClick={runExport}>
              {busy ? "내보내는 중" : "내보내기"}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-x3">
          <Seg
            label="형식"
            value={format}
            onChange={setFormat}
            options={[
              { value: "png", label: "PNG" },
              { value: "jpg", label: "JPG" },
              { value: "svg", label: "SVG" },
            ]}
          />
          <p className="t2-regular text-fg-neutral-muted">{format === "svg" ? "확대해도 선명한 벡터 파일이에요." : "고화질(2배)로 저장해요. 인쇄용이면 PNG를 추천해요."}</p>
          <Checkbox checked={!!doc.exportGauge} onChange={(v) => setDoc((d) => ({ ...d, exportGauge: v }))}>
            게이지 정보 넣기
          </Checkbox>
        </div>
      </Dialog>

      <Dialog open={helpOpen} onClose={() => setHelpOpen(false)} title="단축키" width={560}>
        <div className="grid gap-x5 sm:grid-cols-2">
          {SHORTCUTS.map((g) => (
            <section key={g.title}>
              <h3 className="t2-bold mb-x2 text-fg-neutral-muted">{g.title}</h3>
              <ul className="flex flex-col gap-x1_5">
                {g.items.map((s) => (
                  <li key={s.label} className="t3-regular flex items-center justify-between gap-x3">
                    <span>{s.label}</span>
                    <kbd className="t1-regular rounded-r1 border border-stroke-neutral-muted bg-bg-layer-fill px-x1_5 py-0.5 font-sans text-fg-neutral-muted">{s.keys}</kbd>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </Dialog>
    </div>
  );
}
