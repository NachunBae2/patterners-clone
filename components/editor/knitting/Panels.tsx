"use client";

import { memo, useMemo, useState, type ReactNode } from "react";
import { Eye, EyeOff, FlipH, FlipV, More, Plus, RotateCw, Search, Trash, X } from "@/components/app/icons";
import { Button, IconButton, Menu, NumberField, Segmented, cx } from "@/components/app/ui";
import { KNIT_GROUPS, KNIT_SYMBOLS, KnitSymbolIcon, knitSymbol } from "@/lib/symbols/knitting";
import { KNIT_LIBRARY, LIB_CATS } from "./library";
import { DEFAULT_NUMBERING, colorCounts, filledCount, rectH, rectW, type Block, type Geo, type KDoc, type KGrid, type Numbering, type Sel } from "./model";
import { gridBody } from "./render";

export type MyPattern = { id: string; name: string; block: Block; createdAt: number };
export type Stamp = { kind: "lib" | "mine"; id: string; name: string; block: Block };
export type LeftTab = "symbols" | "library" | "mine";

// Korean initial-consonant search
const CHO = "ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ";
const initials = (s: string) =>
  [...s]
    .map((ch) => {
      const c = ch.charCodeAt(0) - 0xac00;
      return c >= 0 && c < 11172 ? CHO[Math.floor(c / 588)] : ch;
    })
    .join("");
const matches = (text: string, q: string) => {
  const t = text.toLowerCase();
  const query = q.toLowerCase().replace(/\s+/g, "");
  if (!query) return true;
  const flat = t.replace(/\s+/g, "");
  return flat.includes(query) || initials(flat).includes(query);
};

function PanelTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex h-8 items-center justify-between">
      <h3 className="text-[0.8125rem] font-semibold text-fg-neutral">{children}</h3>
      {action}
    </div>
  );
}

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

// ---------------- Left panel ----------------

type LeftProps = {
  tab: LeftTab;
  setTab: (t: LeftTab) => void;
  geo: Geo;
  pick: string | null;
  onPick: (id: string) => void;
  stamp: Stamp | null;
  onStamp: (s: Stamp | null) => void;
  active: KGrid | null;
  onFillGrid: () => void;
  onNewGridFromStamp: () => void;
  mine: MyPattern[];
  onSaveMine: () => void;
  onDeleteMine: (id: string) => void;
  className?: string;
};

