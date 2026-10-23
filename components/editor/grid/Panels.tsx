"use client";

import { useState, type ReactNode } from "react";
import { Menu, cx } from "@/components/app/ui";
import type { GridPage } from "@/lib/types";
import { ScrubField, Seg, Switch, ab, abBase, el } from "./fields";
import { Alert, LChevronDown, LPlus, LX } from "./icons";
import {
  type AnchorH,
  type AnchorV,
  type GridDoc,
  type Numbering,
  type Tension,
  DEFAULT_GAUGE_TOOL,
  MAX_COLORS,
  MAX_DIM,
  filetInk,
  finishedSize,
  numberingOf,
} from "./model";
import { yarnName } from "./Toolbar";

// ---------- shared bits ----------

const PanelSection = ({ title, aside, children }: { title: string; aside?: ReactNode; children?: ReactNode }) => (
  <section className="shrink-0 border-b border-stroke-neutral-muted">
    <div className="flex h-10 items-center justify-between gap-x2 px-x3">
      <span className="t2-bold text-fg-neutral">{title}</span>
      {aside}
    </div>
    {children && <div className="flex flex-col gap-x2 px-x3 pb-x4">{children}</div>}
  </section>
);

const Row = ({ label, children }: { label: string; children: ReactNode }) => (
  <div className="flex min-h-7 items-center justify-between gap-x2">
    <span className="t2-regular shrink-0 text-fg-neutral-muted">{label}</span>
    <div className="flex min-w-0 items-center justify-end gap-x1">{children}</div>
  </div>
);

const Pair = ({ children, gap = "gap-1.5" }: { children: ReactNode; gap?: string }) => <div className={cx("grid min-w-0 grid-cols-2 [&>*]:min-w-0", gap)}>{children}</div>;

// ---------- left: yarns + pages ----------

type LeftProps = {
  doc: GridDoc;
  counts: number[];
  current: number;
  setCurrent: (i: number) => void;
  onAddYarn: (c: string) => void;
  onRecolor: (i: number, c: string) => void;
  onRemoveYarn: (i: number) => void;
  onSelectPage: (id: string) => void;
  onAddPage: () => void;
  onRenamePage: (id: string, name: string) => void;
  onDuplicatePage: (id: string) => void;
  onMovePage: (id: string, dir: -1 | 1) => void;
  onDeletePage: (id: string) => void;
};

const headBtn = "t1-medium flex h-7 items-center gap-x1 rounded-r1 px-x1_5 text-fg-neutral-muted hover:bg-bg-layer-default-pressed hover:text-fg-neutral";

