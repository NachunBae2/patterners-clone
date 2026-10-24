"use client";

// Left panels behind the rail: 템플릿, 원문·파일로 만들기, AI 어시스턴트 (rule-based, local).
import { useEffect, useMemo, useRef, useState } from "react";
import { Button, NumberField, Segmented, cx } from "@/components/app/ui";
import type { CrochetLayer } from "@/lib/types";
import type { SaveStatus } from "@/lib/useAutosave";
import { buildChart, roundCounts, type Layout } from "./chart";
import { parsePattern, type ParseResult } from "./parser";
import { TitleRow } from "./Palette";
import { ChartPreview } from "./render";
import { BTN, el, sab } from "./seed";
import { TEMPLATES, TEMPLATE_MAX_STITCHES, templateDefaults, type TemplateDef } from "./templates";
import { ChevronDown, FileUp, Search, Sparkle, X } from "./uiIcons";
import { HELP } from "./assistant";

type Shell = { title: string; onRename: (t: string) => void; status: SaveStatus; onCollapse: () => void };

/** Same frame as the symbol palette: title row, a section header, scrolling body. */
function PanelFrame({ shell, heading, label, children, action }: { shell: Shell; heading: string; label: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <aside aria-label={label} className="flex h-full min-h-0 flex-col overflow-hidden border-r border-stroke-neutral-muted bg-bg-layer-default" style={{ width: "100%" }}>
      <TitleRow title={shell.title} onRename={shell.onRename} status={shell.status} onCollapse={shell.onCollapse} />
      <div className="flex h-10 shrink-0 items-center border-b border-stroke-neutral-muted px-x2">
        <span className="t3-bold min-w-0 flex-1 truncate px-x1 text-fg-neutral">{heading}</span>
        {action}
      </div>
      {children}
    </aside>
  );
}

const LocalNote = ({ children }: { children: React.ReactNode }) => (
  <p className="rounded-r2 bg-bg-layer-fill px-x2_5 py-x2 text-[12px] leading-relaxed text-fg-neutral-muted" data-testid="local-note">
    {children}
  </p>
);

// ---------- 템플릿 ----------

function templateRounds(t: TemplateDef, p: Record<string, number>) {
  const rounds = t.build(p);
  const counts = roundCounts(rounds);
  return { rounds, counts, total: counts.reduce((s, c) => s + c, 0) };
}

function TemplateCard({ t, onOpen }: { t: TemplateDef; onOpen: () => void }) {
  const items = useMemo(() => buildChart(t.build(templateDefaults(t)), { layout: t.layout, cx: 0, cy: 0 }).flatMap((r) => r.items), [t]);
  return (
    <button
      type="button"
      onClick={onOpen}
      data-template={t.id}
      className="flex w-full items-center gap-x2_5 rounded-r2 p-x1_5 text-left transition-colors hover:bg-bg-layer-default-pressed"
    >
      <span className="flex size-14 shrink-0 items-center justify-center rounded-r2 border border-stroke-neutral-muted bg-white">
        <ChartPreview items={items} width={52} height={52} pad={4} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="t3-bold block text-fg-neutral">{t.name}</span>
        <span className="line-clamp-2 text-[12px] leading-snug text-fg-neutral-muted">{t.desc}</span>
      </span>
    </button>
  );
}

