"use client";

import { useMemo, useState, type ReactNode } from "react";
import { cx } from "@/components/app/ui";
import { Labeled, ScrubField, Seg, Switch } from "@/components/editor/grid/fields";
import type { ApparelData, ApparelMeasure, ApparelPiece } from "@/lib/types";
import { ROLE_LABEL, cm1, stepNotation, stepRange, stepText, type Draft } from "./model";

// ---------- shared bits (same look as the 배색·방안 panels) ----------

export const PanelSection = ({ title, aside, children }: { title: string; aside?: ReactNode; children?: ReactNode }) => (
  <section className="shrink-0 border-b border-stroke-neutral-muted">
    <div className="flex h-10 items-center justify-between gap-x2 px-x3">
      <span className="t2-bold text-fg-neutral">{title}</span>
      {aside}
    </div>
    {children && <div className="flex flex-col gap-x2 px-x3 pb-x4">{children}</div>}
  </section>
);

export const Row = ({ label, children }: { label: string; children: ReactNode }) => (
  <div className="flex min-h-7 items-center justify-between gap-x2">
    <span className="t2-regular shrink-0 text-fg-neutral-muted">{label}</span>
    <div className="flex min-w-0 items-center justify-end gap-x1">{children}</div>
  </div>
);

export const headBtn = "t1-medium flex h-7 items-center gap-x1 rounded-r1 px-x1_5 text-fg-neutral-muted hover:bg-bg-layer-default-pressed hover:text-fg-neutral";

const Hint = ({ children }: { children: ReactNode }) => <p className="t1-regular text-fg-neutral-muted">{children}</p>;

type Set = (fn: (d: ApparelData) => ApparelData, key?: string) => void;

// ---------- 형태 ----------

export function ShapePanel({ d, set, onCraft, onNeckline }: { d: ApparelData; set: Set; onCraft: (c: ApparelData["craft"]) => void; onNeckline: (n: ApparelData["neckline"]) => void }) {
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
      <PanelSection title="구조">
        <Seg
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
        <Row label="목선">
          <div className="w-40">
            <Seg
              label="목선"
              value={d.neckline}
              onChange={onNeckline}
              options={[
                { value: "round", label: "라운드" },
                { value: "v", label: "브이넥" },
              ]}
            />
          </div>
        </Row>
        <Row label="가디건 (앞트임)">
          <Switch checked={d.cardigan} onChange={(cardigan) => set((x) => ({ ...x, cardigan }))} label="가디건 (앞트임)" />
        </Row>
        {d.cardigan && (
          <>
            <div className="grid grid-cols-2 gap-1.5">
              <Labeled label="앞단 너비">
                <ScrubField label="앞단 너비" value={d.bandWidth} min={1} max={10} step={0.5} decimals={1} suffix="cm" height={8} onChange={(bandWidth) => set((x) => ({ ...x, bandWidth }), "bandWidth")} />
              </Labeled>
              <Labeled label="단추 개수">
                <ScrubField label="단추 개수" value={d.buttons} min={0} max={12} suffix="개" height={8} onChange={(buttons) => set((x) => ({ ...x, buttons }), "buttons")} />
              </Labeled>
            </div>
            <Hint>앞판은 반판 한 장을 좌우 대칭으로 두 장 떠요. 앞단은 앞 가장자리에서 코를 주워 고무뜨기해요.</Hint>
          </>
        )}
      </PanelSection>
      <PanelSection title="뜨개 종류">
        <Seg
          label="뜨개 종류"
          value={d.craft}
          onChange={onCraft}
          options={[
            { value: "knit", label: "대바늘" },
            { value: "crochet", label: "코바늘" },
          ]}
        />
        <Hint>{d.craft === "crochet" ? "코바늘은 단 끝에서 뜨지 않고 남기거나 모아떠서 줄여요. 게이지는 바탕뜨기(짧은뜨기 등)로 재요." : "대바늘은 겉면 단에서 양쪽 가장자리를 줄이고 늘려요."}</Hint>
      </PanelSection>
      <PanelSection title="뜨는 방향">
        <Row label="뜨는 방향">
          <span className="t2-medium text-fg-neutral">바텀업</span>
        </Row>
        <Hint>밑단에서 코를 잡아 위로 떠요. 앞판·뒤판·소매를 따로 떠서 이어요.</Hint>
      </PanelSection>
    </div>
  );
}

// ---------- 치수 ----------