export function YarnPanel(p: LeftProps) {
  const { doc, counts } = p;
  const filet = doc.mode === "filet";
  const unit = filet ? "칸" : "코";
  const [renaming, setRenaming] = useState<string | null>(null);
  const filled = counts.reduce((s, n, i) => (i > 0 ? s + n : s), 0);
  const ink = filetInk(doc.yarns);

  return (
    <>
      <div className="flex h-10 shrink-0 items-center justify-between border-b border-stroke-neutral-muted px-x3">
        <span className="t3-bold text-fg-neutral">실·페이지</span>
      </div>
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
        <PanelSection
          title="실"
          aside={
            !filet &&
            doc.yarns.length < MAX_COLORS && (
              <label className={cx(headBtn, "relative cursor-pointer")}>
                <LPlus className="size-3.5" />
                새 실 색 추가
                <input type="color" aria-label="새 실 색 추가" defaultValue="#c47a5c" className="absolute inset-0 cursor-pointer opacity-0" onChange={(e) => p.onAddYarn(e.target.value)} />
              </label>
            )
          }
        >
          <ul className="flex flex-col gap-0.5">
            {filet ? (
              <>
                <YarnRow color={ink} label="채운칸" count={`${filled}칸`} active={p.current >= 1} onClick={() => p.setCurrent(1)} onRecolor={(c) => p.onRecolor(1, c)} />
                <YarnRow color="#ffffff" label="빈칸" count={`${counts[0] ?? 0}칸`} active={p.current === 0} onClick={() => p.setCurrent(0)} />
              </>
            ) : (
              doc.yarns.map((c, i) => (
                <YarnRow
                  key={i}
                  color={c}
                  label={yarnName(i)}
                  count={`${counts[i] ?? 0}${unit}`}
                  active={p.current === i}
                  onClick={() => p.setCurrent(i)}
                  onRecolor={(v) => p.onRecolor(i, v)}
                  onRemove={i > 0 && doc.yarns.length > 2 ? () => p.onRemoveYarn(i) : undefined}
                  shortcut={i < 9 ? String(i + 1) : undefined}
                />
              ))
            )}
          </ul>
          {!filet && <p className="t1-regular text-fg-neutral-muted">오른쪽 클릭으로 칠하면 배경 실로 지워져요.</p>}
        </PanelSection>

        <PanelSection
          title="페이지"
          aside={
            <button type="button" className={headBtn} onClick={p.onAddPage}>
              <LPlus className="size-3.5" />
              페이지 추가
            </button>
          }
        >
          <ul className="flex flex-col gap-0.5">
            {doc.pages.map((pg, i) => {
              const active = pg.id === doc.activePageId;
              return (
                <li key={pg.id} className={cx("group flex items-center gap-x1 rounded-r2 pr-x1", active ? "bg-bg-layer-fill" : "hover:bg-bg-layer-fill")}>
                  {renaming === pg.id ? (
                    <input
                      autoFocus
                      aria-label="페이지 이름"
                      defaultValue={pg.name}
                      onFocus={(e) => e.target.select()}
                      onBlur={(e) => {
                        p.onRenamePage(pg.id, e.target.value.trim() || pg.name);
                        setRenaming(null);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                        if (e.key === "Escape") setRenaming(null);
                      }}
                      className="m-x1 h-7 min-w-0 flex-1 rounded-r1 border border-stroke-neutral-contrast bg-bg-layer-default px-x2 text-[1rem] outline-none md:text-size-t3"
                    />
                  ) : (
                    <button
                      type="button"
                      onClick={() => p.onSelectPage(pg.id)}
                      onDoubleClick={() => setRenaming(pg.id)}
                      aria-current={active}
                      className="flex h-9 min-w-0 flex-1 items-center gap-x2 px-x2 text-left"
                    >
                      <span className={cx("t2-regular min-w-0 flex-1 truncate", active ? "font-semibold text-fg-neutral" : "text-fg-neutral-muted")}>{pg.name}</span>
                      <span className="t1-regular shrink-0 tabular-nums text-fg-neutral-subtle">
                        {pg.cols}×{pg.rows}
                      </span>
                    </button>
                  )}
                  <Menu
                    align="end"
                    trigger={({ toggle, open }) => (
                      <button
                        type="button"
                        aria-label={`${pg.name} 메뉴`}
                        title={`${pg.name} 메뉴`}
                        onClick={toggle}
                        className={cx(
                          "t2-bold flex size-7 items-center justify-center rounded-r1 text-fg-neutral-muted hover:bg-bg-layer-default",
                          !open && !active && "opacity-0 group-hover:opacity-100 focus-visible:opacity-100",
                        )}
                      >
                        ···
                      </button>
                    )}
                    items={[
                      { label: "이름 바꾸기", onSelect: () => setRenaming(pg.id) },
                      { label: "복제", onSelect: () => p.onDuplicatePage(pg.id) },
                      { label: "위로", onSelect: () => p.onMovePage(pg.id, -1), disabled: i === 0 },
                      { label: "아래로", onSelect: () => p.onMovePage(pg.id, 1), disabled: i === doc.pages.length - 1 },
                      "separator",
                      { label: "삭제", onSelect: () => p.onDeletePage(pg.id), danger: true, disabled: doc.pages.length <= 1 },
                    ]}
                  />
                </li>
              );
            })}
          </ul>
        </PanelSection>
      </div>
    </>
  );
}