export function TemplatePanel({ shell, onInsert }: { shell: Shell; onInsert: (t: TemplateDef, params: Record<string, number>) => void }) {
  const [openId, setOpenId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [params, setParams] = useState<Record<string, number>>({});
  const t = TEMPLATES.find((x) => x.id === openId) ?? null;
  const list = TEMPLATES.filter((x) => !query.trim() || (x.name + x.desc).includes(query.trim()));
  const info = useMemo(() => (t ? templateRounds(t, params) : null), [t, params]);
  const items = useMemo(() => (t && info ? buildChart(info.rounds, { layout: t.layout, cx: 0, cy: 0 }).flatMap((r) => r.items) : []), [t, info]);
  const tooMany = !!info && info.total > TEMPLATE_MAX_STITCHES;

  return (
    <PanelFrame shell={shell} heading={t ? "템플릿 설정" : "템플릿"} label="템플릿">
      <div className="relative min-h-0 flex-1 overflow-y-auto overscroll-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" data-testid="template-panel">
        {!t ? (
          <div className="flex flex-col gap-x2 p-x2">
            <label className="flex h-8 shrink-0 items-center gap-x1_5 rounded-r2 bg-bg-layer-fill px-x2 text-fg-neutral-subtle focus-within:ring-1 focus-within:ring-stroke-neutral-contrast">
              <Search className="size-3.5 shrink-0" />
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="템플릿 검색" aria-label="템플릿 검색" className="h-full min-w-0 flex-1 bg-transparent text-[12px] text-fg-neutral outline-none placeholder:text-fg-placeholder" />
            </label>
            <p className="px-x1 text-[12px] leading-relaxed text-fg-neutral-muted">숫자 몇 개로 시작 도안을 만들어 화면 가운데에 넣어요. 넣은 뒤에는 기호를 하나하나 고칠 수 있어요.</p>
            <div className="flex flex-col gap-0.5">
              {list.map((x) => (
                <TemplateCard
                  key={x.id}
                  t={x}
                  onOpen={() => {
                    setParams(templateDefaults(x));
                    setOpenId(x.id);
                  }}
                />
              ))}
              {!list.length && <p className="py-x6 text-center text-[13px] text-fg-neutral-subtle">찾는 템플릿이 없어요.</p>}
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-x3 p-x3">
            <button type="button" onClick={() => setOpenId(null)} className="flex items-center gap-x1 self-start rounded-r1_5 px-x1 py-0.5 text-[12px] text-fg-neutral-muted hover:bg-bg-layer-default-pressed">
              <ChevronDown className="size-3.5 rotate-90" />
              템플릿 목록
            </button>
            <div>
              <h3 className="t4-bold text-fg-neutral">{t.name}</h3>
              <p className="mt-x1 text-[12px] leading-relaxed text-fg-neutral-muted">{t.desc}</p>
            </div>
            <div className="flex justify-center rounded-r2 border border-stroke-neutral-muted bg-white py-x2">
              <ChartPreview items={items} width={220} height={180} />
            </div>
            {t.fields.map((f) =>
              f.options ? (
                <div key={f.key} className="flex flex-col gap-x1_5">
                  <span className="text-[12px] font-semibold text-fg-neutral-muted">{f.label}</span>
                  <Segmented value={String(params[f.key] ?? f.def)} onChange={(v) => setParams((p) => ({ ...p, [f.key]: Number(v) }))} options={f.options.map((o) => ({ value: String(o.value), label: o.label }))} />
                </div>
              ) : (
                <NumberField
                  key={f.key}
                  label={f.label}
                  value={params[f.key] ?? f.def}
                  min={f.min}
                  max={f.max}
                  step={f.step ?? 1}
                  className="justify-between"
                  onChange={(v) => setParams((p) => ({ ...p, [f.key]: Math.round(v) }))}
                />
              ),
            )}
            {info && (
              <div className="flex flex-col gap-x1_5">
                <span className="text-[12px] font-semibold text-fg-neutral-muted">단별 코 수</span>
                <ul className="flex flex-wrap gap-x1" data-testid="template-counts">
                  {info.counts.map((c, i) => (
                    <li key={i} className="rounded-r1_5 bg-bg-layer-fill px-x1_5 py-0.5 text-[11px] text-fg-neutral-muted tabular-nums">
                      {info.rounds[i].foundation ? "바닥" : `${info.rounds[i].label}단`} <b className="font-semibold text-fg-neutral">{c}</b>
                    </li>
                  ))}
                </ul>
                <span className="text-[12px] text-fg-neutral" data-testid="template-total">
                  {info.counts.length}단 · 모두 {info.total}코
                </span>
                {tooMany && <span className="text-[12px] text-fg-critical">코가 너무 많아요. 모두 {TEMPLATE_MAX_STITCHES}코 이하로 줄여 주세요.</span>}
              </div>
            )}
            <Button variant="primary" disabled={tooMany} onClick={() => onInsert(t, params)}>
              도안에 넣기
            </Button>
          </div>
        )}
      </div>
    </PanelFrame>
  );
}

// ---------- 원문·파일로 만들기 ----------

const LAYOUTS: { value: Layout | "auto"; label: string }[] = [
  { value: "auto", label: "자동" },
  { value: "radial", label: "원형" },
  { value: "oval", label: "바닥뜨기" },
  { value: "square", label: "사각" },
  { value: "hexagon", label: "육각" },
  { value: "linear", label: "평면" },
];

const EXAMPLE = `1단: 원형코 짧은뜨기 6코
2단: 늘려뜨기 6번 (12)
R3: (sc, inc) x6 (18)
4단: (짧은뜨기 2, 늘려뜨기 1) × 6 (24)
5단: 짧은뜨기 24코`;

export type ImportOptions = { layout: Layout; ring: boolean; roundGap: number; spacing: number };

export function ImportPanel({
  shell,
  onBuild,
  onImportLayers,
  onError,
}: {
  shell: Shell;
  onBuild: (res: ParseResult, o: ImportOptions) => void;
  onImportLayers: (layers: CrochetLayer[], name: string) => void;
  onError: (msg: string) => void;
}) {
  const [text, setText] = useState("");
  const [layoutPick, setLayoutPick] = useState<Layout | "auto">("auto");
  const [ringPick, setRingPick] = useState<boolean | null>(null);
  const [roundGap, setRoundGap] = useState(4);
  const [spacing, setSpacing] = useState(1);
  const fileRef = useRef<HTMLInputElement>(null);
  const res = useMemo(() => (text.trim() ? parsePattern(text) : null), [text]);
  const layout: Layout = layoutPick === "auto" ? (res?.layout ?? "radial") : layoutPick;
  const ring = ringPick ?? (!!res?.ring || (layout === "radial" && res?.foundation === null));
  const rounds = res?.rounds ?? [];
  const preview = useMemo(() => (rounds.length ? buildChart(rounds, { layout, cx: 0, cy: 0, ring: ring && layout !== "linear", roundGap, spacing }).flatMap((r) => r.items) : []), [rounds, layout, ring, roundGap, spacing]);
  const total = res?.lines.reduce((s, l) => s + (l.kind !== "skip" ? (l.produced ?? 0) : 0), 0) ?? 0;
  const errorCount = res?.lines.reduce((s, l) => s + (l.kind !== "skip" ? l.errors.length : 0), 0) ?? 0;

  const readFile = async (f: File) => {
    try {
      const body = await f.text();
      if (/\.json$/i.test(f.name) || /^\s*[{[]/.test(body)) {
        const j = JSON.parse(body);
        const data = j?.data?.layers ? j.data : j?.layers ? j : Array.isArray(j) ? { layers: j } : null;
        const layers = (data?.layers ?? []) as CrochetLayer[];
        const ok = Array.isArray(layers) && layers.every((l) => l && Array.isArray(l.items));
        if (!ok || !layers.length || (j?.craft && j.craft !== "crochet")) return onError("코바늘 도안 파일(JSON)이 아니에요.");
        onImportLayers(layers, typeof j?.title === "string" && j.title.trim() ? j.title.trim().slice(0, 30) : "가져온 도안");
        return;
      }
      setText(body.slice(0, 20000));
    } catch {
      onError("파일을 열지 못했어요. 다른 파일로 다시 해 보세요.");
    }
  };

  return (
    <PanelFrame shell={shell} heading="서술 도안 가져오기" label="원문·파일로 만들기">
      <div
        className="relative min-h-0 flex-1 overflow-y-auto overscroll-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        data-testid="import-panel"
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          const f = e.dataTransfer.files[0];
          if (f) void readFile(f);
        }}
      >
        <div className="flex flex-col gap-x3 p-x3">
          <LocalNote>이 버전은 서버 없이 브라우저에서 규칙으로 변환해요. 한 줄에 한 단씩 적은 뒤, 원형·타원 또는 평면으로 기호를 배치해요.</LocalNote>
          <textarea
            aria-label="서술형 텍스트"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={"도안 글을 그대로 붙여넣어요.\n\n·  한 단에 한 줄씩\n·  단 번호와 코 수가 있으면 더 정확해요\n·  예) 2단: 늘려뜨기 6번 (12)\n·  예) R3: (sc, inc) x6 (18)"}
            className="min-h-[148px] w-full resize-y rounded-r2 border border-stroke-neutral-weak bg-bg-layer-default p-x2 text-[13px] leading-relaxed text-fg-neutral outline-none placeholder:text-fg-placeholder focus:border-stroke-neutral-contrast"
          />
          <div className="flex flex-wrap gap-x1_5">
            <button type="button" onClick={() => fileRef.current?.click()} className={cx(sab("neutralOutline"), BTN, "h-8 gap-1.5 !rounded-r2 px-x2_5 text-[12px]")} style={el(120, 32)}>
              <FileUp className="size-3.5" />
              텍스트·JSON 파일
            </button>
            <button type="button" onClick={() => setText(EXAMPLE)} className={cx(sab("ghost"), BTN, "h-8 !rounded-r2 px-x2_5 text-[12px] text-fg-neutral-muted")} style={el(100, 32)}>
              예시 문장 채우기
            </button>
            <input
              ref={fileRef}
              type="file"
              accept=".txt,.text,.md,.json,text/plain,application/json"
              className="hidden"
              aria-label="도안 파일 열기"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void readFile(f);
                e.target.value = "";
              }}
            />
          </div>

          <div className="flex flex-col gap-x1_5">
            <span className="text-[12px] font-semibold text-fg-neutral-muted">배치</span>
            <div className="grid grid-cols-3 gap-1" role="group" aria-label="배치">
              {LAYOUTS.map((o) => (
                <button
                  key={o.value}
                  type="button"
                  aria-pressed={layoutPick === o.value}
                  onClick={() => setLayoutPick(o.value)}
                  className={cx("h-7 rounded-r1_5 text-[12px] font-semibold", layoutPick === o.value ? "bg-bg-neutral-inverted text-fg-neutral-inverted" : "bg-bg-layer-fill text-fg-neutral-muted hover:text-fg-neutral")}
                >
                  {o.label}
                  {o.value === "auto" && res ? ` · ${LAYOUTS.find((x) => x.value === res.layout)?.label}` : ""}
                </button>
              ))}
            </div>
            {layout !== "linear" && (
              <label className="flex items-center gap-x2 text-[12px] text-fg-neutral-muted">
                <input type="checkbox" checked={ring} onChange={(e) => setRingPick(e.target.checked)} className="accent-[var(--seed-color-fg-neutral)]" />
                매직링 넣기 <span className="text-fg-neutral-subtle">· 가운데에 들어가요</span>
              </label>
            )}
            <label className="flex items-center gap-x2 text-[12px] text-fg-neutral-muted">
              <span className="w-12 shrink-0">단 간격</span>
              <input type="range" min={0} max={30} step={1} value={roundGap} onChange={(e) => setRoundGap(Number(e.target.value))} aria-label="단 간격" className="min-w-0 flex-1 accent-[var(--seed-color-fg-neutral)]" />
            </label>
            <label className="flex items-center gap-x2 text-[12px] text-fg-neutral-muted">
              <span className="w-12 shrink-0">코 간격</span>
              <input type="range" min={0.7} max={1.8} step={0.05} value={spacing} onChange={(e) => setSpacing(Number(e.target.value))} aria-label="코 간격" className="min-w-0 flex-1 accent-[var(--seed-color-fg-neutral)]" />
            </label>
          </div>

          {res && (
            <div className="flex flex-col gap-x2" data-testid="import-preview">
              <span className="text-[12px] font-semibold text-fg-neutral-muted">미리보기</span>
              {preview.length > 0 && (
                <div className="flex justify-center rounded-r2 border border-stroke-neutral-muted bg-white py-x2">
                  <ChartPreview items={preview} width={220} height={200} />
                </div>
              )}
              <ul className="flex flex-col gap-1">
                {res.lines.map((l, i) => (
                  <li key={i} data-line-kind={l.kind} className={cx("rounded-r1_5 px-x2 py-x1 text-[12px]", l.kind === "skip" ? "bg-transparent text-fg-neutral-subtle" : "bg-bg-layer-fill text-fg-neutral")}>
                    <div className="flex items-baseline gap-x1_5">
                      <span className="shrink-0 tabular-nums text-fg-neutral-subtle">{l.line}</span>
                      {l.kind === "skip" ? (
                        <span className="min-w-0 truncate">건너뜀 · {l.text}</span>
                      ) : (
                        <span className="min-w-0 flex-1 font-semibold">
                          {l.label === "바닥" ? "바닥" : `${l.label}단`} · {l.produced ?? 0}코
                        </span>
                      )}
                    </div>
                    {l.kind !== "skip" &&
                      l.errors.map((e, j) => (
                        <p key={j} className="mt-0.5 text-fg-critical">
                          {e}
                        </p>
                      ))}
                    {l.warnings.map((w, j) => (
                      <p key={j} className="mt-0.5 text-[var(--seed-color-palette-yellow-700,#a16207)]">
                        {w}
                      </p>
                    ))}
                  </li>
                ))}
              </ul>
              <span className="text-[12px] text-fg-neutral" data-testid="import-total">
                {rounds.filter((r) => !r.foundation).length}단 · 모두 {total}코{errorCount ? ` · 확인할 줄 ${errorCount}개` : ""}
              </span>
            </div>
          )}
          <Button variant="primary" disabled={!rounds.length} onClick={() => res && onBuild(res, { layout, ring: ring && layout !== "linear", roundGap, spacing })}>
            도안 만들기
          </Button>
        </div>
      </div>
    </PanelFrame>
  );
}

