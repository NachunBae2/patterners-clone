"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { EditorShell, openShortcutHelp, type ShortcutGroup } from "@/components/app/EditorShell";
import { Bucket, Fit, FlipH, FlipV, Hand, Minus, Pencil, Pipette, Plus, RotateCcw, RotateCw, X } from "@/components/app/icons";
import { Button, IconButton, cx, isMod, useHotkeys, useToast } from "@/components/app/ui";
import { safeName, exportSvg, svgThumbnail } from "@/lib/export";
import { works } from "@/lib/store";
import { useAutosave } from "@/lib/useAutosave";
import { useHistory } from "@/lib/useHistory";
import type { GridData, GridMode, GridPage, View, Work } from "@/lib/types";
import type { Converted } from "./convert";
import { GridCanvas, ZOOM_MAX, ZOOM_MIN, type Tool } from "./GridCanvas";
import { Mirror, PanelLeft, PanelRight, RectFill, SelectRect, Wand } from "./icons";
import {
  type AnchorH,
  type AnchorV,
  type Block,
  type GridDoc,
  type Rect,
  DEFAULT_FLOAT,
  MAX_COLORS,
  activePage,
  blankPage,
  cellAspect,
  clamp,
  cleanupCells,
  clipRect,
  fillRect,
  findFloats,
  getBlock,
  isBrandNew,
  isEmptyPage,
  isolatedCells,
  padPage,
  putBlock,
  removeYarn,
  resizePage,
  safeZoneHit,
  stitchCounts,
  transformPage,
  transformSelection,
  withSafe,
} from "./model";
import { LeftPanel, RightPanel, yarnName } from "./Panels";
import { CELL, FOOT, GUTTER, chartSvg, thumbSvg } from "./render";
import { StartDialog, type StartKind, type StartStep } from "./StartDialog";