function YarnRow(p: { color: string; label: string; count: string; active: boolean; onClick: () => void; onRecolor?: (c: string) => void; onRemove?: () => void; shortcut?: string }) {
  return (
    <li className={cx("group flex items-center gap-x1 rounded-r2 pr-x1", p.active ? "bg-bg-layer-fill" : "hover:bg-bg-layer-fill")}>
      <button type="button" aria-pressed={p.active} onClick={p.onClick} className="flex h-10 min-w-0 flex-1 items-center gap-x2 px-x2 text-left" title={p.shortcut ? `${p.label} (${p.shortcut})` : p.label}>
        <span className={cx("size-6 shrink-0 rounded-r1 border border-black/15", p.active && "ring-2 ring-stroke-neutral-contrast ring-offset-1")} style={{ background: p.color }} />
        <span className="min-w-0 flex-1">
          <span className={cx("t2-regular block truncate", p.active && "font-semibold")}>{p.label}</span>
          <span className="t1-regular block text-fg-neutral-subtle uppercase">{p.color}</span>
        </span>
        <span className="t1-regular shrink-0 tabular-nums text-fg-neutral-muted">{p.count}</span>
      </button>
      {p.onRecolor && (
        <label className="relative flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-r1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 hover:bg-bg-layer-default" title={`${p.label} 색 바꾸기`}>
          <span className="size-3 rounded-full border border-black/20" style={{ background: p.color }} />
          <input type="color" aria-label={`${p.label} 색 바꾸기`} value={p.color} onChange={(e) => p.onRecolor!(e.target.value)} className="absolute inset-0 cursor-pointer opacity-0" />
        </label>
      )}
      {p.onRemove && (
        <button type="button" aria-label={`${p.label} 지우기`} title={`${p.label} 지우기`} onClick={p.onRemove} className="flex size-7 shrink-0 items-center justify-center rounded-r1 text-fg-neutral-muted opacity-0 group-hover:opacity-100 focus-visible:opacity-100 hover:bg-bg-layer-default">
          <LX className="size-3.5" />
        </button>
      )}
    </li>
  );
}

// ---------- right: numbering, gauge, size, safe zone, checks ----------

type RightProps = {
  doc: GridDoc;
  page: GridPage;
  zoomPct: number;
  onZoom: (pct: number | "fit") => void;
  setNumbering: (n: Numbering, key?: string) => void;
  setGauge: (g: { sts: number; rows: number }) => void;
  setGaugeTool: (t: { yarn: number; needle: number; tension: Tension }) => void;
  onResize: (cols: number, rows: number, h: AnchorH, v: AnchorV) => void;
  onResizeEnd: () => void;
  onScale: (cols: number, rows: number) => void;
  setSafeOn: (on: boolean) => void;
  setSafe: (s: { sts: number; rows: number }) => void;
  safeHit: boolean;
  setOpt: (patch: Partial<Pick<GridDoc, "floatLimit" | "showFloats">>) => void;
  showChecks: boolean;
  floatsCount: number;
  isolatedCount: number;
  onCleanup: () => void;
};

const ANCH_H: AnchorH[] = ["left", "center", "right"];
const ANCH_V: AnchorV[] = ["top", "middle", "bottom"];
const anchorLabel = (v: AnchorV, h: AnchorH) => `${v === "top" ? "위" : v === "middle" ? "가운데" : "아래"} ${h === "left" ? "왼쪽" : h === "center" ? "가운데" : "오른쪽"}`;

const EdgeIcon = ({ side }: { side: "left" | "top" | "right" | "bottom" }) => {
  const l = { left: [5, 5, 5, 19], top: [5, 5, 19, 5], right: [19, 5, 19, 19], bottom: [5, 19, 19, 19] }[side];
  return (
    <svg viewBox="0 0 24 24" fill="none" className={cx("size-3.5 shrink-0", side !== "top" && "text-fg-neutral")} aria-hidden="true">
      <rect x="5" y="5" width="14" height="14" rx="1.5" stroke="currentColor" strokeWidth="1.5" strokeDasharray="2.5 2" className={side === "top" ? "opacity-70" : "opacity-80"} />
      <line x1={l[0]} y1={l[1]} x2={l[2]} y2={l[3]} stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" className={side === "top" ? "opacity-75" : "opacity-100"} />
    </svg>
  );
};

const ZOOMS = [25, 50, 75, 100, 150, 200, 300, 400];

