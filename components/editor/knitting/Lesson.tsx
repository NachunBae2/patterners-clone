"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { cx } from "@/components/app/ui";
import { AB_TAIL, ab, seedSize } from "./ab";
import { ChevronRight } from "./icons";

/* layout-audit-ignore: tiny-text — lesson cards copy the reference's 11px progress chip and hint */

export type LessonId = "grid" | "gridEdit" | "glyph" | "modes" | "numbering";

/** what the editor reports to the running lesson */
export type LessonProgress = {
  gridsCreated: number;
  picked: boolean;
  placed: number;
  resized: number;
  carved: number;
  mode: string;
  painted: number;
  glyphOpened: boolean;
};

export type LessonStep = {
  /** data-tour target to spotlight */
  target: string;
  title: string;
  body: string;
  hint?: string;
  done?: (p: LessonProgress) => boolean;
};

export const LESSONS: { id: LessonId; title: string; steps: LessonStep[] }[] = [
  {
    id: "grid",
    title: "격자 만들고 기호 놓기",
    steps: [
      {
        target: "canvas",
        title: "격자를 만들어 주세요",
        body: "격자 도구로 캔버스를 드래그해 코수×단수 격자를 만드세요. 연습용이라 저장되지 않아요.",
        hint: "격자를 하나 만들면 다음으로 넘어갈 수 있어요.",
        done: (p) => p.gridsCreated > 0,
      },
      {
        target: "palette",
        title: "왼쪽에서 기호를 골라주세요",
        body: "왼쪽 팔레트에서 칸에 넣고 싶은 기호를 하나 누르세요.",
        hint: "기호를 하나 고르면 다음으로 넘어가요.",
        done: (p) => p.picked,
      },
      {
        target: "canvas",
        title: "칸에 기호를 넣어보세요",
        body: "방금 고른 기호로 격자 칸을 클릭해 하나 넣으세요.",
        hint: "칸에 기호를 하나 넣으면 완료할 수 있어요.",
        done: (p) => p.placed > 0,
      },
    ],
  },
  {
    id: "gridEdit",
    title: "격자 크기·모양 고치기",
    steps: [
      {
        target: "canvas",
        title: "가장자리를 끌어 보세요",
        body: "격자 편집 모드가 켜졌어요. 격자의 가장자리를 바깥으로 끌면 줄이나 열이 늘어나고, 안쪽으로 끌면 줄어들어요. 연습용이라 저장되지 않아요.",
        hint: "격자 크기를 한 번 바꾸면 다음으로 넘어갈 수 있어요.",
        done: (p) => p.resized > 0,
      },
      {
        target: "canvas",
        title: "칸을 더하거나 빼 보세요",
        body: "격자 옆 빈 곳을 끌면 그 자리에 칸이 추가돼요. Alt(Option)를 누른 채 칸을 끌면 그 칸이 빠져요. Shift를 누른 채 끌면 네모 영역이 한 번에 채워져요. 네모가 아닌 모양의 차트도 이렇게 만들어요.",
        hint: "칸을 하나 더하거나 빼면 다음으로 넘어갈 수 있어요.",
        done: (p) => p.carved > 0,
      },
      {
        target: "toolbar-grid-edit",
        title: "다 고쳤으면 모드를 꺼 주세요",
        body: "이 버튼을 다시 누르면(G) 격자 편집이 끝나고 선택 모드로 돌아가요. 버튼이 꺼져 있다면 선택 모드에서 격자를 먼저 골라 주세요.",
        done: (p) => p.mode !== "gridEdit",
      },
    ],
  },
  {
    id: "glyph",
    title: "나만의 기호 만들기",
    steps: [
      {
        target: "create-glyph",
        title: "기호 에디터를 열어주세요",
        body: "왼쪽 팔레트 위 연필 버튼이 기호 에디터예요. 눌러서 직접 그릴 화면을 여세요.",
        hint: "연필 버튼을 누르면 다음으로 넘어가요.",
        done: (p) => p.glyphOpened,
      },
      {
        target: "palette",
        title: "내 기호에 들어갔어요",
        body: "직접 그린 기호는 왼쪽 내 기호에 모여요. 여기서 골라 칸에 넣을 수 있어요.",
      },
    ],
  },
  {
    id: "modes",
    title: "도구별 색 읽기",
    steps: [
      {
        target: "canvas",
        title: "브러시로 칸을 칠해 주세요",
        body: "브러시는 기호가 아니라 칸 배경색을 칠해요. 격자가 있으면 칸을 드래그해 색을 입히세요.",
        hint: "칸 색을 하나 칠하면 다음으로 넘어갈 수 있어요.",
        done: (p) => p.painted > 0,
      },
      {
        target: "brush-palette",
        title: "지우개 · 스포이드 · 올가미",
        body: "지우개는 칸을 비우고, 스포이드는 칸 색을 집어오고, 올가미는 자유롭게 감싼 칸을 한 번에 골라요.",
      },
    ],
  },
  {
    id: "numbering",
    title: "차트 눈금",
    steps: [
      {
        target: "canvas",
        title: "코·단 번호 켜기",
        body: "격자 네 변마다 번호를 켜고 간격을 정할 수 있어요. 5칸마다처럼 띄우면 큰 도안도 읽기 쉬워져요.",
      },
      {
        target: "layer-panel",
        title: "번호 세부 설정",
        body: "오른쪽 패널에서 변별 간격과 격자와의 여백을 드래그로 조절해요.",
      },
    ],
  },
];

