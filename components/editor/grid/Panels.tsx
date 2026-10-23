"use client";

import { useState, type ReactNode } from "react";
import { Brush, More, Plus, Trash } from "@/components/app/icons";
import { Button, IconButton, Menu, NumberField, Segmented, cx } from "@/components/app/ui";
import type { GridMode, GridPage } from "@/lib/types";
import { Alert } from "./icons";
import { type AnchorH, type AnchorV, type GridDoc, MAX_COLORS, MAX_DIM, filetInk, finishedSize } from "./model";
import { Toggle } from "./StartDialog";

export const Section = ({ title, children, aside }: { title: string; children: ReactNode; aside?: ReactNode }) => (
  <section className="border-b border-stroke-neutral-muted px-x4 py-x4 last:border-b-0">
    <div className="mb-x3 flex items-center justify-between gap-x2">
      <h3 className="text-[0.8125rem] font-bold text-fg-neutral">{title}</h3>
      {aside}
    </div>
    {children}
  </section>
);

// ---------- left: yarns + pages ----------

type LeftProps = {
  doc: GridDoc;
  page: GridPage;
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

export const yarnName = (i: number) => (i === 0 ? "배경 실" : `실 ${i}`);

export function LeftPanel(p: LeftProps) {
  const { doc, counts } = p;
  const filet = doc.mode === "filet";
  const unit = filet ? "칸" : "코";
  const [renaming, setRenaming] = useState<string | null>(null);

  const filled = counts.reduce((s, n, i) => (i > 0 ? s + n : s), 0);
  return (
    <div className="flex h-full flex-col overflow-y-auto">
      <Section
        title="실"
        aside={
          !filet && (
            <label
              className={cx(
                "relative inline-flex h-7 cursor-pointer items-center gap-x1 rounded-r2 px-x2 text-[0.75rem] font-semibold text-fg-neutral hover:bg-bg-layer-fill",
                doc.yarns.length >= MAX_COLORS && "pointer-events-none opacity-40",
              )}
            >
              <Plus className="size-3.5" />
              새 실 색 추가
              <input
                type="color"
                aria-label="새 실 색 추가"
                defaultValue="#c47a5c"
                className="absolute inset-0 cursor-pointer opacity-0"
                onChange={(e) => p.onAddYarn(e.target.value)}
              />
            </label>
          )
        }
      >
        {filet ? (
          <ul className="flex flex-col gap-x1">
            <YarnRow
              color={filetInk(doc.yarns)}
              label="채운칸"
              count={`${filled}칸`}
              active={p.current >= 1}
              onClick={() => p.setCurrent(1)}
              onRecolor={(c) => p.onRecolor(1, c)}
              filled
            />
            <YarnRow color="#ffffff" label="빈칸" count={`${counts[0] ?? 0}칸`} active={p.current === 0} onClick={() => p.setCurrent(0)} open ink={filetInk(doc.yarns)} />
          </ul>
        ) : (
          <ul className="flex flex-col gap-x1">
            {doc.yarns.map((c, i) => (
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
            ))}
          </ul>
        )}
        {!filet && <p className="mt-x3 text-[0.75rem] leading-[1.5] text-fg-neutral-subtle">오른쪽 클릭으로 칠하면 배경 실로 지워져요.</p>}
      </Section>

      <Section
        title="페이지"
        aside={
          <Button size="sm" variant="ghost" className="h-7 px-x2 text-[0.75rem]" onClick={p.onAddPage}>
            <Plus className="size-3.5" />
            페이지 추가
          </Button>
        }
      >
        <ul className="flex flex-col gap-x1">
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
                    className="m-x1 h-8 min-w-0 flex-1 rounded-r1_5 border border-stroke-neutral-contrast bg-bg-layer-default px-x2 text-[1rem] outline-none"
                  />
                ) : (
                  <button
                    type="button"
                    onClick={() => p.onSelectPage(pg.id)}
                    onDoubleClick={() => setRenaming(pg.id)}
                    aria-current={active}
                    className="flex h-10 min-w-0 flex-1 items-center gap-x2 px-x2 text-left"
                  >
                    <span className={cx("min-w-0 flex-1 truncate text-[0.875rem]", active ? "font-semibold text-fg-neutral" : "text-fg-neutral-muted")}>{pg.name}</span>
                    <span className="shrink-0 text-[0.75rem] text-fg-neutral-subtle tabular-nums">
                      {pg.cols}×{pg.rows}
                    </span>
                  </button>
                )}
                <Menu
                  align="end"
                  trigger={({ toggle, open }) => (
                    <IconButton label={`${pg.name} 메뉴`} size="sm" onClick={toggle} className={cx(!open && !active && "opacity-0 group-hover:opacity-100 focus-visible:opacity-100")}>
                      <More />
                    </IconButton>
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
      </Section>
    </div>
  );
}

function YarnRow(p: {
  color: string;
  label: string;
  count: string;
  active: boolean;
  onClick: () => void;
  onRecolor?: (c: string) => void;
  onRemove?: () => void;
  shortcut?: string;
  filled?: boolean;
  open?: boolean;
  ink?: string;
}) {
  return (
    <li className={cx("group flex items-center gap-x1 rounded-r2 pr-x1", p.active ? "bg-bg-layer-fill" : "hover:bg-bg-layer-fill")}>
      <button type="button" aria-pressed={p.active} onClick={p.onClick} className="flex h-11 min-w-0 flex-1 items-center gap-x2_5 px-x2 text-left" title={p.shortcut ? `${p.label} (${p.shortcut})` : p.label}>
        <span
          className={cx("relative size-7 shrink-0 rounded-r1_5 border border-black/15", p.active && "ring-2 ring-stroke-neutral-contrast ring-offset-1")}
          style={{ background: p.color }}
        >
          {p.open && <span className="absolute inset-[7px] rounded-[2px] border" style={{ borderColor: p.ink, opacity: 0.5 }} />}
        </span>
        <span className="min-w-0 flex-1">
          <span className={cx("block truncate text-[0.875rem]", p.active ? "font-semibold" : "")}>{p.label}</span>
          <span className="block text-[0.75rem] text-fg-neutral-subtle uppercase">{p.open ? " " : p.color}</span>
        </span>
        <span className="shrink-0 text-[0.75rem] text-fg-neutral-muted tabular-nums">{p.count}</span>
      </button>
      {p.onRecolor && (
        <label
          className="relative inline-flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-r2 text-fg-neutral-muted opacity-0 group-hover:opacity-100 focus-within:opacity-100 hover:bg-bg-layer-default"
          title={`${p.label} 색 바꾸기`}
        >
          <Brush className="size-4" />
          <input type="color" aria-label={`${p.label} 색 바꾸기`} value={p.color} onChange={(e) => p.onRecolor!(e.target.value)} className="absolute inset-0 cursor-pointer opacity-0" />
        </label>
      )}
      {p.onRemove && (
        <IconButton label={`${p.label} 지우기`} size="sm" onClick={p.onRemove} className="opacity-0 group-hover:opacity-100 focus-visible:opacity-100">
          <Trash />
        </IconButton>
      )}
    </li>
  );
}

// ---------- right: mode, settings, checks ----------

type RightProps = {
  doc: GridDoc;
  page: GridPage;
  setMode: (m: GridMode) => void;
  setGauge: (g: { sts: number; rows: number }) => void;
  setSafe: (s: { sts: number; rows: number }) => void;
  safeHit: boolean;
  setOpt: (patch: Partial<Pick<GridDoc, "working" | "hand" | "floatLimit" | "showFloats" | "exportGauge">>) => void;
  onResize: (cols: number, rows: number, h: AnchorH, v: AnchorV) => void;
  floatsCount: number;
  isolatedCount: number;
  onCleanup: () => void;
  onMake: () => void;
};

const ANCH_H: AnchorH[] = ["left", "center", "right"];
const ANCH_V: AnchorV[] = ["top", "middle", "bottom"];
const anchorLabel = (v: AnchorV, h: AnchorH) =>
  `${v === "top" ? "위" : v === "middle" ? "가운데" : "아래"} ${h === "left" ? "왼쪽" : h === "center" ? "가운데" : "오른쪽"}`;

export function RightPanel(p: RightProps) {
  const { doc, page } = p;
  const filet = doc.mode === "filet";
  const safe = doc.safe ?? { sts: 0, rows: 0 };
  const size = finishedSize(page.cols, page.rows, doc.gauge);
  const limit = doc.floatLimit ?? 5;
  const cm = Math.round(((limit * 10) / Math.max(1, doc.gauge.sts)) * 10) / 10;
  const [draft, setDraft] = useState<{ id: string; cols: number; rows: number } | null>(null);
  const d = draft && draft.id === `${page.id}:${page.cols}x${page.rows}` ? draft : { id: `${page.id}:${page.cols}x${page.rows}`, cols: page.cols, rows: page.rows };
  const [anchor, setAnchor] = useState<{ h: AnchorH; v: AnchorV }>({ h: "right", v: "bottom" });
  const dirty = d.cols !== page.cols || d.rows !== page.rows;

  return (
    <div className="flex h-full flex-col overflow-y-auto">
      <div className="border-b border-stroke-neutral-muted p-x3">
        <Segmented
          value={doc.mode}
          onChange={p.setMode}
          options={[
            { value: "knit", label: "대바늘 배색" },
            { value: "tapestry", label: "코바늘 배색" },
            { value: "filet", label: "코바늘 방안" },
          ]}
        />
        <Button size="sm" className="mt-x3 w-full" onClick={p.onMake}>
          글자·이미지로 만들기
        </Button>
      </div>

      <Section title="격자 크기">
        <div className="flex flex-col gap-x2">
          <NumberField className="justify-between" label="가로" value={d.cols} min={1} max={MAX_DIM} onChange={(v) => setDraft({ ...d, cols: v })} />
          <NumberField className="justify-between" label="세로" value={d.rows} min={1} max={MAX_DIM} onChange={(v) => setDraft({ ...d, rows: v })} />
        </div>
        {dirty && (
          <div className="mt-x3 flex items-start gap-x3">
            <div role="group" aria-label="기준 위치" className="grid shrink-0 grid-cols-3 gap-0.5 rounded-r2 bg-bg-layer-fill p-0.5">
              {ANCH_V.map((v) =>
                ANCH_H.map((h) => (
                  <button
                    key={v + h}
                    type="button"
                    aria-label={anchorLabel(v, h)}
                    aria-pressed={anchor.h === h && anchor.v === v}
                    onClick={() => setAnchor({ h, v })}
                    className={cx("size-5 rounded-[4px]", anchor.h === h && anchor.v === v ? "bg-bg-neutral-inverted" : "bg-bg-layer-default hover:bg-bg-layer-basement")}
                  />
                )),
              )}
            </div>
            <div className="flex min-w-0 flex-1 flex-col gap-x2">
              <p className="text-[0.75rem] leading-[1.5] text-fg-neutral-subtle">기준 위치는 그대로 두고 반대쪽으로 칸이 늘거나 줄어요.</p>
              <Button size="sm" variant="primary" onClick={() => p.onResize(d.cols, d.rows, anchor.h, anchor.v)}>
                적용
              </Button>
            </div>
          </div>
        )}
      </Section>

      <Section title="게이지 (10cm)">
        <div className="flex flex-col gap-x2">
          <NumberField className="justify-between" label={filet ? "10cm 칸" : "10cm 코"} value={doc.gauge.sts} min={1} max={80} onChange={(v) => p.setGauge({ ...doc.gauge, sts: v })} />
          <NumberField className="justify-between" label="10cm 단" value={doc.gauge.rows} min={1} max={120} onChange={(v) => p.setGauge({ ...doc.gauge, rows: v })} />
        </div>
        <p className="mt-x3 flex items-baseline justify-between text-[0.8125rem]">
          <span className="text-fg-neutral-muted">예상 완성 크기</span>
          <span className="font-semibold tabular-nums">
            약 {size.w} × {size.h} cm
          </span>
        </p>
      </Section>

      <Section title="뜨는 방식">
        <div className="flex flex-col gap-x2">
          <Segmented
            value={doc.working ?? "flat"}
            onChange={(v) => p.setOpt({ working: v })}
            options={[
              { value: "flat", label: "평면" },
              { value: "round", label: "원통" },
            ]}
          />
          <Segmented
            value={doc.hand ?? "right"}
            onChange={(v) => p.setOpt({ hand: v })}
            options={[
              { value: "right", label: "오른손" },
              { value: "left", label: "왼손" },
            ]}
          />
          <p className="text-[0.75rem] leading-[1.5] text-fg-neutral-subtle">
            {(doc.working ?? "flat") === "flat"
              ? `단 번호가 ${doc.hand === "left" ? "왼쪽" : "오른쪽"} 아래에서 시작해 단마다 양옆을 오가요.`
              : `원통은 모든 단을 같은 방향으로 떠서 번호가 ${doc.hand === "left" ? "왼쪽" : "오른쪽"}에만 붙어요.`}
          </p>
        </div>
      </Section>

      <Section title="안전구역">
        <div className="flex flex-col gap-x2">
          <NumberField className="justify-between" label="양옆 여유" value={safe.sts} min={0} max={30} onChange={(v) => p.setSafe({ ...safe, sts: v })} />
          <NumberField className="justify-between" label="위아래 여유" value={safe.rows} min={0} max={30} onChange={(v) => p.setSafe({ ...safe, rows: v })} />
        </div>
        <p className="mt-x2 text-[0.75rem] leading-[1.5] text-fg-neutral-subtle">도안 바깥에 무늬 없는 여유 코·단을 더해요. 이음선이나 테두리 자리로 쓰세요.</p>
        {p.safeHit && (
          <p role="status" className="mt-x2 flex items-center gap-x1_5 text-[0.8125rem] font-semibold text-fg-critical">
            <Alert className="size-4" />
            안전구역 안에 무늬가 있어요
          </p>
        )}
      </Section>

      <Section title="검사">
        {doc.mode === "knit" ? (
          <div className="flex flex-col gap-x3">
            <Toggle checked={!!doc.showFloats} onChange={(v) => p.setOpt({ showFloats: v })}>
              도안에 긴 건너뛰기 표시
            </Toggle>
            <div className="flex items-center gap-x1">
              <NumberField label="건너뛰기 실 경고" value={limit} min={1} max={40} onChange={(v) => p.setOpt({ floatLimit: v })} />
              <span className="text-[0.8125rem] text-fg-neutral-muted">코 초과</span>
            </div>
            <p className={cx("rounded-r2 px-x3 py-x2 text-[0.8125rem]", p.floatsCount ? "bg-bg-critical-weak text-fg-critical" : "bg-bg-layer-fill text-fg-neutral-muted")}>
              {p.floatsCount ? `${cm}cm보다 긴 걸침실 ${p.floatsCount}곳` : "문제 없어요"}
            </p>
          </div>
        ) : (
          <p className="text-[0.8125rem] text-fg-neutral-subtle">건너뛰기 실 검사는 대바늘 배색에서 볼 수 있어요.</p>
        )}
        <div className="mt-x3 flex items-center justify-between gap-x2 text-[0.8125rem]">
          <span className="text-fg-neutral-muted">혼자 떨어진 칸 {p.isolatedCount}곳</span>
          <Button size="sm" variant="ghost" className="h-7 px-x2 text-[0.75rem]" disabled={!p.isolatedCount} onClick={p.onCleanup}>
            한 칸짜리 점 없애기
          </Button>
        </div>
      </Section>

      <Section title="내보내기">
        <Toggle checked={!!doc.exportGauge} onChange={(v) => p.setOpt({ exportGauge: v })}>
          게이지 정보 넣기
        </Toggle>
      </Section>
    </div>
  );
}