// ---------- AI 어시스턴트 ----------

export type ChatMsg = { id: number; role: "user" | "assistant"; text: string };

export function AssistantPanel({ shell, empty, onSend, messages, onClear, selected }: { shell: Shell; empty: boolean; onSend: (text: string) => void; messages: ChatMsg[]; onClear: () => void; selected: number }) {
  const [draft, setDraft] = useState("");
  const listRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [messages.length]);
  const send = (t = draft) => {
    const v = t.trim();
    if (!v) return;
    onSend(v);
    setDraft("");
  };
  const examples = empty ? ["매직링 짧은뜨기 6코로 시작해 5단까지 6코씩 늘리기", "그래니 스퀘어 3단", "평면 12코 6단"] : ["한 단 더 늘림 없이", "마지막 단을 한길긴뜨기로 바꾸기", "전체 코 수 알려줘", "선택한 기호 빨간색으로"];
  return (
    <PanelFrame
      shell={shell}
      heading="AI 도안 어시스턴트"
      label="AI 어시스턴트"
      action={
        <button type="button" onClick={onClear} disabled={!messages.length} title="대화 지우기" aria-label="대화 지우기" className={cx(sab("ghost"), BTN, "size-7 shrink-0 px-0 disabled:opacity-40")} style={el(28, 28)}>
          <X className="size-4" />
        </button>
      }
    >
      <div ref={listRef} className="relative min-h-0 flex-1 overflow-y-auto overscroll-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" data-testid="assistant-panel">
        <div className="flex flex-col gap-x2 p-x3">
          <div className="flex items-center gap-x1_5">
            <Sparkle className="size-3.5 text-fg-brand" />
            <span className="rounded-full bg-bg-brand-weak px-x2 py-0.5 text-[11px] font-semibold text-fg-brand">규칙 기반 · 로컬</span>
          </div>
          <LocalNote>
            이 버전은 서버 없이 브라우저에서 규칙으로 동작해요. AI 모델이 답하지 않아요. {empty ? "빈 캔버스예요. 만들고 싶은 도안을 말로 적어 주세요." : "말로 단을 만들거나 고칠 수 있어요. 단 번호는 도안에 보이는 숫자 그대로 말해 주세요."}
          </LocalNote>
          {!messages.length && (
            <div className="flex flex-col gap-1">
              {examples.map((x) => (
                <button key={x} type="button" onClick={() => send(x)} className="rounded-r2 border border-stroke-neutral-muted px-x2 py-x1_5 text-left text-[12px] text-fg-neutral-muted hover:bg-bg-layer-default-pressed hover:text-fg-neutral">
                  {x}
                </button>
              ))}
              <details className="mt-x1 text-[12px] text-fg-neutral-muted">
                <summary className="cursor-pointer select-none">할 수 있는 말 모두 보기</summary>
                <ul className="mt-x1 flex flex-col gap-0.5 pl-x2">
                  {HELP.map((h) => (
                    <li key={h}>· {h}</li>
                  ))}
                </ul>
              </details>
            </div>
          )}
          {messages.map((m) => (
            <div
              key={m.id}
              data-role={m.role}
              className={cx(
                "max-w-[92%] rounded-r3 px-x2_5 py-x1_5 text-[13px] leading-relaxed whitespace-pre-line",
                m.role === "user" ? "self-end bg-bg-neutral-inverted text-fg-neutral-inverted" : "self-start bg-bg-layer-fill text-fg-neutral",
              )}
            >
              {m.text}
            </div>
          ))}
        </div>
      </div>
      {selected > 0 && (
        <p className="shrink-0 border-t border-stroke-neutral-muted bg-bg-brand-weak px-x3 py-x1_5 text-[12px] font-semibold text-fg-brand" data-testid="assistant-selection">
          선택한 기호 {selected}개만 편집해요 · 단 번호를 말하면 그 단을 고쳐요
        </p>
      )}
      <form
        className="flex shrink-0 items-center gap-x1_5 border-t border-stroke-neutral-muted p-x2"
        onSubmit={(e) => {
          e.preventDefault();
          send();
        }}
      >
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          aria-label="어시스턴트에게 보낼 말"
          placeholder={empty ? "예) 매직링 6코로 원형 시작" : "예) 마지막 단을 긴뜨기로"}
          className="h-8 min-w-0 flex-1 rounded-r2 border border-stroke-neutral-weak bg-bg-layer-default px-x2 text-[13px] outline-none placeholder:text-fg-placeholder focus:border-stroke-neutral-contrast"
        />
        <Button size="sm" variant="primary" type="submit" disabled={!draft.trim()}>
          보내기
        </Button>
      </form>
    </PanelFrame>
  );
}
