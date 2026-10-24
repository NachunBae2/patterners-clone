"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Button, Dialog, cx, isMod, useHotkeys, useToast } from "@/components/app/ui";
import { Seg, ab, abBase, el } from "@/components/editor/grid/fields";
import { BrandMark, LCloud, LCloudAlert, LCloudCheck, LCopy, LDownload, LPanelLeft, LRedo2, LScrollText, LUndo2, LX, PanelRight } from "@/components/editor/grid/icons";
import { download, exportSvg, safeName, svgThumbnail } from "@/lib/export";
import { works, useWorkList } from "@/lib/store";
import { useAutosave } from "@/lib/useAutosave";
import { useHistory } from "@/lib/useHistory";
import type { ApparelData, View, Work } from "@/lib/types";
import { LCalculator, LLayers, LMaximize, LPrinter, LRuler, LShirt, LZoomIn, LZoomOut } from "./icons";
import { DEFAULT_GAUGE, FIT_EASE, SIZES, V_NECK_EXTRA, cm1, draft, writtenPattern } from "./model";
import { CalcPanel, GaugePanel, LayerPanel, ShapePanel, SizePanel, type OverlaySource } from "./Panels";
import { PrintPortal } from "./PrintPortal";
import { sheetSvg } from "./render";

type Tab = "shape" | "size" | "gauge" | "layer";
const TAB_LABEL: Record<Tab, string> = { shape: "형태", size: "치수", gauge: "게이지", layer: "도안 레이어" };
const PANEL_W = 296;
const ZMIN = 0.1;
const ZMAX = 6;
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

function normalize(data: ApparelData): ApparelData {
  const d = structuredClone(data);
  const base: ApparelData["measure"] = { ...SIZES.M, shoulderDrop: 2, hemRib: 5, cuffRib: 5 };
  d.measure = { ...base, ...d.measure };
  d.ease ??= { ...FIT_EASE.regular };
  d.gauge ??= { ...DEFAULT_GAUGE.knit };
  d.style ??= "setIn";
  d.neckline ??= "round";
  d.craft ??= "knit";
  d.size ??= "M";
  d.fit ??= "regular";
  d.bandWidth ??= 3;
  d.buttons ??= 5;
  d.showDims ??= true;
  return d;
}

function RailButton(p: { label: string; active?: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-label={p.label}
      title={p.label}
      aria-pressed={p.active}
      onClick={p.onClick}
      className={cx(ab(p.active ? "brandSolid" : "ghost", "small", "iconOnly"), !p.active && "text-fg-neutral-muted")}
      style={el(36, 36)}
    >
      {p.children}
    </button>
  );
}

function TB(p: { label: string; active?: boolean; disabled?: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <span className="inline-flex">
      <button
        type="button"
        className={cx(ab(p.active ? "brandSolid" : "ghost", "xsmall"), abBase, "w-x8 px-0")}
        aria-label={p.label}
        title={p.label}
        aria-pressed={p.active}
        disabled={p.disabled}
        data-disabled={p.disabled ? "" : undefined}
        onClick={p.onClick}
        style={el(32, 32)}
      >
        {p.children}
      </button>
    </span>
  );
}
const Sep = () => <div className="mx-x0_5 h-6 w-px bg-stroke-neutral-muted" />;

