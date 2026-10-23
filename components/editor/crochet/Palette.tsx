"use client";

import { memo, useMemo } from "react";
import { Search, X } from "@/components/app/icons";
import { Button, Segmented, cx } from "@/components/app/ui";
import { CROCHET_SYMBOLS, INK, STROKE_WIDTH, SYMBOL_GROUPS, SymbolIcon, symbolMatches } from "@/lib/symbols/crochet";
import { unionBounds } from "./geometry";
import { MY_ICON_MAX, type MyIcon } from "./myIcons";
import { ItemsPreview } from "./render";

export type Picked = { kind: "symbol"; id: string } | { kind: "my"; id: string } | null;
export type PaletteTab = "symbols" | "shapes" | "mine";

type Props = {
  tab: PaletteTab;
  onTab: (t: PaletteTab) => void;
  query: string;
  onQuery: (q: string) => void;
  picked: Picked;
  onPick: (p: Picked) => void;
  icons: MyIcon[];
  canSave: boolean;
  onSaveSelection: () => void;
  onDeleteIcon: (id: string) => void;
  assigning: boolean;
};

export const MyIconPreview = memo(function MyIconPreview({ icon, size = 40 }: { icon: MyIcon; size?: number }) {
  const b = unionBounds(icon.items);
  if (!b) return <span style={{ width: size, height: size }} />;
  const side = Math.max(b.x1 - b.x0, b.y1 - b.y0, 30) + 6;
  const cx0 = (b.x0 + b.x1) / 2, cy0 = (b.y0 + b.y1) / 2;
  return (
    <svg
      viewBox={`${cx0 - side / 2} ${cy0 - side / 2} ${side} ${side}`}
      width={size}
      height={size}
      aria-hidden="true"
      fill="none"
      strokeWidth={Math.max(STROKE_WIDTH, (STROKE_WIDTH * side) / 60)}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ pointerEvents: "none" }}
    >
      <ItemsPreview items={icon.items} />
    </svg>
  );
});

