"use client";

import { memo, useEffect, useMemo, useRef, useState } from "react";
import { cx } from "@/components/app/ui";
import { CROCHET_SYMBOLS, STROKE_WIDTH, SYMBOL_GROUPS, SymbolIcon, symbolMatches, type SymbolGroup } from "@/lib/symbols/crochet";
import type { SaveStatus } from "@/lib/useAutosave";
import { unionBounds } from "./geometry";
import { MY_ICON_MAX, type MyIcon } from "./myIcons";
import { ItemsPreview } from "./render";
import { BTN, el, sab } from "./seed";
import { ChevronDown, Cloud, CloudAlert, CloudCheck, PanelLeft, Pencil, Search, X } from "./uiIcons";

export type Picked = { kind: "symbol"; id: string } | { kind: "my"; id: string } | null;
export type PaletteTab = "symbols" | "mine";

type Props = {
  title: string;
  onRename: (t: string) => void;
  status: SaveStatus;
  onCollapse: () => void;
  tab: PaletteTab;
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

export const MyIconPreview = memo(function MyIconPreview({ icon, size = 40, className }: { icon: MyIcon; size?: number; className?: string }) {
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
      className={className}
      strokeWidth={Math.max(STROKE_WIDTH, (STROKE_WIDTH * side) / 60)}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ pointerEvents: "none" }}
    >
      <ItemsPreview items={icon.items} />
    </svg>
  );
});

const STATUS_LABEL: Record<SaveStatus, string> = { saved: "저장됨", saving: "저장 중", error: "저장 실패" };

/** Title row: doc title (click to rename), save status, panel toggle. */
function TitleRow({ title, onRename, status, onCollapse }: Pick<Props, "title" | "onRename" | "status" | "onCollapse">) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(title);
  const commit = () => {
    setEditing(false);
    const t = draft.trim().slice(0, 60);
    if (t && t !== title) onRename(t);
  };
  return (
    <div className="flex h-11 shrink-0 items-center gap-x1 border-b border-stroke-neutral-muted px-x2">
      {editing ? (
        <input
          autoFocus
          aria-label="도안 제목"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") commit();
            if (e.key === "Escape") setEditing(false);
          }}
          className="t4-medium h-8 min-w-0 flex-1 rounded-r2 bg-bg-layer-fill px-x2 text-fg-neutral outline-none"
        />
      ) : (
        <button
          type="button"
          title={title}
          onClick={() => (setDraft(title), setEditing(true))}
          className="t4-medium h-8 min-w-0 flex-1 truncate rounded-r2 px-x2 text-left text-fg-neutral hover:bg-bg-layer-default-pressed"
        >
          {title}
          <span className="sr-only">, 도안 제목</span>
        </button>
      )}
      <span className="inline-flex" title={STATUS_LABEL[status]}>
        <button
          type="button"
          aria-label={STATUS_LABEL[status]}
          disabled
          data-save-status={status}
          className={cx("flex h-7 w-7 shrink-0 items-center justify-center gap-1 rounded-r2 disabled:cursor-default", status === "error" ? "text-fg-critical" : "text-fg-neutral-subtle")}
        >
          {status === "saved" ? <CloudCheck className="size-3.5" /> : status === "saving" ? <Cloud className="size-3.5 animate-pulse" /> : <CloudAlert className="size-3.5" />}
        </button>
      </span>
      <button type="button" aria-label="접기" title="패널 접기" onClick={onCollapse} className={cx(sab("ghost"), BTN, "w-x8 px-0")} style={el(32, 32)}>
        <PanelLeft className="size-4" />
      </button>
    </div>
  );
}