const CARD = "rounded-[calc(var(--seed-radius-r2)*1.8)] bg-background p-6 text-foreground shadow-[0_12px_40px_oklch(0_0_0/0.22)]";

/** "심화 레슨 보기" — shown once on the first open of a new knitting doc */
export function LessonPicker({ onPick, onLater }: { onPick: (id: LessonId) => void; onLater: () => void }) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === "Escape" && onLater();
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [onLater]);
  return (
    <div className="fixed inset-0 isolate z-250 overflow-hidden">
      <div className="pointer-events-none absolute inset-0 bg-black/55" />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="knit-lessons-title"
        className={cx(
          "pointer-events-auto absolute top-1/2 left-1/2 z-10 max-h-[calc(100dvh-2rem)] w-[min(22rem,calc(100vw-1.5rem))] -translate-x-1/2 -translate-y-1/2 overflow-y-auto",
          CARD,
        )}
      >
        <h2 id="knit-lessons-title" className="text-base leading-snug font-semibold tracking-tight">
          심화 레슨 보기
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">기본 안내가 끝났어요. 원하는 레슨을 골라 이어서 볼 수 있어요.</p>
        <ul className="mt-4 flex flex-col gap-0.5">
          {LESSONS.map((l) => (
            <li key={l.id}>
              <button
                type="button"
                onClick={() => onPick(l.id)}
                className="flex w-full cursor-pointer items-center gap-2 rounded-[calc(var(--seed-radius-r2)*1.4)] px-3 py-2.5 text-left text-sm font-medium hover:bg-muted"
              >
                <span className="size-5 shrink-0 rounded-full border border-border/80" />
                <span className="min-w-0 flex-1">{l.title}</span>
                <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
              </button>
            </li>
          ))}
        </ul>
        <div className="mt-5 flex items-center">
          <button className={cx(ab("ghost"), AB_TAIL, "text-muted-foreground")} type="button" style={seedSize(60.78, 32)} onClick={onLater}>
            나중에
          </button>
        </div>
      </div>
    </div>
  );
}

type Rect = { left: number; top: number; width: number; height: number };

