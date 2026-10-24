"use client";

import { memo, useEffect, useMemo, useRef, useState } from "react";
import { cx } from "@/components/app/ui";
import { KNIT_GROUPS, KNIT_SYMBOLS, KnitSymbolIcon } from "@/lib/symbols/knitting";
import { AB_TAIL, ab, seedSize } from "./ab";
import { ChevronDown, CloudAlert, CloudCheck, Copy, PanelLeft, Pencil, Search, Trash2, X } from "./icons";
import type { MyGlyph } from "./GlyphEditor";
import { KNIT_LIBRARY, LIB_CATS } from "./library";
import { gridBody } from "./render";
import type { Block, Geo, KGrid } from "./model";

export type MyPattern = { id: string; name: string; block: Block; createdAt: number };
export type Stamp = { kind: "lib" | "mine"; id: string; name: string; block: Block };
export type LeftTab = "symbols" | "library" | "mine";
export type SaveState = "saved" | "saving" | "error";

export const PALETTE_W = 296;

// Korean initial-consonant search
const CHO = "ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ";
const initials = (s: string) =>
  [...s]
    .map((ch) => {
      const c = ch.charCodeAt(0) - 0xac00;
      return c >= 0 && c < 11172 ? CHO[Math.floor(c / 588)] : ch;
    })
    .join("");
export const matches = (text: string, q: string) => {
  const t = text.toLowerCase();
  const query = q.toLowerCase().replace(/\s+/g, "");
  if (!query) return true;
  const flat = t.replace(/\s+/g, "");
  return flat.includes(query) || initials(flat).includes(query);
};

/** Small chart preview of a block (repeated so short patterns read clearly). Uses the canvas's symbol defs. */
export const BlockPreview = memo(function BlockPreview({ block, geo, max = 72 }: { block: Block; geo: Geo; max?: number }) {
  const rx = block.cols < 4 ? Math.ceil(4 / block.cols) : 1;
  const ry = block.rows < 4 ? Math.ceil(4 / block.rows) : 1;
  const cols = block.cols * rx;
  const rows = block.rows * ry;
  const cells = [];
  for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) cells.push(block.cells[(y % block.rows) * block.cols + (x % block.cols)]);
  const g: KGrid = { id: "p", name: "", x: 0, y: 0, cols, rows, cells, visible: true };
  const W = cols * geo.cw;
  const H = rows * geo.ch;
  const s = Math.min(max / W, max / H);
  return (
    <svg width={W * s} height={H * s} viewBox={`-1 -1 ${W + 2} ${H + 2}`} aria-hidden="true" className="shrink-0">
      <g dangerouslySetInnerHTML={{ __html: gridBody(g, geo) }} />
    </svg>
  );
});

type Props = {
  width: number;
  onWidth: (w: number) => void;
  open: boolean;
  onCollapse: () => void;
  title: string;
  onRename?: (t: string) => void;
  save?: SaveState;
  onRetrySave?: () => void;
  tab: LeftTab;
  geo: Geo;
  /** highlighted palette symbol */
  picked: string | null;
  onPick: (id: string) => void;
  onCreateGlyph: () => void;
  /** user-drawn symbols (내 기호) */
  myGlyphs: MyGlyph[];
  onEditGlyph: (id: string) => void;
  onDuplicateGlyph: (id: string) => void;
  onDeleteGlyph: (id: string) => void;
  stamp: Stamp | null;
  onStamp: (s: Stamp | null) => void;
  active: KGrid | null;
  onFillGrid: () => void;
  onNewGridFromStamp: () => void;
  mine: MyPattern[];
  onSaveMine: () => void;
  onDeleteMine: (id: string) => void;
};

const TAB_TITLE: Record<LeftTab, string> = { symbols: "기호", library: "무늬 라이브러리", mine: "내 무늬" };