type MKey = keyof ApparelMeasure;
const BODY: { k: MKey; label: string }[] = [
  { k: "bust", label: "가슴둘레" },
  { k: "bodyLength", label: "옷길이" },
  { k: "shoulderWidth", label: "어깨너비" },
  { k: "armholeDepth", label: "진동 깊이" },
  { k: "neckWidth", label: "목너비" },
  { k: "frontNeckDepth", label: "앞목 깊이" },
  { k: "backNeckDepth", label: "뒷목 깊이" },
  { k: "shoulderDrop", label: "어깨 처짐" },
  { k: "hemRib", label: "밑단 고무단" },
];
const SLEEVE: { k: MKey; label: string }[] = [
  { k: "sleeveLength", label: "소매길이" },
  { k: "upperArm", label: "위팔둘레" },
  { k: "cuffWidth", label: "소매부리 둘레" },
  { k: "cuffRib", label: "소매 고무단" },
];

export function SizePanel({ d, set, onSize, onFit, onResetMeasure }: { d: ApparelData; set: Set; onSize: (s: ApparelData["size"]) => void; onFit: (f: ApparelData["fit"]) => void; onResetMeasure: () => void }) {
  const field = ({ k, label }: { k: MKey; label: string }) => (
    <Labeled key={k} label={label}>
      <ScrubField
        label={label}
        value={d.measure[k]}
        min={0}
        max={200}
        step={0.5}
        decimals={1}
        suffix="cm"
        height={8}
        onChange={(v) => set((x) => ({ ...x, measure: { ...x.measure, [k]: v } }), `m-${k}`)}
      />
    </Labeled>
  );
  const ease = (k: keyof ApparelData["ease"], label: string, max: number) => (
    <div className="flex flex-col gap-x1">
      <div className="flex items-center justify-between">
        <span className="t2-regular text-fg-neutral-muted">{label}</span>
        <span className="t2-medium tabular-nums text-fg-neutral">+{d.ease[k]}cm</span>
      </div>
      <input
        type="range"
        aria-label={`여유량 ${label}`}
        min={0}
        max={max}
        step={0.5}
        value={d.ease[k]}
        onChange={(e) => set((x) => ({ ...x, ease: { ...x.ease, [k]: Number(e.target.value) } }), `ease-${k}`)}
        className="w-full accent-[var(--seed-color-bg-brand-solid)]"
      />
    </div>
  );
  const sleeves = d.style !== "vest";
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
      <PanelSection
        title="사이즈"
        aside={
          <button type="button" className={headBtn} onClick={onResetMeasure}>
            기본 치수로
          </button>
        }
      >
        <Seg label="사이즈" value={d.size} onChange={onSize} options={(["S", "M", "L", "XL"] as const).map((s) => ({ value: s, label: s }))} />
      </PanelSection>
      <PanelSection title="핏 · 여유량">
        <Seg
          label="핏"
          value={d.fit}
          onChange={onFit}
          options={[
            { value: "slim", label: "슬림" },
            { value: "regular", label: "레귤러" },
            { value: "over", label: "오버" },
          ]}
        />
        {ease("bust", "가슴", 40)}
        {ease("armhole", "진동", 10)}
        {sleeves && ease("upperArm", "위팔", 16)}
      </PanelSection>
      <PanelSection title="몸판">
        <div className="grid grid-cols-2 gap-x-1.5 gap-y-x2">{BODY.map(field)}</div>
      </PanelSection>
      {sleeves && (
        <PanelSection title="소매">
          <div className="grid grid-cols-2 gap-x-1.5 gap-y-x2">{SLEEVE.map(field)}</div>
          <Hint>소매길이는 어깨 끝점에서 소매 끝까지예요.</Hint>
        </PanelSection>
      )}
    </div>
  );
}

// ---------- 게이지 ----------