export function LeftPanel(p: LeftProps) {
  const [q, setQ] = useState("");
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
  const picked = knitSymbol(p.pick ?? undefined);

  return (
    <aside aria-label="기호 팔레트" className={cx("flex w-[264px] shrink-0 flex-col border-r border-stroke-neutral-muted bg-bg-layer-default", p.className)}>
      <div className="px-x3 pt-x3">
        <div role="tablist" className="flex rounded-r2 bg-bg-neutral-weak p-0.5">
          {(
            [
              ["symbols", "기호"],
              ["library", "무늬 라이브러리"],
              ["mine", "내 무늬"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={p.tab === id}
              onClick={() => p.setTab(id)}
              className={cx(
                "h-8 rounded-r1_5 px-x2 text-[0.8125rem] font-semibold whitespace-nowrap",
                id === "library" ? "flex-[1.6]" : "flex-1",
                p.tab === id ? "bg-bg-layer-default text-fg-neutral shadow-s1" : "text-fg-neutral-muted",
              )}
            >
              {label}
            </button>
          ))}
        </div>
        {p.tab !== "mine" && (
          <label className="mt-x2 flex h-9 items-center gap-x2 rounded-r2 border border-stroke-neutral-weak bg-bg-layer-default px-x2_5 focus-within:border-stroke-neutral-contrast">
            <Search className="size-4 text-fg-neutral-subtle" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={p.tab === "symbols" ? "기호 검색" : "무늬 검색"}
              aria-label={p.tab === "symbols" ? "기호 검색" : "무늬 검색"}
              className="min-w-0 flex-1 bg-transparent text-[0.875rem] outline-none placeholder:text-fg-neutral-subtle"
            />
            {q && (
              <button type="button" aria-label="검색어 지우기" onClick={() => setQ("")} className="text-fg-neutral-subtle">
                <X className="size-4" />
              </button>
            )}
          </label>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-x3 pt-x2 pb-x4">
        {p.tab === "symbols" &&
          (groups.length === 0 ? (
            <p className="py-x8 text-center text-[0.8125rem] text-fg-neutral-subtle">검색 결과가 없어요.</p>
          ) : (
            groups.map((g) => (
              <section key={g.id} className="mt-x2">
                <h4 className="mb-x1_5 text-[0.75rem] font-semibold text-fg-neutral-muted">{g.label}</h4>
                <div className="grid grid-cols-6 gap-x1">
                  {g.items.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      title={s.name}
                      aria-label={s.name}
                      aria-pressed={p.pick === s.id && !p.stamp}
                      onClick={() => p.onPick(s.id)}
                      style={{ gridColumn: `span ${Math.min(s.width, 6)}` }}
                      className={cx(
                        "flex h-9 items-center justify-center rounded-r2 border text-fg-neutral transition-colors",
                        p.pick === s.id && !p.stamp
                          ? "border-stroke-brand-solid bg-bg-brand-weak"
                          : "border-stroke-neutral-muted bg-bg-layer-default hover:border-stroke-neutral-weak hover:bg-bg-neutral-weak",
                      )}
                    >
                      <KnitSymbolIcon id={s.id} cell={s.width > 3 ? 30 * Math.min(1, 5.4 / s.width) : 26} />
                    </button>
                  ))}
                </div>
              </section>
            ))
          ))}

        {p.tab === "library" && (
          <>
            <p className="mt-x1 rounded-r2 bg-bg-neutral-weak px-x2_5 py-x2 text-[0.75rem] leading-[1.5] text-fg-neutral-muted">
              격자를 누르면 무늬가 한 번 찍히고, 끌면 이어서 찍혀요.
            </p>
            {lib.length === 0 && <p className="py-x8 text-center text-[0.8125rem] text-fg-neutral-subtle">검색 결과가 없어요.</p>}
            {lib.map((c) => (
              <section key={c.id} className="mt-x3">
                <h4 className="mb-x1_5 text-[0.75rem] font-semibold text-fg-neutral-muted">{c.label}</h4>
                <ul className="flex flex-col gap-x1">
                  {c.items.map((l) => {
                    const on = p.stamp?.kind === "lib" && p.stamp.id === l.id;
                    return (
                      <li key={l.id}>
                        <button
                          type="button"
                          aria-pressed={on}
                          onClick={() => p.onStamp(on ? null : { kind: "lib", id: l.id, name: l.name, block: l.block })}
                          className={cx(
                            "flex w-full items-center gap-x3 rounded-r2 border p-x1_5 text-left",
                            on ? "border-stroke-brand-solid bg-bg-brand-weak" : "border-transparent hover:bg-bg-neutral-weak",
                          )}
                        >
                          <span className="flex size-12 items-center justify-center overflow-hidden rounded-r1_5 border border-stroke-neutral-muted bg-white">
                            <BlockPreview block={l.block} geo={p.geo} max={44} />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-[0.875rem] font-medium">{l.name}</span>
                            <span className="text-[0.75rem] text-fg-neutral-subtle tabular-nums">
                              {l.block.cols}코 × {l.block.rows}단 반복
                            </span>
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </section>
            ))}
          </>
        )}

        {p.tab === "mine" && (
          <>
            <Button size="sm" className="mt-x1 w-full" onClick={p.onSaveMine}>
              <Plus className="size-4" />
              내 무늬로 등록
            </Button>
            {p.mine.length === 0 ? (
              <p className="mt-x4 px-x1 text-[0.8125rem] leading-[1.6] text-fg-neutral-subtle">
                격자를 선택해 내 무늬로 등록하면 여기에 나타나요. 다른 도안에서도 같이 쓸 수 있어요
              </p>
            ) : (
              <ul className="mt-x3 flex flex-col gap-x1">
                {p.mine.map((m) => {
                  const on = p.stamp?.kind === "mine" && p.stamp.id === m.id;
                  return (
                    <li key={m.id} className="group/mine relative">
                      <button
                        type="button"
                        aria-pressed={on}
                        onClick={() => p.onStamp(on ? null : { kind: "mine", id: m.id, name: m.name, block: m.block })}
                        className={cx(
                          "flex w-full items-center gap-x3 rounded-r2 border p-x1_5 pr-x8 text-left",
                          on ? "border-stroke-brand-solid bg-bg-brand-weak" : "border-transparent hover:bg-bg-neutral-weak",
                        )}
                      >
                        <span className="flex size-12 items-center justify-center overflow-hidden rounded-r1_5 border border-stroke-neutral-muted bg-white">
                          <BlockPreview block={m.block} geo={p.geo} max={44} />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[0.875rem] font-medium">{m.name}</span>
                          <span className="text-[0.75rem] text-fg-neutral-subtle tabular-nums">
                            {m.block.cols}코 × {m.block.rows}단
                          </span>
                        </span>
                      </button>
                      <IconButton
                        label="무늬 삭제"
                        size="sm"
                        className="absolute top-1/2 right-x1 -translate-y-1/2 opacity-0 group-hover/mine:opacity-100 focus:opacity-100"
                        onClick={() => p.onDeleteMine(m.id)}
                      >
                        <Trash />
                      </IconButton>
                    </li>
                  );
                })}
              </ul>
            )}
          </>
        )}
      </div>

      {p.tab === "symbols" && (
        <div className="flex h-11 shrink-0 items-center gap-x2 border-t border-stroke-neutral-muted px-x3 text-[0.8125rem]">
          {picked ? (
            <>
              <span className="flex h-7 items-center rounded-r1_5 border border-stroke-neutral-muted bg-white px-x1">
                <KnitSymbolIcon id={picked.id} cell={picked.width > 3 ? 14 : 20} />
              </span>
              <span className="min-w-0 truncate font-medium">{picked.name}</span>
              {picked.width > 1 && <span className="shrink-0 text-fg-neutral-subtle">{picked.width}코</span>}
            </>
          ) : (
            <span className="text-fg-neutral-subtle">왼쪽에서 기호를 골라주세요</span>
          )}
        </div>
      )}
      {p.tab !== "symbols" && p.stamp && (
        <div className="flex shrink-0 flex-col gap-x1_5 border-t border-stroke-neutral-muted p-x3">
          <p className="truncate text-[0.8125rem] font-semibold">{p.stamp.name}</p>
          <Button size="sm" variant="primary" disabled={!p.active} onClick={p.onFillGrid}>
            {p.active ? `격자 전체 채우기 (${p.active.cols}코 × ${p.active.rows}단)` : "격자 전체 채우기"}
          </Button>
          <Button size="sm" onClick={p.onNewGridFromStamp}>
            새 격자로 만들기
          </Button>
        </div>
      )}
    </aside>
  );
}

// ---------------- Right panel ----------------

type RightProps = {
  doc: KDoc;
  activeId: string | null;
  sel: Sel | null;
  onActivate: (id: string) => void;
  onAddGrid: () => void;
  onRename: (id: string, name: string) => void;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
  onGauge: (g: KDoc["gauge"]) => void;
  onNumbering: (n: Numbering) => void;
  onFlipH: () => void;
  onFlipV: () => void;
  onRotate: () => void;
  onClearSel: () => void;
  onSaveMine: () => void;
  className?: string;
};

export function RightPanel(p: RightProps) {
  const [renaming, setRenaming] = useState<string | null>(null);
  const active = p.doc.grids.find((g) => g.id === p.activeId) ?? null;
  const n = active?.numbering ?? DEFAULT_NUMBERING;
  const filled = useMemo(() => (active ? filledCount(active) : 0), [active]);
  const legend = useMemo(() => (active ? colorCounts(active) : []), [active]);
  const { sts, rows } = p.doc.gauge;

  return (
    <aside aria-label="보드 · 레이어" className={cx("flex w-[248px] shrink-0 flex-col overflow-y-auto border-l border-stroke-neutral-muted bg-bg-layer-default", p.className)}>
      <section className="border-b border-stroke-neutral-muted px-x3 py-x3">
        <PanelTitle
          action={
            <IconButton label="격자 추가" size="sm" onClick={p.onAddGrid}>
              <Plus />
            </IconButton>
          }
        >
          보드 · 레이어
        </PanelTitle>
        {p.doc.grids.length === 0 ? (
          <p className="mt-x1 text-[0.8125rem] text-fg-neutral-subtle">아직 격자가 없어요.</p>
        ) : (
          <ul className="mt-x1 flex flex-col gap-0.5">
            {[...p.doc.grids].reverse().map((g) => (
              <li
                key={g.id}
                className={cx(
                  "group/row flex h-9 items-center gap-x1 rounded-r2 pr-x1 pl-x0_5",
                  g.id === p.activeId ? "bg-bg-neutral-weak" : "hover:bg-bg-neutral-weak",
                )}
              >
                <IconButton label={g.visible ? "레이어 숨기기" : "레이어 표시"} size="sm" onClick={() => p.onToggle(g.id)} className={cx(!g.visible && "text-fg-neutral-subtle")}>
                  {g.visible ? <Eye /> : <EyeOff />}
                </IconButton>
                {renaming === g.id ? (
                  <input
                    autoFocus
                    defaultValue={g.name}
                    aria-label="이름 변경"
                    onBlur={(e) => {
                      p.onRename(g.id, e.target.value.trim().slice(0, 40) || g.name);
                      setRenaming(null);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                      if (e.key === "Escape") setRenaming(null);
                    }}
                    className="h-7 min-w-0 flex-1 rounded-r1_5 border border-stroke-neutral-contrast bg-bg-layer-default px-x1_5 text-[0.8125rem] outline-none"
                  />
                ) : (
                  <button
                    type="button"
                    onClick={() => p.onActivate(g.id)}
                    onDoubleClick={() => setRenaming(g.id)}
                    className={cx("h-full min-w-0 flex-1 truncate text-left text-[0.8125rem]", g.id === p.activeId ? "font-semibold" : "font-medium", !g.visible && "text-fg-neutral-subtle")}
                  >
                    {g.name}
                    <span className="ml-x1_5 text-[0.75rem] font-normal text-fg-neutral-subtle tabular-nums">
                      {g.cols}×{g.rows}
                    </span>
                  </button>
                )}
                <Menu
                  align="end"
                  trigger={({ toggle }) => (
                    <IconButton label="더 보기" size="sm" onClick={toggle} className="opacity-60 group-hover/row:opacity-100">
                      <More />
                    </IconButton>
                  )}
                  items={[
                    { label: "이름 변경", onSelect: () => setRenaming(g.id) },
                    { label: "격자 삭제", danger: true, onSelect: () => p.onDelete(g.id) },
                  ]}
                />
              </li>
            ))}
          </ul>
        )}
      </section>

      {p.sel && active && p.sel.gridId === active.id && (
        <section className="border-b border-stroke-neutral-muted px-x3 py-x3">
          <PanelTitle>
            선택 <span className="ml-x1 font-normal text-fg-neutral-muted tabular-nums">{`${rectW(p.sel)}×${rectH(p.sel)}`}</span>
          </PanelTitle>
          <div className="mt-x1 flex items-center gap-x0_5">
            <IconButton label="좌우 뒤집기" shortcut="⇧H" size="sm" onClick={p.onFlipH}>
              <FlipH />
            </IconButton>
            <IconButton label="상하 뒤집기" shortcut="⇧V" size="sm" onClick={p.onFlipV}>
              <FlipV />
            </IconButton>
            <IconButton label="오른쪽 회전" shortcut="R" size="sm" onClick={p.onRotate}>
              <RotateCw />
            </IconButton>
            <IconButton label="삭제" shortcut="Delete" size="sm" onClick={p.onClearSel}>
              <Trash />
            </IconButton>
          </div>
          <Button size="sm" className="mt-x2 w-full" onClick={p.onSaveMine}>
            내 무늬로 등록
          </Button>
        </section>
      )}

      {active ? (
        <>
          <section className="border-b border-stroke-neutral-muted px-x3 py-x3">
            <PanelTitle>{active.name}</PanelTitle>
            <p className="text-[0.875rem] font-semibold tabular-nums">
              {active.cols}코 × {active.rows}단
            </p>
            <p className="mt-x0_5 text-[0.75rem] text-fg-neutral-muted tabular-nums">
              예상 완성 크기 약 {((active.cols * 10) / sts).toFixed(1)} × {((active.rows * 10) / rows).toFixed(1)}cm
            </p>
            <p className="mt-x1 text-[0.75rem] text-fg-neutral-muted tabular-nums">채워진 칸 {filled}</p>
          </section>

          <section className="border-b border-stroke-neutral-muted px-x3 py-x3">
            <PanelTitle>게이지</PanelTitle>
            <p className="mb-x2 text-[0.75rem] leading-[1.5] text-fg-neutral-subtle">10cm 안의 코·단 수예요. 칸 모양과 완성 크기가 여기에 맞춰져요.</p>
            <div className="flex flex-col gap-x1_5">
              <NumberField label="10cm 코 수" value={sts} min={4} max={60} suffix="코" className="justify-between" onChange={(v) => p.onGauge({ sts: v, rows })} />
              <NumberField label="10cm 단 수" value={rows} min={4} max={80} suffix="단" className="justify-between" onChange={(v) => p.onGauge({ sts, rows: v })} />
            </div>
          </section>

          <section className="border-b border-stroke-neutral-muted px-x3 py-x3">
            <PanelTitle>단수 표시</PanelTitle>
            <Segmented
              value={n.side}
              onChange={(side) => p.onNumbering({ ...n, side })}
              options={[
                { value: "left", label: "왼쪽" },
                { value: "right", label: "오른쪽" },
              ]}
              className={cx(n.alternate && "pointer-events-none opacity-50")}
            />
            <label className="mt-x2 flex h-8 cursor-pointer items-center justify-between text-[0.8125rem] text-fg-neutral">
              번갈아 표시
              <input
                type="checkbox"
                checked={n.alternate}
                onChange={(e) => {
                  p.onNumbering({ ...n, alternate: e.target.checked });
                  e.currentTarget.blur();
                }}
                className="size-4 accent-[var(--seed-color-bg-brand-solid)]"
              />
            </label>
            <label className="flex h-8 items-center justify-between text-[0.8125rem] text-fg-neutral">
              단수 표시 간격
              <select
                value={n.interval}
                disabled={n.alternate}
                onChange={(e) => {
                  p.onNumbering({ ...n, interval: Number(e.target.value) });
                  e.currentTarget.blur();
                }}
                className="h-8 rounded-r2 border border-stroke-neutral-weak bg-bg-layer-default px-x2 text-[0.8125rem] disabled:opacity-50"
              >
                {[1, 2, 5, 10].map((v) => (
                  <option key={v} value={v}>
                    {v === 1 ? "모든 단" : `${v}단마다`}
                  </option>
                ))}
              </select>
            </label>
            {n.alternate && <p className="mt-x1 text-[0.75rem] text-fg-neutral-subtle">번갈아 표시 중에는 단마다 표시돼요</p>}
          </section>

          <section className="px-x3 py-x3">
            <PanelTitle>사용한 색</PanelTitle>
            {legend.length === 0 ? (
              <p className="text-[0.75rem] text-fg-neutral-subtle">칸 색칠(B)로 칠한 색이 여기에 모여요.</p>
            ) : (
              <ul className="flex flex-col gap-x1">
                {legend.map((l, i) => (
                  <li key={l.color} className="flex items-center gap-x2 text-[0.8125rem]">
                    <span className="size-4 shrink-0 rounded-[4px] border border-black/10" style={{ background: l.color }} />
                    <span className="min-w-0 flex-1 truncate">
                      색 {i + 1} · {l.color}
                    </span>
                    <span className="text-[0.75rem] text-fg-neutral-subtle tabular-nums">{l.count}코</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      ) : (
        <p className="px-x3 py-x4 text-[0.8125rem] leading-[1.6] text-fg-neutral-subtle">격자를 고르면 크기·게이지·단수 표시를 여기서 바꿀 수 있어요.</p>
      )}
    </aside>
  );
}