export function Palette(p: Props) {
  const [q, setQ] = useState("");
  const [searching, setSearching] = useState(false);
  const [closed, setClosed] = useState<Set<string>>(() => new Set());
  const [editingTitle, setEditingTitle] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (searching) searchRef.current?.focus();
  }, [searching]);

  const groups = useMemo(
    () =>
      KNIT_GROUPS.map((g) => ({
        ...g,
        items: KNIT_SYMBOLS.filter((s) => s.group === g.id && matches(`${s.name} ${s.keywords ?? ""} ${g.label}`, q)),
      })).filter((g) => g.items.length),
    [q],
  );
  const lib = useMemo(
    () => LIB_CATS.map((c) => ({ ...c, items: KNIT_LIBRARY.filter((l) => l.cat === c.id && matches(`${l.name} ${c.label}`, q)) })).filter((c) => c.items.length),
    [q],
  );
  const mine = useMemo(() => p.mine.filter((m) => matches(m.name, q)), [p.mine, q]);
  const myGlyphs = useMemo(() => p.myGlyphs.filter((g) => matches(`${g.name} 내 기호`, q)), [p.myGlyphs, q]);

  // resize handle
  const drag = useRef<{ x: number; w: number } | null>(null);

  const toggle = (id: string) =>
    setClosed((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  const groupHeader = (id: string, label: string) => (
    <button
      type="button"
      className="t2-bold mb-x2 flex w-full items-center justify-between gap-x1 border-b border-stroke-neutral-muted px-x1 pb-x1 text-left text-fg-neutral"
      aria-expanded={!closed.has(id)}
      onClick={() => toggle(id)}
    >
      <span className="min-w-0 truncate">{label}</span>
      <ChevronDown className={cx("size-3.5 shrink-0 transition-transform", closed.has(id) && "-rotate-90")} />
    </button>
  );

  if (!p.open) return null;
  const w = p.width;
  return (
    <div className="relative z-[90] h-full shrink-0 overflow-visible transition-shadow" data-tour="palette" style={{ width: w }}>
      <div className="relative h-full shrink-0" style={{ width: w }}>
        <aside
          aria-label="기호 팔레트"
          data-stitch-palette=""
          className="flex h-full min-h-0 flex-col overflow-hidden border-r border-stroke-neutral-muted bg-bg-layer-default"
          style={{ width: w, ["--tile-min" as string]: "72px" }}
        >
          <div className="flex h-11 shrink-0 items-center gap-x1 border-b border-stroke-neutral-muted px-x2">
            {editingTitle && p.onRename ? (
              <input
                autoFocus
                defaultValue={p.title}
                aria-label="도안 제목"
                className="t4-medium h-8 min-w-0 flex-1 rounded-r2 bg-bg-layer-fill px-x2 text-fg-neutral outline-none"
                onBlur={(e) => {
                  p.onRename?.(e.target.value.trim().slice(0, 60) || p.title);
                  setEditingTitle(false);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                  if (e.key === "Escape") setEditingTitle(false);
                }}
              />
            ) : (
              <button
                type="button"
                className="t4-medium h-8 min-w-0 flex-1 truncate rounded-r2 px-x2 text-left text-fg-neutral hover:bg-bg-layer-default-pressed"
                title={p.title}
                onClick={() => p.onRename && setEditingTitle(true)}
              >
                {p.title}
                <span className="sr-only">, 도안 제목</span>
              </button>
            )}
            {p.save && (
              <span className="inline-flex">
                <button
                  type="button"
                  aria-label={p.save === "error" ? "저장 실패 · 다시 시도" : p.save === "saving" ? "저장 중" : "저장됨"}
                  disabled={p.save !== "error"}
                  data-save-status={p.save}
                  onClick={p.onRetrySave}
                  className={cx(
                    "flex h-7 w-7 shrink-0 items-center justify-center gap-1 rounded-r2 disabled:cursor-default",
                    p.save === "error" ? "text-fg-critical hover:bg-bg-layer-default-pressed" : "text-fg-neutral-subtle",
                    p.save === "saving" && "opacity-60",
                  )}
                >
                  {p.save === "error" ? <CloudAlert className="size-3.5" /> : <CloudCheck className="size-3.5" />}
                </button>
              </span>
            )}
            <button className={cx(ab("ghost"), AB_TAIL, "w-x8 px-0")} aria-label="접기" style={seedSize(32, 32)} onClick={p.onCollapse}>
              <PanelLeft className="size-4" />
            </button>
          </div>

          <div className="flex h-10 shrink-0 items-center border-b border-stroke-neutral-muted px-x2">
            <span className="t3-bold min-w-0 flex-1 px-x1 text-fg-neutral">{TAB_TITLE[p.tab]}</span>
            {p.tab === "symbols" && (
              <button
                className={cx(ab("ghost"), "touch-manipulation select-none [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 size-7 shrink-0 px-0")}
                type="button"
                data-tour="create-glyph"
                aria-label="내 기호 만들기"
                style={seedSize(28, 28)}
                onClick={p.onCreateGlyph}
              >
                <Pencil className="size-4" />
              </button>
            )}
            <button
              className={cx(ab("ghost"), "touch-manipulation select-none [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 size-7 shrink-0 px-0")}
              type="button"
              aria-label={p.tab === "symbols" ? "기호 검색" : "무늬 검색"}
              aria-pressed={searching}
              style={seedSize(28, 28)}
              onClick={() => {
                setSearching((v) => !v);
                setQ("");
              }}
            >
              <Search className="size-4" />
            </button>
          </div>

          {searching && (
            <div className="flex h-10 shrink-0 items-center gap-x1 border-b border-stroke-neutral-muted px-x2">
              <input
                ref={searchRef}
                value={q}
                onChange={(e) => setQ(e.target.value)}
                onKeyDown={(e) => e.key === "Escape" && (setSearching(false), setQ(""))}
                placeholder={p.tab === "symbols" ? "기호 이름으로 찾기" : "무늬 이름으로 찾기"}
                aria-label={p.tab === "symbols" ? "기호 검색어" : "무늬 검색어"}
                className="h-7 min-w-0 flex-1 rounded-r2 bg-bg-layer-fill px-x2 text-[12px] text-fg-neutral outline-none placeholder:text-fg-neutral-subtle"
              />
              {q && (
                <button type="button" aria-label="검색어 지우기" className="flex size-7 items-center justify-center rounded-r2 text-fg-neutral-muted hover:bg-bg-layer-default-pressed" onClick={() => setQ("")}>
                  <X className="size-3.5" />
                </button>
              )}
            </div>
          )}

          <div className="relative min-h-0 flex-1">
            <div className="no-scrollbar size-full overflow-x-hidden overflow-y-scroll rounded-[inherit] outline-none">
              <div style={{ minWidth: "100%", display: "table" }}>
                <div className="space-y-4 p-2 pt-3 pb-4">
                  {p.tab === "symbols" && (
                    <div className="space-y-6">
                      {groups.length === 0 && !myGlyphs.length && <p className="py-x8 text-center text-[12px] text-fg-neutral-subtle">찾는 기호가 없어요.</p>}
                      {myGlyphs.length > 0 && (
                        <div data-my-glyphs="">
                          {groupHeader("custom", "내 기호")}
                          {!closed.has("custom") && (
                            <div className="panel-tile-grid gap-1">
                              {myGlyphs.map((s) => {
                                const on = p.picked === s.id;
                                return (
                                  <div key={s.id} className="group/glyph relative">
                                    <button
                                      className={cx(ab(on ? "brandSolid" : "ghost"), AB_TAIL, "h-auto w-full flex-col gap-0.5 rounded-r2 px-1 py-1.5 whitespace-normal")}
                                      type="button"
                                      aria-label={s.name}
                                      aria-pressed={on}
                                      title={s.width > 1 ? `${s.name} · ${s.width}코` : s.name}
                                      onClick={() => p.onPick(s.id)}
                                    >
                                      <KnitSymbolIcon id={s.id} className={cx("shrink-0 overflow-visible", on ? "text-fg-neutral-inverted" : "text-fg-neutral")} />
                                      {/* layout-audit-ignore: tiny-text — matches the reference palette, which sets these captions at 10px */}
                                      <span className="line-clamp-2 max-w-full text-center text-[10px] leading-[13px] break-keep whitespace-normal">{s.name}</span>
                                    </button>
                                    <span className="absolute top-0.5 right-0.5 hidden gap-px rounded-r1 bg-bg-layer-floating/95 shadow-s1 group-focus-within/glyph:flex group-hover/glyph:flex">
                                      <button type="button" aria-label="내 기호 편집" title="내 기호 편집" onClick={() => p.onEditGlyph(s.id)} className="flex size-6 items-center justify-center rounded-r1 text-fg-neutral-muted hover:text-fg-neutral">
                                        <Pencil className="size-3" />
                                      </button>
                                      <button type="button" aria-label="복제하기" title="복제하기" onClick={() => p.onDuplicateGlyph(s.id)} className="flex size-6 items-center justify-center rounded-r1 text-fg-neutral-muted hover:text-fg-neutral">
                                        <Copy className="size-3" />
                                      </button>
                                      <button type="button" aria-label="내 기호 삭제" title="내 기호 삭제" onClick={() => p.onDeleteGlyph(s.id)} className="flex size-6 items-center justify-center rounded-r1 text-fg-neutral-muted hover:text-fg-critical">
                                        <Trash2 className="size-3" />
                                      </button>
                                    </span>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      )}
                      {groups.map((g) => (
                        <div key={g.id}>
                          {groupHeader(g.id, g.label)}
                          {!closed.has(g.id) && (
                            <div className="panel-tile-grid gap-1">
                              {g.items.map((s) => {
                                const on = p.picked === s.id;
                                return (
                                  <div key={s.id} className="relative">
                                    <button
                                      className={cx(
                                        ab(on ? "brandSolid" : "ghost"),
                                        AB_TAIL,
                                        "h-auto w-full flex-col gap-0.5 rounded-r2 px-1 py-1.5 whitespace-normal",
                                      )}
                                      type="button"
                                      aria-label={s.name}
                                      aria-pressed={on}
                                      title={s.width > 1 ? `${s.name} · ${s.width}코` : s.name}
                                      data-tour="palette-symbol"
                                      draggable={false}
                                      onClick={() => p.onPick(s.id)}
                                    >
                                      <KnitSymbolIcon id={s.id} className={cx("shrink-0 overflow-visible", on ? "text-fg-neutral-inverted" : "text-fg-neutral")} />
                                      {/* layout-audit-ignore: tiny-text — matches the reference palette, which sets these captions at 10px */}
                                      <span className="line-clamp-2 max-w-full text-center text-[10px] leading-[13px] break-keep whitespace-normal pointer-coarse:line-clamp-none">
                                        {s.name}
                                      </span>
                                    </button>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {p.tab === "library" && (
                    <div className="space-y-6">
                      <p className="px-x1 text-[11px] leading-[1.5] text-fg-neutral-muted">무늬를 고르고 격자를 누르면 한 번 찍히고, 끌면 이어서 찍혀요.</p>
                      {lib.length === 0 && <p className="py-x8 text-center text-[12px] text-fg-neutral-subtle">찾는 무늬가 없어요.</p>}
                      {lib.map((c) => (
                        <div key={c.id}>
                          {groupHeader(`lib-${c.id}`, c.label)}
                          {!closed.has(`lib-${c.id}`) && (
                            <ul className="flex flex-col gap-0.5">
                              {c.items.map((l) => {
                                const on = p.stamp?.kind === "lib" && p.stamp.id === l.id;
                                return (
                                  <li key={l.id}>
                                    <button
                                      type="button"
                                      aria-pressed={on}
                                      onClick={() => p.onStamp(on ? null : { kind: "lib", id: l.id, name: l.name, block: l.block })}
                                      className={cx(
                                        "flex w-full items-center gap-x2 rounded-r2 p-x1 text-left transition-colors",
                                        on ? "bg-bg-brand-weak" : "hover:bg-bg-layer-default-pressed",
                                      )}
                                    >
                                      <span className="flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-r1_5 border border-stroke-neutral-muted bg-white">
                                        <BlockPreview block={l.block} geo={p.geo} max={40} />
                                      </span>
                                      <span className="min-w-0 flex-1">
                                        <span className="block truncate text-[12px] font-medium text-fg-neutral">{l.name}</span>
                                        {/* layout-audit-ignore: tiny-text — matches the reference palette, which sets these captions at 10px */}
                                        <span className="text-[10px] text-fg-neutral-muted tabular-nums">
                                          {l.block.cols}코 × {l.block.rows}단 반복
                                        </span>
                                      </span>
                                    </button>
                                  </li>
                                );
                              })}
                            </ul>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {p.tab === "mine" && (
                    <div className="space-y-3">
                      <button className={cx(ab("neutralOutline"), AB_TAIL, "h-8 w-full text-[12px] font-medium")} type="button" onClick={p.onSaveMine}>
                        선택한 칸을 내 무늬로 등록 (M)
                      </button>
                      {mine.length === 0 ? (
                        <p className="px-x1 text-[11px] leading-[1.6] text-fg-neutral-muted">격자나 칸을 고른 뒤 등록하면 여기에 모여요. 다른 도안에서도 같이 쓸 수 있어요.</p>
                      ) : (
                        <ul className="flex flex-col gap-0.5">
                          {mine.map((m) => {
                            const on = p.stamp?.kind === "mine" && p.stamp.id === m.id;
                            return (
                              <li key={m.id} className="group/mine relative">
                                <button
                                  type="button"
                                  aria-pressed={on}
                                  onClick={() => p.onStamp(on ? null : { kind: "mine", id: m.id, name: m.name, block: m.block })}
                                  className={cx(
                                    "flex w-full items-center gap-x2 rounded-r2 p-x1 pr-x8 text-left transition-colors",
                                    on ? "bg-bg-brand-weak" : "hover:bg-bg-layer-default-pressed",
                                  )}
                                >
                                  <span className="flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-r1_5 border border-stroke-neutral-muted bg-white">
                                    <BlockPreview block={m.block} geo={p.geo} max={40} />
                                  </span>
                                  <span className="min-w-0 flex-1">
                                    <span className="block truncate text-[12px] font-medium text-fg-neutral">{m.name}</span>
                                    {/* layout-audit-ignore: tiny-text — matches the reference palette, which sets these captions at 10px */}
                                    <span className="text-[10px] text-fg-neutral-muted tabular-nums">
                                      {m.block.cols}코 × {m.block.rows}단
                                    </span>
                                  </span>
                                </button>
                                <button
                                  type="button"
                                  aria-label="무늬 삭제"
                                  className="absolute top-1/2 right-x1 flex size-7 -translate-y-1/2 items-center justify-center rounded-r2 text-fg-neutral-muted opacity-0 group-hover/mine:opacity-100 hover:bg-bg-layer-default-pressed hover:text-fg-critical focus:opacity-100"
                                  onClick={() => p.onDeleteMine(m.id)}
                                >
                                  <Trash2 className="size-3.5" />
                                </button>
                              </li>
                            );
                          })}
                        </ul>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {p.tab !== "symbols" && p.stamp && (
            <div className="flex shrink-0 flex-col gap-x1_5 border-t border-stroke-neutral-muted p-x2">
              <p className="truncate px-x1 text-[12px] font-semibold text-fg-neutral">{p.stamp.name}</p>
              <button className={cx(ab("brandSolid"), AB_TAIL, "h-8 w-full text-[12px] font-medium")} type="button" disabled={!p.active} onClick={p.onFillGrid}>
                {p.active ? `격자 전체 채우기 (${p.active.cols}코 × ${p.active.rows}단)` : "격자를 고르면 전체를 채울 수 있어요"}
              </button>
              <button className={cx(ab("neutralOutline"), AB_TAIL, "h-8 w-full text-[12px] font-medium")} type="button" onClick={p.onNewGridFromStamp}>
                새 격자로 만들기
              </button>
            </div>
          )}
        </aside>
      </div>
      <div
        role="separator"
        aria-orientation="vertical"
        aria-label="패널 너비 조절 (끌어서 바꾸고, 두 번 누르면 원래대로)"
        title="패널 너비 조절 (끌어서 바꾸고, 두 번 누르면 원래대로)"
        tabIndex={0}
        className="group/resize absolute inset-y-0 -right-[3px] z-[95] w-1.5 cursor-col-resize touch-none outline-none"
        onPointerDown={(e) => {
          (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
          drag.current = { x: e.clientX, w };
        }}
        onPointerMove={(e) => {
          if (!drag.current) return;
          p.onWidth(Math.max(232, Math.min(520, drag.current.w + e.clientX - drag.current.x)));
        }}
        onPointerUp={() => (drag.current = null)}
        onDoubleClick={() => p.onWidth(PALETTE_W)}
        onKeyDown={(e) => {
          if (e.key === "ArrowLeft") p.onWidth(Math.max(232, w - 16));
          if (e.key === "ArrowRight") p.onWidth(Math.min(520, w + 16));
        }}
      >
        <span className="pointer-events-none absolute inset-y-0 left-1/2 w-0.5 -translate-x-1/2 bg-transparent transition-colors group-hover/resize:bg-stroke-brand-solid group-focus-visible/resize:bg-stroke-brand-solid" />
      </div>
    </div>
  );
}