export function RightPanel(p: RightProps) {
  const { doc, page } = p;
  const filet = doc.mode === "filet";
  const n = numberingOf(doc);
  const tool = doc.gaugeTool ?? DEFAULT_GAUGE_TOOL;
  const size = finishedSize(page.cols, page.rows, doc.gauge);
  const [want, setWant] = useState<{ key: string; w: number; h: number } | null>(null);
  const wantKey = `${page.id}:${page.cols}x${page.rows}:${doc.gauge.sts}x${doc.gauge.rows}`;
  const w = want && want.key === wantKey ? want : { key: wantKey, w: size.w, h: size.h };
  const wantCols = Math.max(1, Math.min(MAX_DIM, Math.round((w.w * doc.gauge.sts) / 10)));
  const wantRows = Math.max(1, Math.min(MAX_DIM, Math.round((w.h * doc.gauge.rows) / 10)));
  const wantDirty = wantCols !== page.cols || wantRows !== page.rows;
  const [anchor, setAnchor] = useState<{ h: AnchorH; v: AnchorV }>({ h: "center", v: "middle" });
  const safe = doc.safe ?? { sts: 0, rows: 0 };
  const limit = doc.floatLimit ?? 5;
  const cm = Math.round(((limit * 10) / Math.max(1, doc.gauge.sts)) * 10) / 10;
  const unit = filet ? "칸" : "코";
  const setN = (patch: Partial<Numbering>, key?: string) => p.setNumbering({ ...n, ...patch }, key);
  const colorsCount = filet ? 2 : doc.yarns.length;

  const edgeField = (side: "left" | "top" | "right" | "bottom", label: string) => {
    const off = n.alternate && (side === "left" || side === "right");
    return (
      <div className="flex min-w-0 flex-col items-stretch gap-x0_5">
        <ScrubField
          label={label}
          title={`단수 표시 간격 · ${label} · ${off ? "번갈아 표시 중에는 단마다 표시돼요" : "드래그로 조절"}`}
          value={n[side]}
          min={0}
          max={50}
          onChange={(v) => setN({ [side]: v }, `num-${side}`)}
          disabled={off}
          prefix={<EdgeIcon side={side} />}
          align="center"
          height={8}
          tone="soft"
        />
        <span className="t1-regular truncate text-center text-fg-neutral-muted" aria-hidden="true">
          {label}
        </span>
      </div>
    );
  };
  const flipBtn = (k: "flipRows" | "flipSts", label: string, icon: ReactNode) => (
    <div className="flex min-w-0 flex-col items-stretch gap-x0_5">
      <button
        type="button"
        aria-pressed={n[k]}
        aria-label={label}
        title={label}
        onClick={() => setN({ [k]: !n[k] })}
        className={cx(
          "flex h-8 w-full min-w-0 items-center justify-center rounded-r2 border transition-colors disabled:opacity-50 border-stroke-neutral-weak",
          n[k] ? "bg-bg-layer-default-pressed text-fg-neutral" : "bg-bg-layer-default text-fg-neutral-muted hover:text-fg-neutral",
        )}
      >
        {icon}
      </button>
      <span className="t1-regular truncate text-center text-fg-neutral-muted" aria-hidden="true">
        {label}
      </span>
    </div>
  );

  return (
    <>
      <div className="flex h-10 shrink-0 items-center justify-between gap-x2 border-b border-stroke-neutral-muted px-x3">
        <span className="t2-medium tabular-nums text-fg-neutral-muted" data-grid-size="true">
          {page.cols} × {page.rows}칸 · {colorsCount}색
        </span>
        <Menu
          align="end"
          items={[...ZOOMS.map((z) => ({ label: `${z}%`, onSelect: () => p.onZoom(z) })), "separator" as const, { label: "전체 맞춤", shortcut: "⇧1", onSelect: () => p.onZoom("fit") }]}
          trigger={({ toggle, open }) => (
            <button
              type="button"
              aria-haspopup="menu"
              aria-expanded={open}
              aria-label="확대 비율"
              onClick={toggle}
              className="t2-medium flex h-7 shrink-0 items-center gap-x0_5 rounded-r1 px-x1_5 tabular-nums text-fg-neutral-muted hover:bg-bg-layer-default-pressed hover:text-fg-neutral focus-visible:outline-2 focus-visible:outline-stroke-focus-ring"
            >
              {p.zoomPct}%
              <LChevronDown className="size-3" />
            </button>
          )}
        />
      </div>
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
        <PanelSection title="단수 표시">
          <div className="grid min-w-0 grid-cols-2 gap-x-x2 gap-y-x1_5 [&>*]:min-w-0">
            {edgeField("left", "왼쪽")}
            {edgeField("top", "위")}
            {edgeField("right", "오른쪽")}
            {edgeField("bottom", "아래")}
            {flipBtn(
              "flipRows",
              "단 순서 뒤집기",
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="size-4" aria-hidden="true">
                <rect x="8.5" y="4.5" width="10" height="15" rx="1.5" />
                <circle cy="15.5" cx="8.5" r="1.7" fill="currentColor" />
                <circle cy="10.5" cx="8.5" r="1.15" fill="none" />
                <circle cy="5.5" cx="8.5" r="1.15" fill="none" />
                <path d="M4 15.5 V6.5 M2.2 8.5 L4 6.5 L5.8 8.5" />
              </svg>,
            )}
            {flipBtn(
              "flipSts",
              "코 순서 뒤집기",
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="size-4" aria-hidden="true">
                <rect x="4.5" y="5.5" width="15" height="10" rx="1.5" />
                <circle cx="17" cy="5.5" r="1.7" fill="currentColor" />
                <circle cx="12" cy="5.5" r="1.15" fill="none" />
                <circle cx="7" cy="5.5" r="1.15" fill="none" />
                <path d="M16.5 20 H7.5 M9.5 18.2 L7.5 20 L9.5 21.8" />
              </svg>,
            )}
          </div>
          <label className="flex h-8 items-center justify-between gap-x2">
            <span className="t2-regular text-fg-neutral">번갈아 표시</span>
            <Switch size={16} checked={n.alternate} onChange={(v) => setN({ alternate: v })} />
          </label>
          <ScrubField
            label="도안과 거리"
            title="번호와 도안 사이 여백 · 드래그로 조절 · Shift 정밀"
            value={n.offset}
            min={0}
            max={40}
            onChange={(v) => setN({ offset: v }, "num-offset")}
            height={8}
            tone="soft"
            prefix={
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="size-3.5 shrink-0" aria-hidden="true">
                <rect x="8" y="7" width="8" height="10" rx="1.2" strokeDasharray="2.2 1.8" className="opacity-80" />
                <path d="M6 12H3.5M3.5 12l1.4-1.4M3.5 12l1.4 1.4" />
                <path d="M18 12h2.5M20.5 12l-1.4-1.4M20.5 12l-1.4 1.4" />
              </svg>
            }
          />
        </PanelSection>

        <PanelSection title="게이지 (10cm)">
          <Pair>
            <ScrubField label={`10cm ${unit}`} title={filet ? "10cm 안의 칸·단 수" : "10cm 안의 코·단 수"} prefix={unit} value={doc.gauge.sts} min={1} max={80} onChange={(v) => p.setGauge({ ...doc.gauge, sts: v })} />
            <ScrubField label="10cm 단" prefix="단" value={doc.gauge.rows} min={1} max={120} onChange={(v) => p.setGauge({ ...doc.gauge, rows: v })} />
          </Pair>
          <div className="flex min-w-0 flex-col gap-1.5" data-gauge-estimator="">
            <Pair>
              <ScrubField label="실 굵기" prefix="실" suffix="mm" value={tool.yarn} min={0.5} max={25} step={0.25} decimals={2} onChange={(v) => p.setGaugeTool({ ...tool, yarn: v })} className="w-full" />
              <ScrubField label="바늘 굵기" prefix="바늘" suffix="mm" value={tool.needle} min={1} max={25} step={0.25} decimals={2} onChange={(v) => p.setGaugeTool({ ...tool, needle: v })} className="w-full" />
            </Pair>
            <Seg
              label="손땀"
              value={tool.tension}
              onChange={(v) => p.setGaugeTool({ ...tool, tension: v })}
              options={[
                { value: "loose", label: "느슨" },
                { value: "normal", label: "보통" },
                { value: "tight", label: "촘촘" },
              ]}
            />
          </div>
          <Row label="만들고 싶은 크기">
            <span className="t2-medium tabular-nums text-fg-neutral" data-grid-want-cells={`${wantCols}x${wantRows}`}>
              {wantCols}
              {unit} × {wantRows}단
            </span>
          </Row>
          <Pair>
            <ScrubField label="만들고 싶은 크기 · 가로" prefix="가로" suffix="cm" value={w.w} min={0.5} max={500} step={0.5} decimals={1} onChange={(v) => setWant({ ...w, w: v })} />
            <ScrubField label="만들고 싶은 크기 · 세로" prefix="세로" suffix="cm" value={w.h} min={0.5} max={500} step={0.5} decimals={1} onChange={(v) => setWant({ ...w, h: v })} />
          </Pair>
          <Pair>
            <button
              type="button"
              className={cx(ab("neutralOutline", "xsmall"), abBase, "h-7 text-[11px] font-medium")}
              data-disabled={!wantDirty ? "" : undefined}
              disabled={!wantDirty}
              onClick={() => {
                p.onResize(wantCols, wantRows, anchor.h, anchor.v);
                p.onResizeEnd();
              }}
              style={el(128.5, 28)}
            >
              칸만 바꾸기
            </button>
            <button
              type="button"
              className={cx(ab("neutralOutline", "xsmall"), abBase, "h-7 text-[11px] font-medium")}
              data-disabled={!wantDirty ? "" : undefined}
              disabled={!wantDirty}
              onClick={() => p.onScale(wantCols, wantRows)}
              style={el(128.5, 28)}
            >
              무늬도 맞추기
            </button>
          </Pair>
        </PanelSection>

        <PanelSection title="격자 크기">
          <Pair>
            <ScrubField label="가로" prefix="가로" suffix={unit} value={page.cols} min={1} max={MAX_DIM} onChange={(v) => p.onResize(v, page.rows, anchor.h, anchor.v)} onCommit={p.onResizeEnd} />
            <ScrubField label="세로" prefix="세로" suffix="단" value={page.rows} min={1} max={MAX_DIM} onChange={(v) => p.onResize(page.cols, v, anchor.h, anchor.v)} onCommit={p.onResizeEnd} />
          </Pair>
          <Row label="기준 위치">
            <div role="radiogroup" aria-label="기준 위치" className="grid grid-cols-3 gap-px rounded-r2 bg-bg-layer-fill p-0.5">
              {ANCH_V.map((v) =>
                ANCH_H.map((h) => {
                  const on = anchor.h === h && anchor.v === v;
                  return (
                    <button
                      key={v + h}
                      type="button"
                      role="radio"
                      aria-checked={on}
                      aria-label={anchorLabel(v, h)}
                      title={anchorLabel(v, h)}
                      onClick={() => setAnchor({ h, v })}
                      className={cx("flex size-[18px] items-center justify-center rounded-r1", on ? "bg-bg-layer-default shadow-s1" : "hover:bg-bg-layer-default-pressed")}
                    >
                      <span className={cx("rounded-full", on ? "size-2 bg-bg-brand-solid" : "size-1 bg-fg-neutral-subtle")} />
                    </button>
                  );
                }),
              )}
            </div>
          </Row>
        </PanelSection>

        <PanelSection
          title="안전구역"
          aside={
            <div className="flex shrink-0 items-center">
              <Switch label="안전구역" checked={!!doc.safeOn} onChange={p.setSafeOn} />
            </div>
          }
        >
          {doc.safeOn && (
            <>
              <Pair>
                <ScrubField label="양옆 여유" prefix="양옆" suffix={unit} value={safe.sts} min={0} max={30} onChange={(v) => p.setSafe({ ...safe, sts: v })} />
                <ScrubField label="위아래 여유" prefix="위아래" suffix="단" value={safe.rows} min={0} max={30} onChange={(v) => p.setSafe({ ...safe, rows: v })} />
              </Pair>
              <p className="t1-regular text-fg-neutral-muted">도안 바깥에 무늬 없는 여유 코·단을 더해요. 이음선이나 테두리 자리로 쓰세요.</p>
              {p.safeHit && (
                <p role="status" className="t2-bold flex items-center gap-x1_5 text-fg-critical">
                  <Alert className="size-4" />
                  안전구역 안에 무늬가 있어요
                </p>
              )}
            </>
          )}
        </PanelSection>

        {p.showChecks && (
          <PanelSection title="검사">
            {doc.mode === "knit" ? (
              <>
                <label className="flex h-8 items-center justify-between gap-x2">
                  <span className="t2-regular text-fg-neutral">도안에 긴 건너뛰기 표시</span>
                  <Switch size={16} checked={!!doc.showFloats} onChange={(v) => p.setOpt({ showFloats: v })} />
                </label>
                <Row label="건너뛰기 실 경고">
                  <ScrubField label="건너뛰기 실 경고" value={limit} min={1} max={40} suffix="코 초과" onChange={(v) => p.setOpt({ floatLimit: v })} className="w-24" />
                </Row>
                <p className={cx("t2-regular rounded-r2 px-x3 py-x2", p.floatsCount ? "bg-bg-critical-weak text-fg-critical" : "bg-bg-layer-fill text-fg-neutral-muted")}>
                  {p.floatsCount ? `${cm}cm보다 긴 걸침실 ${p.floatsCount}곳` : "문제 없어요"}
                </p>
              </>
            ) : (
              <p className="t1-regular text-fg-neutral-muted">건너뛰기 실 검사는 대바늘 배색에서 볼 수 있어요.</p>
            )}
            <Row label={`혼자 떨어진 칸 ${p.isolatedCount}곳`}>
              <button
                type="button"
                className={cx(ab("neutralOutline", "xsmall"), abBase, "h-7 text-[11px] font-medium")}
                data-disabled={!p.isolatedCount ? "" : undefined}
                disabled={!p.isolatedCount}
                onClick={p.onCleanup}
              >
                한 칸짜리 점 없애기
              </button>
            </Row>
          </PanelSection>
        )}
      </div>
    </>
  );
}