const SHORTCUTS: ShortcutGroup[] = [
  {
    title: "도구",
    items: [
      { keys: "P", label: "연필" },
      { keys: "Shift+드래그", label: "네모 칠하기" },
      { keys: "R", label: "사각형" },
      { keys: "F", label: "채우기" },
      { keys: "I", label: "스포이트" },
      { keys: "Alt+클릭", label: "연필 중 색 집기" },
      { keys: "V", label: "선택" },
      { keys: "M", label: "좌우 대칭 그리기" },
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

function normalize(data: GridData): GridDoc {
  const d = structuredClone(data) as GridDoc;
  if (!d.yarns?.length) d.yarns = ["#ffffff", "#24365c"];
  if (d.yarns.length < 2) d.yarns.push("#24365c");
  if (!d.pages?.length) {
    const p = blankPage("페이지 1", 40, 30);
    d.pages = [p];
  }
  if (!d.pages.some((p) => p.id === d.activePageId)) d.activePageId = d.pages[0].id;
  d.mode ??= "knit";
  d.gauge ??= { sts: 22, rows: 30 };
  return d;
}

export default function GridEditor({ work, data }: { work: Work; data: GridData }) {
  const toast = useToast();
  const h = useHistory<GridDoc>(useMemo(() => normalize(data), [data]));
  const doc = h.state;
  const page = activePage(doc);
  const aspect = cellAspect(doc.mode, doc.gauge);
  const safe = doc.safe ?? { sts: 0, rows: 0 };

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
  const [leftOpen, setLeftOpen] = useState(false);
  const [rightOpen, setRightOpen] = useState(false);
  const [start, setStart] = useState<{ open: boolean; step: StartStep }>(() => ({ open: isBrandNew(normalize(data)), step: "choose" }));
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
    const W = page.cols * CELL + GUTTER * 2 + 16;
    const H = page.rows * CELL * aspect + FOOT + 16;
    const availH = size.h - 148;
    const z = clamp(Math.min((size.w - 48) / W, availH / H), ZOOM_MIN, ZOOM_MAX);
    setView({ zoom: z, x: (size.w - page.cols * CELL * z) / 2, y: 24 + (availH - (page.rows * CELL * aspect + FOOT) * z) / 2 });
  }, [size.w, size.h, page.cols, page.rows, aspect]);
  const fitKey = `${page.id}:${page.cols}x${page.rows}:${aspect.toFixed(3)}:${size.w}x${size.h}`;
  const lastFit = useRef("");
  useEffect(() => {
    if (!size.w || lastFit.current === fitKey) return;
    lastFit.current = fitKey;
    fit();
  }, [fitKey, fit, size.w]);
  const zoomBy = (k: number) =>
    setView((v) => {
      const z = clamp(v.zoom * k, ZOOM_MIN, ZOOM_MAX);
      const mx = size.w / 2;
      const my = size.h / 2;
      return { zoom: z, x: mx - ((mx - v.x) * z) / v.zoom, y: my - ((my - v.y) * z) / v.zoom };
    });

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
    } else editPage((p) => transformPage(p, op));
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
  const setSafeZone = (s: { sts: number; rows: number }) => {
    const ds = s.sts - safe.sts;
    const dr = s.rows - safe.rows;
    setDoc((d) => ({ ...d, safe: s, pages: d.pages.map((p) => padPage(p, ds, dr, ds, dr)) }), "safe");
    setSel(null);
  };
  const resize = (cols: number, rows: number, ah: AnchorH, av: AnchorV) => {
    editPage((p) => resizePage(p, cols, rows, ah, av));
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

  const applyStart = (kind: StartKind, r: Converted) => {
    const wrapped = withSafe(r.cells, r.cols, r.rows, safe);
    setDoc((d) => {
      let yarns = d.yarns;
      if (kind === "image" && r.yarns?.length) {
        yarns = r.yarns.slice(0, MAX_COLORS);
        if (yarns.length < 2) yarns.push("#24365c");
      }
      return {
        ...d,
        yarns,
        pages: d.pages.map((p) => (p.id === page.id ? { ...p, ...wrapped } : p)),
      };
    });
    if (kind === "image") setCur(1);
    setSel(null);
    setStart((s) => ({ ...s, open: false }));
  };

  const cleanup = () => editPage((p) => ({ ...p, cells: cleanupCells(p.cells, p.cols, p.rows) }));

  const onExport = async (format: "png" | "jpg" | "svg") => {
    if (isEmptyPage(page) && doc.mode !== "filet") return false;
    const title = works.get(work.id)?.title ?? work.title;
    const name = doc.pages.length > 1 ? `${title}-${page.name}` : title;
    await exportSvg(chartSvg(doc, page, aspect), format, safeName(name));
    return true;
  };

  // ---- keyboard ----
  useHotkeys(
    (e) => {
      const k = e.key.toLowerCase();
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
      if (e.key === "?") return openShortcutHelp();
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
      const map: Record<string, Tool> = { p: "pencil", b: "pencil", r: "rect", f: "fill", i: "pick", v: "select", h: "pan" };
      if (map[k]) return setTool(map[k]);
      if (k === "m") setMirror((m) => !m);
    },
    [h, page, sel, hover, doc, tool, fit, size],
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

  const filet = doc.mode === "filet";
  const colorsUsed = counts.filter((n) => n > 0).length;
  const total = page.rows;
  const rowNo = hover ? total - hover.r : null;
  const stNo = hover ? ((doc.hand ?? "right") === "right" ? page.cols - hover.c : hover.c + 1) : null;
  const makeOpen = () => setStart({ open: true, step: "choose" });

  return (
    <EditorShell
      workId={work.id}
      title={work.title}
      craftLabel="배색·방안"
      status={status}
      canUndo={h.canUndo}
      canRedo={h.canRedo}
      onUndo={h.undo}
      onRedo={h.redo}
      onExport={onExport}
      shortcuts={SHORTCUTS}
      actions={
        <Button size="sm" variant="ghost" className="mr-x1 hidden md:inline-flex" onClick={makeOpen}>
          <Wand className="size-4" />
          글자·이미지로 만들기
        </Button>
      }
    >
      <div className="absolute inset-0 flex">
        {/* left: yarns + pages */}
        <aside
          aria-label="실·페이지"
          className={cx(
            "z-20 w-[264px] shrink-0 border-r border-stroke-neutral-muted bg-bg-layer-default",
            leftOpen ? "absolute inset-y-0 left-0 shadow-s3 lg:static lg:shadow-none" : "hidden lg:block",
          )}
        >
          <LeftPanel
            doc={doc}
            page={page}
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
        </aside>

        <main className="relative min-w-0 flex-1">
          <GridCanvas
            page={page}
            yarns={doc.yarns}
            mode={doc.mode}
            aspect={aspect}
            safe={safe}
            working={doc.working ?? "flat"}
            hand={doc.hand ?? "right"}
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
          />

          {/* small-screen panel toggles */}
          <div className="absolute top-3 left-3 flex gap-x2 lg:hidden">
            <Button size="sm" onClick={() => setLeftOpen((v) => !v)} aria-pressed={leftOpen}>
              <PanelLeft className="size-4" />
              실·페이지
            </Button>
          </div>
          <div className="absolute top-3 right-3 lg:hidden">
            <Button size="sm" onClick={() => setRightOpen((v) => !v)} aria-pressed={rightOpen}>
              도안 설정
              <PanelRight className="size-4" />
            </Button>
          </div>

          {/* bottom-left readout */}
          <div className="pointer-events-none absolute bottom-4 left-4 hidden flex-col gap-x1 text-[0.75rem] text-fg-neutral-muted tabular-nums sm:flex">
            {rowNo !== null && (
              <span className="w-fit rounded-r1_5 bg-bg-layer-default/90 px-x2 py-x1 font-semibold text-fg-neutral shadow-s1">
                {rowNo}단 / {total} · {stNo}코
              </span>
            )}
            <span className="w-fit rounded-r1_5 bg-bg-layer-default/90 px-x2 py-x1 shadow-s1">
              {page.cols} × {page.rows}칸 · {filet ? 2 : colorsUsed}색
            </span>
          </div>

          {/* toolbar */}
          <div className="pointer-events-none absolute inset-x-0 bottom-4 flex justify-center px-x3">
            <div role="toolbar" aria-label="도구" className="pointer-events-auto flex max-w-full items-center gap-x0_5 overflow-x-auto rounded-r4 bg-bg-layer-default p-x1_5 shadow-s2">
              <ToolBtn label="연필 · Shift+드래그로 네모 칠하기" shortcut="P" active={tool === "pencil"} onClick={() => setTool("pencil")}>
                <Pencil />
              </ToolBtn>
              <ToolBtn label="사각형" shortcut="R" active={tool === "rect"} onClick={() => setTool("rect")}>
                <RectFill />
              </ToolBtn>
              <ToolBtn label="채우기" shortcut="F" active={tool === "fill"} onClick={() => setTool("fill")}>
                <Bucket />
              </ToolBtn>
              <ToolBtn label="스포이트" shortcut="I" active={tool === "pick"} onClick={() => setTool("pick")}>
                <Pipette />
              </ToolBtn>
              <ToolBtn label="선택" shortcut="V" active={tool === "select"} onClick={() => setTool("select")}>
                <SelectRect />
              </ToolBtn>
              <ToolBtn label="화면 이동" shortcut="Space" active={tool === "pan" || spaceHeld} onClick={() => setTool("pan")}>
                <Hand />
              </ToolBtn>
              <Sep />
              <ToolBtn label="좌우 반전" shortcut="⇧H" onClick={() => transform("flipH")}>
                <FlipH />
              </ToolBtn>
              <ToolBtn label="상하 반전" shortcut="⇧V" onClick={() => transform("flipV")}>
                <FlipV />
              </ToolBtn>
              <ToolBtn label={sel ? "선택 영역 반시계 방향으로 90° 회전" : "반시계 방향으로 90° 회전"} shortcut="[" onClick={() => transform("ccw")}>
                <RotateCcw />
              </ToolBtn>
              <ToolBtn label={sel ? "선택 영역 시계 방향으로 90° 회전" : "시계 방향으로 90° 회전"} shortcut="]" onClick={() => transform("cw")}>
                <RotateCw />
              </ToolBtn>
              <ToolBtn label="좌우 대칭 그리기" shortcut="M" active={mirror} onClick={() => setMirror((m) => !m)}>
                <Mirror />
              </ToolBtn>
              <Sep />
              <div className="flex items-center gap-x1 px-x1" role="group" aria-label="실">
                {filet ? (
                  <>
                    <Chip color={doc.yarns[1] ?? "#24365c"} label="채운칸" active={current >= 1} onClick={() => setCur(1)} />
                    <Chip color="#ffffff" label="빈칸" active={current === 0} onClick={() => setCur(0)} />
                  </>
                ) : (
                  doc.yarns.slice(0, 8).map((c, i) => <Chip key={i} color={c} label={yarnName(i)} active={current === i} onClick={() => setCur(i)} />)
                )}
              </div>
            </div>
          </div>

          {/* zoom */}
          <div className="absolute right-4 bottom-20 hidden items-center gap-x0_5 rounded-r3 bg-bg-layer-default p-x1 shadow-s2 md:flex">
            <IconButton label="축소" shortcut="-" size="sm" onClick={() => zoomBy(0.8)}>
              <Minus />
            </IconButton>
            <button type="button" aria-label="확대 비율" onClick={() => setView((v) => ({ ...v, zoom: 1 }))} className="h-8 w-12 rounded-r2 text-[0.75rem] font-semibold tabular-nums hover:bg-bg-layer-fill">
              {Math.round(view.zoom * 100)}%
            </button>
            <IconButton label="확대" shortcut="+" size="sm" onClick={() => zoomBy(1.25)}>
              <Plus />
            </IconButton>
            <IconButton label="전체 맞춤" shortcut="⇧1" size="sm" onClick={fit}>
              <Fit />
            </IconButton>
          </div>

          {sel && tool === "select" && (
            <div className="absolute top-3 left-1/2 flex -translate-x-1/2 items-center gap-x2 rounded-r3 bg-bg-neutral-inverted py-x1 pr-x1 pl-x3 text-[0.8125rem] text-fg-neutral-inverted shadow-s2">
              {sel.w} × {sel.h}칸 선택
              <IconButton label="선택 해제" shortcut="Esc" size="sm" className="text-fg-neutral-inverted hover:bg-white/15" onClick={() => setSel(null)}>
                <X />
              </IconButton>
            </div>
          )}
        </main>

        {/* right: mode + settings + checks */}
        <aside
          aria-label="도안 설정"
          className={cx(
            "z-20 w-[280px] shrink-0 border-l border-stroke-neutral-muted bg-bg-layer-default",
            rightOpen ? "absolute inset-y-0 right-0 shadow-s3 lg:static lg:shadow-none" : "hidden lg:block",
          )}
        >
          <RightPanel
            doc={doc}
            page={page}
            setMode={setMode}
            setGauge={setGauge}
            setSafe={setSafeZone}
            safeHit={safeHit}
            setOpt={(patch) => setDoc((d) => ({ ...d, ...patch }), Object.keys(patch)[0] === "floatLimit" ? "floatLimit" : undefined)}
            onResize={resize}
            floatsCount={floats.length}
            isolatedCount={isolated}
            onCleanup={cleanup}
            onMake={makeOpen}
          />
        </aside>
      </div>

      <StartDialog
        open={start.open}
        step={start.step}
        onStep={(s) => setStart({ open: true, step: s })}
        onClose={() => setStart((s) => ({ ...s, open: false }))}
        mode={doc.mode}
        aspect={aspect}
        yarns={doc.yarns}
        fg={current}
        hasContent={!isEmptyPage(page)}
        defaultSize={{ cols: Math.max(1, page.cols - safe.sts * 2), rows: Math.max(1, page.rows - safe.rows * 2) }}
        onApply={applyStart}
      />
    </EditorShell>
  );
}

function ToolBtn(p: { label: string; shortcut?: string; active?: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <IconButton label={p.label} shortcut={p.shortcut} active={p.active} onClick={p.onClick}>
      {p.children}
    </IconButton>
  );
}

const Sep = () => <span aria-hidden className="mx-x1 h-6 w-px shrink-0 bg-stroke-neutral-muted" />;

function Chip({ color, label, active, onClick }: { color: string; label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={active}
      title={label}
      onClick={onClick}
      className={cx("size-6 shrink-0 rounded-full border border-black/15 transition-transform", active ? "scale-110 ring-2 ring-stroke-neutral-contrast ring-offset-2" : "hover:scale-105")}
      style={{ background: color }}
    />
  );
}