/** spotlight + step card of a running lesson */
export function LessonTour({ lesson, step, progress, onStep, onExit }: { lesson: LessonId; step: number; progress: LessonProgress; onStep: (i: number) => void; onExit: () => void }) {
  const def = LESSONS.find((l) => l.id === lesson)!;
  const s = def.steps[step];
  const [rect, setRect] = useState<Rect | null>(null);
  const [pos, setPos] = useState<{ left: number; top: number; arrow: number; side: "left" | "right" } | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const measure = () => {
      const el = document.querySelector(`[data-tour="${s.target}"]`);
      if (!el) return setRect(null);
      const r = el.getBoundingClientRect();
      setRect({ left: r.left, top: r.top, width: r.width, height: r.height });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(document.body);
    window.addEventListener("resize", measure);
    const t = setInterval(measure, 500);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", measure);
      clearInterval(t);
    };
  }, [s.target]);

  useLayoutEffect(() => {
    const card = cardRef.current;
    if (!card || !rect) return;
    const w = card.offsetWidth;
    const h = card.offsetHeight;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const cy = rect.top + rect.height / 2;
    // left of the target when there is room, otherwise right of it
    let side: "left" | "right" = "left";
    let left = rect.left - w - 16;
    if (left < 12 && rect.left + rect.width + w + 16 <= vw - 12) {
      side = "right";
      left = rect.left + rect.width + 16;
    }
    left = Math.max(12, Math.min(vw - w - 12, left));
    // centred on the target, nudged down by the card's 12px inner offset like the reference
    const top = Math.max(12, Math.min(vh - h - 12, cy - (h - 12) / 2));
    setPos({ left, top, arrow: Math.max(12, Math.min(h - 24, cy - top - 6)), side });
  }, [rect, step]);

  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === "Escape" && onExit();
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [onExit]);

  const ok = !s.done || s.done(progress);
  const last = step === def.steps.length - 1;
  const pad = (r: Rect, d: number) => ({ top: r.top - d, left: r.left - d, width: r.width + d * 2, height: r.height + d * 2 });

  return (
    <div className="pointer-events-none fixed inset-0 isolate z-250 overflow-hidden">
      {rect && (
        <>
          <div
            className="knit-ring-primary-70 pointer-events-none absolute rounded-lg ring-2 transition-[top,left,width,height,box-shadow] duration-300 ease-out"
            style={{ ...pad(rect, 6), boxShadow: "oklch(0 0 0 / 0.18) 0px 0px 0px 9999px" }}
          />
          <div
            aria-hidden="true"
            className="knit-spotlight-pulse knit-ring-primary-50 pointer-events-none absolute rounded-[calc(var(--seed-radius-r2)*1.4)] ring-4 transition-[top,left,width,height] duration-300 ease-out"
            style={pad(rect, 10)}
          />
        </>
      )}
      <div
        ref={cardRef}
        role="dialog"
        aria-modal="false"
        aria-labelledby="knit-tour-title"
        data-spotlight-card=""
        className={cx("pointer-events-auto absolute z-10 w-[min(22rem,calc(100vw-1.5rem))]", CARD)}
        style={{ left: pos?.left ?? 12, top: pos?.top ?? 12, visibility: pos ? "visible" : "hidden", transition: "left 300ms ease-out, top 300ms ease-out" }}
      >
        {pos && <span aria-hidden="true" className="pointer-events-none absolute size-3 rotate-45 bg-background" style={pos.side === "left" ? { top: pos.arrow, right: -6 } : { top: pos.arrow, left: -6 }} />}
        <div className="mb-4 flex items-center justify-between gap-3">
          <span className="knit-bg-primary-15 inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium text-foreground tabular-nums">
            {step + 1} / {def.steps.length}
          </span>
          <button className={cx(ab("ghost"), AB_TAIL, "-mr-2 h-7 px-2 text-xs text-muted-foreground")} type="button" style={seedSize(56.25, 28)} onClick={onExit}>
            건너뛰기
          </button>
        </div>
        <h2 id="knit-tour-title" className="text-base leading-snug font-semibold tracking-tight">
          {s.title}
        </h2>
        <p className="mt-2 min-h-15 text-sm leading-relaxed text-muted-foreground">{s.body}</p>
        <div className="mt-6 flex min-h-8 items-center justify-end gap-2">
          {s.hint && !ok && <p className="knit-text-primary mr-auto line-clamp-2 text-[11px] leading-snug">{s.hint}</p>}
          <button className={cx(ab("ghost"), AB_TAIL)} type="button" disabled={step === 0} style={seedSize(49.86, 32)} onClick={() => onStep(step - 1)}>
            이전
          </button>
          <button className={cx(ab("brandSolid"), AB_TAIL, "rounded-full px-4")} type="button" disabled={!ok} style={seedSize(53.86, 32)} onClick={() => (last ? onExit() : onStep(step + 1))}>
            {last ? "완료" : "다음"}
          </button>
        </div>
      </div>
    </div>
  );
}