export const Palette = memo(function Palette(p: Props) {
  const groups = useMemo(() => {
    const wanted = p.tab === "shapes" ? ["shape"] : SYMBOL_GROUPS.filter((g) => g.id !== "shape").map((g) => g.id);
    return SYMBOL_GROUPS.filter((g) => wanted.includes(g.id))
      .map((g) => ({ ...g, symbols: CROCHET_SYMBOLS.filter((s) => s.group === g.id && symbolMatches(s, p.query)) }))
      .filter((g) => g.symbols.length);
  }, [p.tab, p.query]);
  const icons = useMemo(() => p.icons.filter((m) => !p.query.trim() || m.name.toLowerCase().includes(p.query.trim().toLowerCase())), [p.icons, p.query]);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex flex-col gap-x2 p-x3 pb-x2">
        <Segmented
          value={p.tab}
          onChange={p.onTab}
          options={[
            { value: "symbols", label: "기호" },
            { value: "shapes", label: "도형" },
            { value: "mine", label: "내 기호" },
          ]}
        />
        <label className="flex h-9 items-center gap-x2 rounded-r2 bg-bg-layer-fill px-x2_5 text-fg-neutral-subtle focus-within:ring-1 focus-within:ring-stroke-neutral-contrast">
          <Search className="size-4 shrink-0" />
          <input
            type="search"
            value={p.query}
            onChange={(e) => p.onQuery(e.target.value)}
            placeholder="기호 검색"
            aria-label="기호 검색"
            className="h-full min-w-0 flex-1 bg-transparent text-[0.875rem] text-fg-neutral outline-none placeholder:text-fg-placeholder"
          />
          {p.query && (
            <button type="button" aria-label="검색어 지우기" onClick={() => p.onQuery("")} className="text-fg-neutral-subtle hover:text-fg-neutral">
              <X className="size-4" />
            </button>
          )}
        </label>
        {p.assigning && (
          <p className="rounded-r2 bg-[var(--seed-color-palette-lime-100,#f3fbe1)] px-x2_5 py-x1_5 text-[0.75rem] font-semibold text-fg-brand">
            퀵 슬롯에 넣을 기호를 고르세요
          </p>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-x3 pb-x6" data-testid="palette-list">
        {p.tab !== "mine" ? (
          groups.length ? (
            groups.map((g) => (
              <section key={g.id} className="mt-x2 first:mt-0">
                <h3 className="sticky top-0 z-[1] bg-bg-layer-default py-x1_5 text-[0.75rem] font-semibold text-fg-neutral-muted">{g.label}</h3>
                <div className="grid grid-cols-3 gap-x1">
                  {g.symbols.map((s) => {
                    const active = p.picked?.kind === "symbol" && p.picked.id === s.id;
                    return (
                      <button
                        key={s.id}
                        type="button"
                        title={s.name}
                        aria-label={s.name}
                        aria-pressed={active}
                        data-symbol={s.id}
                        onClick={() => p.onPick({ kind: "symbol", id: s.id })}
                        className={cx(
                          "flex min-h-[76px] flex-col items-center justify-start gap-x1 rounded-r2 border px-x1 pt-x1_5 pb-x1 transition-colors",
                          active ? "border-stroke-neutral-contrast bg-bg-layer-fill" : "border-transparent hover:bg-bg-layer-fill",
                        )}
                      >
                        <SymbolIcon id={s.id} size={38} color={INK} />
                        <span className="line-clamp-2 text-center text-[0.6875rem] leading-[1.25] text-fg-neutral">{s.name}</span>
                      </button>
                    );
                  })}
                </div>
              </section>
            ))
          ) : (
            <p className="py-x8 text-center text-[0.8125rem] text-fg-neutral-subtle">검색 결과가 없어요.</p>
          )
        ) : (
          <section>
            <div className="flex items-center justify-between py-x1_5">
              <h3 className="text-[0.75rem] font-semibold text-fg-neutral-muted">
                내 기호 <span className="font-normal text-fg-neutral-subtle">{p.icons.length}/{MY_ICON_MAX}</span>
              </h3>
            </div>
            <Button size="sm" className="mb-x3 w-full" disabled={!p.canSave} onClick={p.onSaveSelection} title={p.canSave ? undefined : "등록할 기호나 선을 선택한 뒤 다시 눌러 주세요"}>
              내 기호로 등록
              <kbd className="rounded-[4px] bg-bg-layer-fill px-1 font-sans text-[0.6875rem] text-fg-neutral-muted">M</kbd>
            </Button>
            {icons.length ? (
              <div className="grid grid-cols-3 gap-x1">
                {icons.map((m) => {
                  const active = p.picked?.kind === "my" && p.picked.id === m.id;
                  return (
                    <div key={m.id} className="group/my relative">
                      <button
                        type="button"
                        title={m.name}
                        aria-label={m.name}
                        aria-pressed={active}
                        onClick={() => p.onPick({ kind: "my", id: m.id })}
                        className={cx(
                          "flex min-h-[76px] w-full flex-col items-center gap-x1 rounded-r2 border px-x1 pt-x1_5 pb-x1",
                          active ? "border-stroke-neutral-contrast bg-bg-layer-fill" : "border-transparent hover:bg-bg-layer-fill",
                        )}
                      >
                        <MyIconPreview icon={m} size={38} />
                        <span className="line-clamp-2 text-center text-[0.6875rem] leading-[1.25] text-fg-neutral">{m.name}</span>
                      </button>
                      <button
                        type="button"
                        aria-label="기호 삭제"
                        title="기호 삭제"
                        onClick={() => p.onDeleteIcon(m.id)}
                        className="absolute top-0.5 right-0.5 hidden size-5 items-center justify-center rounded-full bg-bg-layer-default text-fg-neutral-muted shadow-s1 group-hover/my:flex hover:text-fg-critical"
                      >
                        <X className="size-3" />
                      </button>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="rounded-r3 bg-bg-layer-fill px-x3 py-x4 text-center text-[0.8125rem] leading-relaxed text-fg-neutral-muted">
                {p.icons.length ? "검색 결과가 없어요." : "기호를 선택한 뒤 내 기호로 등록하면 여기에 나타나요. 다른 도안에서도 같이 쓸 수 있어요"}
              </p>
            )}
          </section>
        )}
        {p.tab === "shapes" && <p className="mt-x4 text-[0.75rem] leading-relaxed text-fg-neutral-subtle">클릭해서 놓은 뒤, 오른쪽 속성에서 크기를 바꿀 수 있어요.</p>}
      </div>
    </div>
  );
});