export default function ApparelEditor({ work, data }: { work: Work; data: ApparelData }) {
  const toast = useToast();
  const h = useHistory<ApparelData>(useMemo(() => normalize(data), [data]));
  const d = h.state;
  const dr = useMemo(() => draft(d), [d]);
  const list = useWorkList();

  const [tab, setTab] = useState<Tab | null>("shape");
  const [rightOpen, setRightOpen] = useState(false);
  const [written, setWritten] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [title, setTitle] = useState(work.title);
  const [renaming, setRenaming] = useState(false);
  const [view, setView] = useState<View>({ x: 0, y: 0, zoom: 1 });
  const [size, setSize] = useState({ w: 0, h: 0 });

  // ---- doc edits (drags on one field fold into one undo step) ----
  const lastKey = useRef<{ key: string; t: number } | null>(null);
  const set = useCallback(
    (fn: (x: ApparelData) => ApparelData, key?: string) => {
      const now = Date.now();
      const merge = !!key && lastKey.current?.key === key && now - lastKey.current.t < 1200;
      lastKey.current = key ? { key, t: now } : null;
      h.set(fn, { merge });
    },
    [h],
  );

  // ---- overlay sources: the user's chart works with a thumbnail ----
  const sources: OverlaySource[] = useMemo(
    () => list.filter((w) => !w.deletedAt && w.id !== work.id && (w.craft === "crochet" || w.craft === "knitting" || w.craft === "grid")).map((w) => ({ id: w.id, title: w.title, craft: w.craft, thumbnail: w.thumbnail })),
    [list, work.id],
  );
  const overlayHref = d.overlay ? (sources.find((s) => s.id === d.overlay!.workId)?.thumbnail ?? null) : null;

  const sheet = useMemo(() => sheetSvg(d, dr, { overlayHref }), [d, dr, overlayHref]);

  // ---- autosave + thumbnail (no overlay / dims, keeps the index small) ----
  const status = useAutosave(work.id, d, () => svgThumbnail(sheetSvg(d, dr, { dims: false, thumb: true }).svg));

  // ---- view ----
  const fit = useCallback(() => {
    if (!size.w || !size.h) return;
    const z = clamp(Math.min((size.w - 64) / sheet.width, (size.h - 150) / sheet.height), ZMIN, ZMAX);
    setView({ zoom: z, x: (size.w - sheet.width * z) / 2, y: Math.max(56, (size.h - 70 - sheet.height * z) / 2 + 20) });
  }, [size.w, size.h, sheet.width, sheet.height]);
  const fitKey = `${Math.round(sheet.width / 40)}x${Math.round(sheet.height / 40)}:${size.w}x${size.h}`;
  const lastFit = useRef("");
  useEffect(() => {
    if (!size.w || lastFit.current === fitKey) return;
    lastFit.current = fitKey;
    fit();
  }, [fitKey, fit, size.w]);
  const zoomTo = (z: number) =>
    setView((v) => {
      const nz = clamp(z, ZMIN, ZMAX);
      const mx = size.w / 2;
      const my = size.h / 2;
      return { zoom: nz, x: mx - ((mx - v.x) * nz) / v.zoom, y: my - ((my - v.y) * nz) / v.zoom };
    });

  // ---- actions ----
  const onSize = (s: ApparelData["size"]) => set((x) => ({ ...x, size: s, measure: { ...x.measure, ...SIZES[s], ...(x.neckline === "v" ? { frontNeckDepth: SIZES[s].frontNeckDepth + V_NECK_EXTRA } : {}) } }));
  const onFit = (f: ApparelData["fit"]) => set((x) => ({ ...x, fit: f, ease: { ...FIT_EASE[f] } }));
  const onResetMeasure = () => onSize(d.size);
  const onCraft = (c: ApparelData["craft"]) =>
    set((x) => {
      const other = DEFAULT_GAUGE[x.craft];
      const keep = x.gauge.sts !== other.sts || x.gauge.rows !== other.rows;
      return { ...x, craft: c, gauge: keep ? x.gauge : { ...DEFAULT_GAUGE[c] } };
    });
  const onNeckline = (n: ApparelData["neckline"]) =>
    set((x) => {
      if (x.neckline === n) return x;
      const depth = n === "v" ? x.measure.frontNeckDepth + V_NECK_EXTRA : Math.max(4, x.measure.frontNeckDepth - V_NECK_EXTRA);
      return { ...x, neckline: n, measure: { ...x.measure, frontNeckDepth: depth } };
    });

  const commitTitle = (v: string) => {
    const t = v.trim().slice(0, 60) || "제목 없는 의류 도안";
    setTitle(t);
    works.update(work.id, { title: t, updatedAt: Date.now() });
    setRenaming(false);
  };

  const writtenText = useMemo(() => writtenPattern(d, dr, title), [d, dr, title]);

  const [format, setFormat] = useState<"png" | "jpg" | "svg" | "txt">("png");
  const [busy, setBusy] = useState(false);
  const runExport = async () => {
    setBusy(true);
    try {
      const name = safeName(title);
      if (format === "txt") download(new Blob([writtenText], { type: "text/plain;charset=utf-8" }), `${name}.txt`);
      else await exportSvg(sheetSvg(d, dr, { overlayHref, title, dims: true }).svg, format, name);
      setExportOpen(false);
    } catch {
      toast("내보내기에 실패했어요");
    } finally {
      setBusy(false);
    }
  };
  const print = () => {
    setExportOpen(false);
    // let the print sheet render with the latest numbers first
    requestAnimationFrame(() => window.print());
  };

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
        } else if (k === "p") {
          e.preventDefault();
          print();
        } else if (k === "0") {
          e.preventDefault();
          fit();
        }
        return;
      }
      if (e.shiftKey && (e.key === "!" || e.code === "Digit1")) return fit();
      if (e.key === "+" || e.key === "=") return zoomTo(view.zoom * 1.25);
      if (e.key === "-" || e.key === "_") return zoomTo(view.zoom * 0.8);
    },
    [h, fit, view.zoom, size],
  );

  const onTab = (t: Tab) => setTab((v) => (v === t ? null : t));
  const StatusIcon = status === "error" ? LCloudAlert : status === "saving" ? LCloud : LCloudCheck;
  const statusText = status === "error" ? "저장하지 못했어요" : status === "saving" ? "저장 중" : "저장됨";

  return (
    <div className="flex h-dvh min-h-0 flex-col overflow-hidden bg-bg-layer-fill text-fg-neutral" data-editor-shell data-apparel-editor="">
      <div className="relative flex min-h-0 flex-1 overflow-hidden">
        <nav aria-label="도안 메뉴" className="relative z-[90] flex h-full w-14 shrink-0 flex-col items-center border-r border-stroke-neutral-muted bg-bg-layer-default px-x1 py-x2">
          <Link
            href="/home"
            aria-label="PATTERNERS"
            className="mb-x3 flex size-x9 items-center justify-center rounded-r2 text-fg-neutral hover:bg-bg-layer-default-pressed focus-visible:outline-2 focus-visible:outline-stroke-focus-ring"
          >
            <BrandMark className="size-8 overflow-hidden rounded-md" />
          </Link>
          <div className="flex flex-col items-center gap-x1">
            <RailButton label="형태" active={tab === "shape"} onClick={() => onTab("shape")}>
              <LShirt className="seed-icon" />
            </RailButton>
            <RailButton label="치수" active={tab === "size"} onClick={() => onTab("size")}>
              <LRuler className="seed-icon" />
            </RailButton>
            <RailButton label="게이지" active={tab === "gauge"} onClick={() => onTab("gauge")}>
              <LCalculator className="seed-icon" />
            </RailButton>
            <RailButton label="도안 레이어" active={tab === "layer"} onClick={() => onTab("layer")}>
              <LLayers className="seed-icon" />
            </RailButton>
          </div>
          <div className="mt-auto flex flex-col items-center gap-x1 pb-x2">
            <div className="mb-x1 h-px w-7 bg-stroke-neutral-muted" />
            <RailButton label="인쇄" onClick={print}>
              <LPrinter className="seed-icon" />
            </RailButton>
            <RailButton label="내보내기" onClick={() => setExportOpen(true)}>
              <LDownload className="seed-icon" />
            </RailButton>
          </div>
        </nav>

        {tab && (
          <div className="absolute inset-y-0 left-14 z-[60] h-full shadow-s3 lg:relative lg:left-0 lg:z-auto lg:shadow-none">
            <aside className="flex h-full min-h-0 shrink-0 flex-col overflow-hidden border-r border-stroke-neutral-muted bg-bg-layer-default" style={{ width: PANEL_W }}>
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
              <div className="flex h-10 shrink-0 items-center justify-between border-b border-stroke-neutral-muted px-x3">
                <span className="t3-bold text-fg-neutral">{TAB_LABEL[tab]}</span>
                <span className="seed-badge__root seed-badge__root--size_medium seed-badge__root--variant_weak seed-badge__root--tone_brand seed-badge__root--tone_brand-variant_weak">
                  <span className="seed-badge__label seed-badge__label--size_medium seed-badge__label--variant_weak seed-badge__label--tone_brand seed-badge__label--tone_brand-variant_weak">beta</span>
                </span>
              </div>
              {tab === "shape" && <ShapePanel d={d} set={set} onCraft={onCraft} onNeckline={onNeckline} />}
              {tab === "size" && <SizePanel d={d} set={set} onSize={onSize} onFit={onFit} onResetMeasure={onResetMeasure} />}
              {tab === "gauge" && <GaugePanel d={d} set={set} />}
              {tab === "layer" && <LayerPanel d={d} set={set} sources={sources} />}
            </aside>
          </div>
        )}

        <div className="relative min-h-0 min-w-0 flex-1">
          <SheetCanvas svg={sheet.svg} width={sheet.width} height={sheet.height} view={view} setView={setView} onSize={setSize} />

          <div className="pointer-events-none absolute inset-x-3 top-3 z-50 flex flex-wrap items-start gap-x2">
            <div className="flex min-w-fit flex-1 flex-col items-start gap-x2">
              <button
                type="button"
                className={cx(
                  ab("neutralOutline", "xsmall"),
                  abBase,
                  "pointer-events-auto h-8 gap-1.5 !rounded-r2 border-stroke-neutral-muted px-2.5 shadow-s2",
                  written ? "bg-bg-layer-default-pressed text-fg-neutral" : "bg-bg-layer-default text-fg-neutral hover:bg-bg-layer-default-pressed/80",
                )}
                aria-pressed={written}
                onClick={() => setWritten((v) => !v)}
                style={el(78.78125, 32)}
              >
                <LScrollText className="size-3.5" />
                <span className="text-[11px] leading-none font-medium">서술도안</span>
              </button>
              {written && (
                <div className="pointer-events-auto flex max-h-[min(60vh,520px)] w-[min(380px,calc(100vw-120px))] flex-col rounded-r3 border border-stroke-neutral-muted bg-bg-layer-floating shadow-s3">
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
                  <pre className="t2-regular min-h-0 flex-1 overflow-auto px-x3 py-x2 font-sans whitespace-pre-wrap text-fg-neutral select-text" data-apparel-written="">
                    {writtenText}
                  </pre>
                </div>
              )}
            </div>
            <div className="pointer-events-auto shrink-0">
              <Seg
                variant="floating"
                label="형태"
                value={d.style}
                onChange={(style) => set((x) => ({ ...x, style }))}
                options={[
                  { value: "setIn", label: "셋인 소매" },
                  { value: "dropShoulder", label: "드롭숄더" },
                  { value: "vest", label: "베스트" },
                  { value: "raglan", label: "래글런" },
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
                <span className="text-[11px] leading-none font-medium">코수 계산</span>
                <PanelRight className="size-3.5" />
              </button>
            </div>
          </div>

          <div className="pointer-events-none absolute inset-x-0 bottom-0 z-50 flex px-3 pt-4 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
            <div role="toolbar" aria-label="도구" className="maker-bottom-tools pointer-events-auto mx-auto flex shrink-0 items-center gap-x1 rounded-r4 border border-stroke-neutral-muted bg-bg-layer-floating/95 p-x1_5 shadow-s3 backdrop-blur-md">
              <div className="flex items-center gap-0.5">
                <TB label="실행 취소" disabled={!h.canUndo} onClick={h.undo}>
                  <LUndo2 />
                </TB>
                <TB label="다시 실행" disabled={!h.canRedo} onClick={h.redo}>
                  <LRedo2 />
                </TB>
              </div>
              <Sep />
              <div className="flex items-center gap-0.5">
                <TB label="축소" onClick={() => zoomTo(view.zoom * 0.8)}>
                  <LZoomOut />
                </TB>
                <button type="button" title="화면에 맞추기 (Shift+1)" onClick={fit} className="t2-medium h-8 min-w-12 rounded-r2 px-x1 tabular-nums text-fg-neutral hover:bg-bg-layer-default-pressed">
                  {Math.round(view.zoom * 100)}%
                </button>
                <TB label="확대" onClick={() => zoomTo(view.zoom * 1.25)}>
                  <LZoomIn />
                </TB>
                <TB label="화면에 맞추기" onClick={fit}>
                  <LMaximize />
                </TB>
              </div>
              <Sep />
              <TB label="치수 표기" active={d.showDims} onClick={() => set((x) => ({ ...x, showDims: !x.showDims }))}>
                <LRuler />
              </TB>
            </div>
          </div>
        </div>

        <aside
          aria-label="코수 계산"
          className={cx(
            "h-full w-72 shrink-0 flex-col border-l border-stroke-neutral-muted bg-bg-layer-default",
            rightOpen ? "absolute inset-y-0 right-0 z-[60] flex shadow-s3 lg:static lg:shadow-none" : "hidden lg:flex",
          )}
        >
          <CalcPanel d={d} dr={dr} />
        </aside>
      </div>

      <Dialog
        open={exportOpen}
        onClose={() => setExportOpen(false)}
        title="내보내기"
        footer={
          <>
            <Button onClick={print}>
              <LPrinter className="size-4" />
              인쇄
            </Button>
            <span className="flex-1" />
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
              { value: "txt", label: "서술 (TXT)" },
            ]}
          />
          <p className="t2-regular text-fg-neutral-muted">
            {format === "svg"
              ? "앞판·뒤판·소매 제도를 확대해도 선명한 벡터 파일로 저장해요."
              : format === "txt"
                ? "판마다 코수·단수와 줄임·늘림 순서를 글로 저장해요."
                : "제도와 치수를 고화질(2배) 이미지로 저장해요."}
          </p>
          <p className="t2-regular text-fg-neutral-muted">PDF가 필요하면 인쇄에서 ‘PDF로 저장’을 고르세요. 제도, 코수 계산, 서술도안이 함께 인쇄돼요.</p>
        </div>
      </Dialog>

      <PrintPortal>
        <ApparelPrint title={title} d={d} svg={sheetSvg(d, dr, { overlayHref, dims: true, idPrefix: "print" }).svg} written={writtenText} dr={dr} />
      </PrintPortal>
    </div>
  );
}