function Tile({ label, active, onClick, children, data }: { label: string; active: boolean; onClick: () => void; children: React.ReactNode; data?: string }) {
  return (
    <div className="relative">
      <button
        type="button"
        title={label}
        aria-label={label}
        aria-pressed={active}
        data-tour="palette-symbol"
        data-symbol={data}
        draggable={false}
        onClick={onClick}
        className={cx(sab(active ? "brandSolid" : "ghost"), BTN, "h-auto w-full flex-col gap-0.5 rounded-r2 px-1 py-1.5 whitespace-normal")}
        style={el(80, 43)}
      >
        {children}
        {/* layout-audit-ignore: tiny-text — reference palette tile label is 10px/13px; full name is also in title/aria-label */}
        <span className="max-w-full text-center text-[10px] leading-[13px] line-clamp-2 whitespace-normal break-keep pointer-coarse:line-clamp-none">{label}</span>
      </button>
    </div>
  );
}

export const Palette = memo(function Palette(p: Props) {
  const [searching, setSearching] = useState(false);
  const [collapsed, setCollapsed] = useState<Set<SymbolGroup>>(new Set());
  const searchRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (searching) searchRef.current?.focus();
  }, [searching]);

  const q = p.query.trim();
  const groups = useMemo(
    () =>
      SYMBOL_GROUPS.filter((g) => g.id !== "extra" || q)
        .map((g) => ({ ...g, symbols: CROCHET_SYMBOLS.filter((s) => s.group === g.id && symbolMatches(s, q)) }))
        .filter((g) => g.symbols.length),
    [q],
  );
  const icons = useMemo(() => p.icons.filter((m) => !q || m.name.toLowerCase().includes(q.toLowerCase())), [p.icons, q]);
  const toggleGroup = (id: SymbolGroup) =>
    setCollapsed((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  const mine = p.tab === "mine";

  return (
    <aside data-stitch-palette="true" aria-label="기호 팔레트" className="flex h-full min-h-0 flex-col overflow-hidden border-r border-stroke-neutral-muted bg-bg-layer-default" style={{ width: "100%", ["--tile-min" as string]: "64px" }}>
      <TitleRow title={p.title} onRename={p.onRename} status={p.status} onCollapse={p.onCollapse} />
      <div className="flex h-10 shrink-0 items-center border-b border-stroke-neutral-muted px-x2">
        <span className="t3-bold min-w-0 flex-1 px-x1 text-fg-neutral">{mine ? "내 기호" : "기호"}</span>
        <button
          type="button"
          data-tour="create-glyph"
          aria-label="내 기호 만들기"
          title={p.canSave ? "선택한 기호를 내 기호로 등록 (M)" : "기호를 선택한 뒤 눌러 내 기호로 등록해요"}
          onClick={p.onSaveSelection}
          className={cx(sab("ghost"), BTN, "size-7 shrink-0 px-0")}
          style={el(28, 28)}
        >
          <Pencil className="size-4" />
        </button>
        <button
          type="button"
          aria-label="기호 검색"
          title="기호 검색"
          aria-pressed={searching}
          onClick={() => {
            if (searching) p.onQuery("");
            setSearching((v) => !v);
          }}
          className={cx(sab("ghost"), BTN, "size-7 shrink-0 px-0")}
          style={el(28, 28)}
        >
          <Search className="size-4" />
        </button>
      </div>
      {searching && (
        <label className="mx-x2 mt-x2 flex h-8 shrink-0 items-center gap-x1_5 rounded-r2 bg-bg-layer-fill px-x2 text-fg-neutral-subtle focus-within:ring-1 focus-within:ring-stroke-neutral-contrast">
          <Search className="size-3.5 shrink-0" />
          <input
            ref={searchRef}
            type="text"
            enterKeyHint="search"
            value={p.query}
            onChange={(e) => p.onQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Escape" && (p.onQuery(""), setSearching(false))}
            placeholder="기호·도형 이름 (예: 한길, ㅉㅇ)"
            aria-label="기호 이름으로 찾기"
            className="h-full min-w-0 flex-1 bg-transparent text-[12px] text-fg-neutral outline-none placeholder:text-fg-placeholder"
          />
          {p.query && (
            <button type="button" aria-label="검색어 지우기" onClick={() => p.onQuery("")} className="text-fg-neutral-subtle hover:text-fg-neutral">
              <X className="size-3.5" />
            </button>
          )}
        </label>
      )}
      {p.assigning && <p className="mx-x2 mt-x2 rounded-r2 bg-bg-brand-weak px-x2_5 py-x1_5 text-[12px] font-semibold text-fg-brand">퀵 슬롯에 넣을 기호를 고르세요</p>}
      <div className="relative min-h-0 flex-1">
        <div className="size-full overflow-y-scroll [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" data-testid="palette-list">
          <div className="space-y-4 p-2 pt-3 pb-4">
            {!mine ? (
              groups.length ? (
                <div className="space-y-6">
                  {groups.map((g) => {
                    const open = !collapsed.has(g.id) || !!q;
                    return (
                      <div key={g.id}>
                        <button
                          type="button"
                          aria-expanded={open}
                          onClick={() => toggleGroup(g.id)}
                          className="t2-bold mb-x2 flex w-full items-center justify-between gap-x1 border-b border-stroke-neutral-muted px-x1 pb-x1 text-left text-fg-neutral"
                        >
                          <span className="min-w-0 truncate">{g.label}</span>
                          <ChevronDown className={cx("size-3.5 shrink-0 transition-transform", !open && "-rotate-90")} />
                        </button>
                        {open && (
                          <div className="panel-tile-grid gap-1">
                            {g.symbols.map((s) => {
                              const active = p.picked?.kind === "symbol" && p.picked.id === s.id;
                              return (
                                <Tile key={s.id} label={s.name} data={s.id} active={active} onClick={() => p.onPick({ kind: "symbol", id: s.id })}>
                                  <SymbolIcon id={s.id} className={cx("shrink-0 overflow-visible", active ? "text-fg-neutral-inverted" : "text-fg-neutral")} />
                                </Tile>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="py-x8 text-center text-[13px] text-fg-neutral-subtle">찾는 기호가 없어요.</p>
              )
            ) : (
              <div>
                <div className="t2-bold mb-x2 flex w-full items-center justify-between gap-x1 border-b border-stroke-neutral-muted px-x1 pb-x1 text-fg-neutral">
                  <span>내 기호</span>
                  <span className="text-[11px] font-normal text-fg-neutral-subtle tabular-nums">
                    {p.icons.length}/{MY_ICON_MAX}
                  </span>
                </div>
                <button
                  type="button"
                  disabled={!p.canSave}
                  onClick={p.onSaveSelection}
                  title={p.canSave ? undefined : "등록할 기호나 선을 선택한 뒤 다시 눌러 주세요"}
                  className={cx(sab("neutralOutline"), BTN, "mb-x3 h-8 w-full gap-1.5 !rounded-r2 text-[12px]")}
                  style={el(240, 32)}
                >
                  선택한 기호를 내 기호로 등록
                  <kbd className="rounded-[4px] bg-bg-layer-fill px-1 font-sans text-[11px] text-fg-neutral-muted">M</kbd>
                </button>
                {icons.length ? (
                  <div className="panel-tile-grid gap-1">
                    {icons.map((m) => {
                      const active = p.picked?.kind === "my" && p.picked.id === m.id;
                      return (
                        <div key={m.id} className="group/my relative">
                          <Tile label={m.name} active={active} onClick={() => p.onPick({ kind: "my", id: m.id })}>
                            <MyIconPreview icon={m} size={22} className="size-[22px]" />
                          </Tile>
                          <button
                            type="button"
                            aria-label="기호 삭제"
                            title="기호 삭제"
                            onClick={() => p.onDeleteIcon(m.id)}
                            className="absolute top-0.5 right-0.5 hidden size-4 items-center justify-center rounded-full bg-bg-layer-fill text-fg-neutral-muted group-hover/my:flex hover:bg-bg-critical-solid hover:text-fg-neutral-inverted"
                          >
                            <X className="size-2.5" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="rounded-r2 bg-bg-layer-fill px-x3 py-x4 text-center text-[12px] leading-relaxed text-fg-neutral-muted">
                    {p.icons.length ? "찾는 기호가 없어요." : "캔버스에서 기호를 선택한 뒤 등록하면 여기에 모여요. 다른 도안에서도 같이 쓸 수 있어요."}
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </aside>
  );
});