export function GaugePanel({ d, set }: { d: ApparelData; set: Set }) {
  const [sw, setSw] = useState<{ sts: number; rows: number; w: number; h: number } | null>(null);
  const result = sw && sw.w > 0 && sw.h > 0 ? { sts: cm1((sw.sts * 10) / sw.w), rows: cm1((sw.rows * 10) / sw.h) } : null;
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
      <PanelSection title="10cm 게이지">
        <div className="grid grid-cols-2 gap-1.5">
          <Labeled label="코">
            <ScrubField label="게이지 코" value={d.gauge.sts} min={4} max={60} step={0.5} decimals={1} suffix="코" height={8} disabled={!!sw} onChange={(sts) => set((x) => ({ ...x, gauge: { ...x.gauge, sts } }), "g-sts")} />
          </Labeled>
          <Labeled label="단">
            <ScrubField label="게이지 단" value={d.gauge.rows} min={4} max={80} step={0.5} decimals={1} suffix="단" height={8} disabled={!!sw} onChange={(rows) => set((x) => ({ ...x, gauge: { ...x.gauge, rows } }), "g-rows")} />
          </Labeled>
        </div>
        {sw ? <Hint>게이지는 스와치에서 계산돼요. 직접 넣으려면 스와치를 지우세요.</Hint> : <Hint>10cm 안의 코·단 수를 넣으면 판마다 코수·단수가 계산돼요.</Hint>}
      </PanelSection>
      <PanelSection
        title="스와치"
        aside={
          sw ? (
            <button type="button" className={headBtn} onClick={() => setSw(null)}>
              스와치 지우기
            </button>
          ) : (
            <button type="button" className={headBtn} onClick={() => setSw({ sts: Math.round(d.gauge.sts * 1.5), rows: Math.round(d.gauge.rows * 1.5), w: 15, h: 15 })}>
              스와치로 재기
            </button>
          )
        }
      >
        {sw ? (
          <>
            <div className="grid grid-cols-2 gap-1.5">
              <Labeled label="코수">
                <ScrubField label="스와치 코수" value={sw.sts} min={1} max={300} suffix="코" height={8} onChange={(v) => setSw({ ...sw, sts: v })} />
              </Labeled>
              <Labeled label="단수">
                <ScrubField label="스와치 단수" value={sw.rows} min={1} max={400} suffix="단" height={8} onChange={(v) => setSw({ ...sw, rows: v })} />
              </Labeled>
              <Labeled label="가로">
                <ScrubField label="스와치 가로" value={sw.w} min={1} max={60} step={0.5} decimals={1} suffix="cm" height={8} onChange={(v) => setSw({ ...sw, w: v })} />
              </Labeled>
              <Labeled label="세로">
                <ScrubField label="스와치 세로" value={sw.h} min={1} max={60} step={0.5} decimals={1} suffix="cm" height={8} onChange={(v) => setSw({ ...sw, h: v })} />
              </Labeled>
            </div>
            {result && (
              <div className="flex items-center justify-between gap-x2 rounded-r2 bg-bg-layer-fill px-x3 py-x2">
                <span className="t2-medium tabular-nums">
                  10cm = {result.sts}코 × {result.rows}단
                </span>
                <button
                  type="button"
                  className="t2-bold rounded-r1 px-x2 py-x1 text-fg-brand hover:bg-bg-layer-default"
                  onClick={() => {
                    set((x) => ({ ...x, gauge: { sts: result.sts, rows: result.rows } }));
                    setSw(null);
                  }}
                >
                  적용
                </button>
              </div>
            )}
          </>
        ) : (
          <Hint>스와치를 뜬 뒤 코·단 수와 잰 크기를 넣으면 게이지가 계산돼요.</Hint>
        )}
      </PanelSection>
    </div>
  );
}

// ---------- 도안 레이어 (overlay) ----------

export type OverlaySource = { id: string; title: string; craft: string; thumbnail?: string };