function ApparelPrint({ title, d, svg, written, dr }: { title: string; d: ApparelData; svg: string; written: string; dr: ReturnType<typeof draft> }) {
  return (
    <div style={{ padding: 0 }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, margin: "0 0 4px" }}>{title}</h1>
      <p style={{ fontSize: 12, color: "#555", margin: "0 0 12px" }}>
        게이지 10cm = {d.gauge.sts}코 × {d.gauge.rows}단 · 완성 가슴둘레 {cm1(dr.finished.bust)}cm · 옷길이 {cm1(dr.finished.length)}cm
      </p>
      <div className="print-avoid" style={{ width: "100%" }} dangerouslySetInnerHTML={{ __html: svg.replace(/<svg ([^>]*?)width="[\d.]+" height="[\d.]+"/, '<svg $1style="width:100%;height:auto;max-height:130mm"') }} />
      <table className="print-avoid" style={{ width: "100%", borderCollapse: "collapse", fontSize: 11, margin: "12px 0" }}>
        <thead>
          <tr>
            {["피스", "시작 코", "총 단수", "가장 넓은 곳", "완성 크기"].map((t) => (
              <th key={t} style={{ textAlign: "left", borderBottom: "1px solid #999", padding: "4px 6px" }}>
                {t}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {dr.pieces.map((p) => (
            <tr key={p.id}>
              <td style={{ borderBottom: "1px solid #ddd", padding: "4px 6px" }}>
                {p.name}
                {p.count > 1 ? ` ×${p.count}` : ""}
              </td>
              <td style={{ borderBottom: "1px solid #ddd", padding: "4px 6px" }}>{p.castOn}코</td>
              <td style={{ borderBottom: "1px solid #ddd", padding: "4px 6px" }}>{p.rows}단</td>
              <td style={{ borderBottom: "1px solid #ddd", padding: "4px 6px" }}>
                {p.widest}코 ({cm1(p.widest / dr.gs)}cm)
              </td>
              <td style={{ borderBottom: "1px solid #ddd", padding: "4px 6px" }}>
                {cm1(p.widest / dr.gs)} × {cm1(p.rows / dr.gr)} cm
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <pre style={{ fontFamily: "inherit", fontSize: 11, lineHeight: 1.6, whiteSpace: "pre-wrap", margin: 0 }}>{written}</pre>
    </div>
  );
}

// ---------- canvas: the sheet with pan / zoom ----------

function SheetCanvas({ svg, width, height, view, setView, onSize }: { svg: string; width: number; height: number; view: View; setView: (fn: (v: View) => View) => void; onSize: (s: { w: number; h: number }) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; y: number; vx: number; vy: number } | null>(null);
  useEffect(() => {
    const elm = ref.current;
    if (!elm) return;
    const ro = new ResizeObserver(() => onSize({ w: elm.clientWidth, h: elm.clientHeight }));
    ro.observe(elm);
    const wheel = (e: WheelEvent) => {
      e.preventDefault();
      const r = elm.getBoundingClientRect();
      if (e.ctrlKey || e.metaKey) {
        const k = Math.exp(-e.deltaY * 0.01);
        const mx = e.clientX - r.left;
        const my = e.clientY - r.top;
        setView((v) => {
          const nz = clamp(v.zoom * k, ZMIN, ZMAX);
          return { zoom: nz, x: mx - ((mx - v.x) * nz) / v.zoom, y: my - ((my - v.y) * nz) / v.zoom };
        });
      } else setView((v) => ({ ...v, x: v.x - e.deltaX, y: v.y - e.deltaY }));
    };
    elm.addEventListener("wheel", wheel, { passive: false });
    return () => {
      ro.disconnect();
      elm.removeEventListener("wheel", wheel);
    };
  }, [onSize, setView]);
  return (
    <div
      ref={ref}
      className="relative h-full w-full cursor-grab touch-none overflow-hidden select-none active:cursor-grabbing"
      onPointerDown={(e) => {
        if (e.button !== 0 && e.button !== 1) return;
        (e.currentTarget as Element).setPointerCapture(e.pointerId);
        drag.current = { x: e.clientX, y: e.clientY, vx: view.x, vy: view.y };
      }}
      onPointerMove={(e) => {
        const g = drag.current;
        if (g) setView((v) => ({ ...v, x: g.vx + e.clientX - g.x, y: g.vy + e.clientY - g.y }));
      }}
      onPointerUp={() => (drag.current = null)}
      onPointerCancel={() => (drag.current = null)}
      data-apparel-canvas=""
    >
      <div
        className="absolute top-0 left-0 origin-top-left overflow-hidden rounded-r2 shadow-s2 [&>svg]:block"
        style={{ width, height, transform: `translate(${view.x}px, ${view.y}px) scale(${view.zoom})` }}
        dangerouslySetInnerHTML={{ __html: svg }}
      />
    </div>
  );
}