export function LayerPanel({ d, set, sources }: { d: ApparelData; set: Set; sources: OverlaySource[] }) {
  const [q, setQ] = useState("");
  const list = useMemo(() => sources.filter((s) => !q.trim() || s.title.toLowerCase().includes(q.trim().toLowerCase())), [sources, q]);
  const o = d.overlay;
  const pieces: { value: ApparelPiece; label: string }[] = [
    { value: "front", label: "앞판" },
    { value: "back", label: "뒤판" },
    ...(d.style !== "vest" ? [{ value: "sleeve" as const, label: "소매" }] : []),
  ];
  const patch = (p: Partial<NonNullable<ApparelData["overlay"]>>, key?: string) => set((x) => (x.overlay ? { ...x, overlay: { ...x.overlay, ...p } } : x), key);
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
      {o && (
        <PanelSection
          title="올린 도안"
          aside={
            <button type="button" className={headBtn} onClick={() => set((x) => ({ ...x, overlay: null }))}>
              빼기
            </button>
          }
        >
          <p className="t2-medium truncate">{sources.find((s) => s.id === o.workId)?.title ?? "제목 없음"}</p>
          <Seg label="피스" value={o.piece} onChange={(piece) => patch({ piece })} options={pieces} />
          <div className="grid grid-cols-2 gap-1.5">
            <Labeled label="크기">
              <ScrubField label="도안 크기" value={Math.round(o.scale * 100)} min={10} max={200} suffix="%" height={8} onChange={(v) => patch({ scale: v / 100 }, "ov-scale")} />
            </Labeled>
            <Labeled label="투명도">
              <ScrubField label="도안 투명도" value={Math.round(o.opacity * 100)} min={10} max={100} suffix="%" height={8} onChange={(v) => patch({ opacity: v / 100 }, "ov-op")} />
            </Labeled>
            <Labeled label="가로 위치">
              <ScrubField label="도안 가로 위치" value={o.x} min={-60} max={60} step={0.5} decimals={1} suffix="cm" height={8} onChange={(x) => patch({ x }, "ov-x")} />
            </Labeled>
            <Labeled label="세로 위치">
              <ScrubField label="도안 세로 위치" value={o.y} min={-80} max={80} step={0.5} decimals={1} suffix="cm" height={8} onChange={(y) => patch({ y }, "ov-y")} />
            </Labeled>
          </div>
          <Hint>판 바깥으로 나간 부분은 잘려서 보여요.</Hint>
        </PanelSection>
      )}
      <PanelSection title="도안 가져오기">
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="도안 검색"
          aria-label="도안 검색"
          className="t3-regular h-8 w-full rounded-r2 bg-bg-layer-fill px-x2 text-fg-neutral outline-none placeholder:text-fg-neutral-subtle"
        />
        {list.length === 0 ? (
          <Hint>{sources.length ? "검색 결과가 없어요." : "가져올 코바늘·대바늘 도안이 없어요."}</Hint>
        ) : (
          <ul className="grid grid-cols-2 gap-x2">
            {list.map((s) => (
              <li key={s.id}>
                <button
                  type="button"
                  aria-pressed={o?.workId === s.id}
                  onClick={() => set((x) => ({ ...x, overlay: { workId: s.id, piece: x.overlay?.piece ?? "front", x: 0, y: 4, scale: 0.6, opacity: 0.85 } }))}
                  className={cx(
                    "flex w-full flex-col gap-x1 rounded-r2 border p-x1_5 text-left",
                    o?.workId === s.id ? "border-stroke-brand-solid bg-bg-brand-weak" : "border-stroke-neutral-muted hover:bg-bg-layer-fill",
                  )}
                >
                  <span className="flex aspect-square items-center justify-center overflow-hidden rounded-r1 bg-bg-layer-fill">
                    {s.thumbnail ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={s.thumbnail} alt="" className="h-full w-full object-contain" />
                    ) : (
                      <span className="t1-regular text-fg-neutral-subtle">미리보기 없음</span>
                    )}
                  </span>
                  <span className="t1-medium truncate">{s.title || "제목 없음"}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </PanelSection>
    </div>
  );
}

// ---------- 코수 계산 (right) ----------

export function CalcPanel({ d, dr }: { d: ApparelData; dr: Draft }) {
  const [open, setOpen] = useState<ApparelPiece | "none" | null>(null);
  return (
    <>
      <div className="flex h-10 shrink-0 items-center justify-between border-b border-stroke-neutral-muted px-x3">
        <span className="t3-bold text-fg-neutral">코수 계산</span>
        <span className="t1-regular tabular-nums text-fg-neutral-muted">
          10cm = {d.gauge.sts}코 × {d.gauge.rows}단
        </span>
      </div>
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
        <PanelSection title="완성 크기">
          <Row label="가슴둘레">
            <span className="t2-medium tabular-nums">{cm1(dr.finished.bust)}cm</span>
          </Row>
          <Row label="옷길이">
            <span className="t2-medium tabular-nums">{cm1(dr.finished.length)}cm</span>
          </Row>
          <Row label="진동 깊이">
            <span className="t2-medium tabular-nums">{cm1(dr.finished.armhole)}cm</span>
          </Row>
          {d.style !== "vest" && (
            <Row label="위팔둘레">
              <span className="t2-medium tabular-nums">{cm1(dr.finished.upperArm)}cm</span>
            </Row>
          )}
          {dr.warnings.map((w) => (
            <p key={w} className="t1-regular rounded-r2 bg-bg-warning-weak px-x2 py-x1_5 text-fg-warning-contrast">
              {w}
            </p>
          ))}
        </PanelSection>
        {dr.pieces.map((p) => {
          const isOpen = open === null ? p.id === "back" : open === p.id;
          return (
            <section key={p.id} className="shrink-0 border-b border-stroke-neutral-muted" data-piece={p.id}>
              <button type="button" aria-expanded={isOpen} onClick={() => setOpen(isOpen ? "none" : p.id)} className="flex h-10 w-full items-center justify-between gap-x2 px-x3 text-left hover:bg-bg-layer-default-pressed/60">
                <span className="t2-bold text-fg-neutral">
                  {p.name}
                  {p.count > 1 && <span className="t2-regular ml-x1 text-fg-neutral-muted">×{p.count}</span>}
                </span>
                <span className="t1-regular tabular-nums text-fg-neutral-muted">
                  {p.castOn}코 · {p.rows}단
                </span>
              </button>
              {isOpen && (
                <div className="flex flex-col gap-x2 px-x3 pb-x4">
                  <div className="grid grid-cols-2 gap-1.5">
                    <Stat label="시작 코" value={`${p.castOn}코`} sub={`${cm1(p.castOn / dr.gs)}cm`} />
                    <Stat label="총 단수" value={`${p.rows}단`} sub={`${cm1(p.rows / dr.gr)}cm`} />
                    <Stat label="가장 넓은 곳" value={`${p.widest}코`} sub={`${cm1(p.widest / dr.gs)}cm`} />
                    <Stat label="완성 크기" value={`${cm1(p.widest / dr.gs)}×${cm1(p.rows / dr.gr)}`} sub="cm" />
                  </div>
                  <ol className="flex flex-col">
                    {p.steps.map((s, i) => (
                      <li key={i} className="flex gap-x2 border-t border-stroke-neutral-muted py-x1_5 first:border-t-0">
                        <span className="t1-regular w-16 shrink-0 pt-px tabular-nums text-fg-neutral-muted">{stepRange(s)}</span>
                        <span className="min-w-0 flex-1">
                          {s.kind !== "castOn" && s.kind !== "rib" && <span className="t1-bold mr-x1 text-fg-neutral-muted">{ROLE_LABEL[s.role]}</span>}
                          <span className="t2-regular text-fg-neutral">{stepText(s, d.craft)}</span>
                          {stepNotation(s) && <span className="t1-regular ml-x1 rounded-r1 bg-bg-layer-fill px-x1 font-mono text-fg-neutral-muted">{stepNotation(s)}</span>}
                        </span>
                      </li>
                    ))}
                  </ol>
                  <p className="t1-regular text-fg-neutral-muted">{p.sidesNote === "both" ? "양쪽 똑같이 떠요. 한쪽 기준으로 적었어요." : "왼쪽·오른쪽 앞판을 좌우 대칭으로 떠요."}</p>
                </div>
              )}
            </section>
          );
        })}
        <PanelSection title="마무리 고무단">
          <p className="t2-regular">
            목둘레 {dr.bands.neck.cm}cm: {dr.bands.neck.sts}코 줍기
          </p>
          {dr.bands.armhole && (
            <p className="t2-regular">
              진동 둘레 {dr.bands.armhole.cm}cm: 한쪽에 {dr.bands.armhole.sts}코 줍기
            </p>
          )}
          {dr.bands.front && (
            <>
              <p className="t2-regular">
                앞단 {dr.bands.front.cm}cm: 한쪽에 {dr.bands.front.sts}코 줍기
              </p>
              {dr.bands.front.holes.length > 0 && (
                <p className="t2-regular">
                  단춧구멍 {dr.bands.front.holes.length}개: 앞단 {dr.bands.front.rows}단 중 {dr.bands.front.holeRow}단째, 밑단에서 {dr.bands.front.holes.join("·")}코째
                </p>
              )}
            </>
          )}
          <Hint>2-1-3은 2단마다 1코씩 3번이라는 뜻이에요. 시작 코부터 위로 읽어요.</Hint>
        </PanelSection>
      </div>
    </>
  );
}

const Stat = ({ label, value, sub }: { label: string; value: string; sub: string }) => (
  <div className="flex min-w-0 flex-col rounded-r2 bg-bg-layer-fill px-x2 py-x1_5">
    <span className="t1-regular truncate text-fg-neutral-muted">{label}</span>
    <span className="t3-bold tabular-nums">{value}</span>
    <span className="t1-regular tabular-nums text-fg-neutral-muted">{sub}</span>
  </div>
);
