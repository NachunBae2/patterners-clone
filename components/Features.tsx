"use client";

import { useId, useState, type KeyboardEvent, type ReactNode } from "react";
import { GridMock } from "./GridMock";
import { VideoSlot } from "./VideoSlot";

/** video: screen recording (4:3, apparel 16:10); grid: illustrated panel instead of a clip */
type Step = { label: string; clip: string; kind?: "video" | "video-wide" | "grid"; src?: string; poster?: string };
type Tab = { id: string; label: string; icon: ReactNode; steps: Step[] };

const icon = (children: ReactNode, active: boolean) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.75"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={`size-5 md:size-6 ${active ? "text-fg-brand" : ""}`}
    aria-hidden="true"
  >
    {children}
  </svg>
);

// Clip files are not bundled; drop them into public/landing/... and set `src` to play them.
const tabs: Tab[] = [
  {
    id: "crochet",
    label: "코바늘",
    icon: (
      <>
        <path d="M6.8 20.6c-1.1.3-2-.7-1.5-1.7L14.2 5.8c.5-1 1.9-1.4 2.9-.7.8.5 1 1.6.4 2.3-.6.8-1.8.9-2.5.2l-.9-.8" />
        <path d="M9.2 16.2h2.4" />
      </>
    ),
    steps: [
      { label: "기호 넣기", clip: "팔레트에서 기호를 골라 캔버스에 놓아요." },
      { label: "기호 합치기", clip: "기호 여러 개를 모아 늘려뜨기·줄여뜨기로 합쳐요." },
      { label: "원형 만들기", clip: "기호를 원형으로 둘러 한 단을 만들어요." },
    ],
  },
  {
    id: "knitting",
    label: "대바늘",
    icon: (
      <>
        <path d="M5.2 18.8 16.6 6.6" />
        <circle cx="18" cy="5.1" r="1.55" />
        <path d="M18.8 18.8 7.4 6.6" />
        <circle cx="6" cy="5.1" r="1.55" />
      </>
    ),
    steps: [
      { label: "칸 채우기", clip: "기호를 고르고 칸을 칠하듯 채워요." },
      { label: "반복하기", clip: "고른 영역을 반복해 차트 전체로 넓혀요." },
      { label: "뜬 모습 보기", clip: "그린 차트가 실제로 뜬 편물로 보여요." },
    ],
  },
  {
    id: "grid",
    label: "배색·방안",
    icon: (
      <>
        <rect x="4" y="4" width="16" height="16" rx="1.5" />
        <path d="M4 9.3h16M4 14.7h16M9.3 4v16M14.7 4v16" />
      </>
    ),
    steps: [
      { label: "글자로 만들기", clip: "글자나 이미지를 넣으면 칸 도안으로 바뀌어요.", kind: "grid" },
      { label: "색 칠하기", clip: "실 색마다 몇 코가 드는지 세어 줘요.", kind: "grid" },
      { label: "걸침 검사", clip: "걸침이 긴 곳과 1코짜리 색 구간을 찾아 줘요.", kind: "grid" },
    ],
  },
  {
    id: "paper",
    label: "페이퍼",
    icon: (
      <>
        <path d="M7 3.5h7.2L18.5 8v12.5H7z" />
        <path d="M14.2 3.5V8H18.5" />
        <path d="M10 12h6M10 15.5h4.5" />
      </>
    ),
    steps: [
      { label: "차트 넣기", clip: "내 도안에서 차트를 골라 페이퍼에 넣는 화면" },
      { label: "블록으로 쓰기", clip: "블록을 골라 제목·글·목록·표를 쓰는 화면" },
      { label: "번역", clip: "페이퍼를 모든 언어로 번역하고 언어를 바꿔 보는 화면" },
      { label: "공유·PDF", clip: "공유 링크를 켜서 복사하고 PDF로 내보내는 화면" },
    ],
  },
  {
    id: "apparel",
    label: "의류 (beta)",
    icon: <path d="M8 4.5 12 6.2 16 4.5l3.2 3.4-3.2 1.3V20H8V9.2L4.8 7.9 8 4.5Z" />,
    steps: [
      { label: "치수 넣기", clip: "형태와 치수를 고르자 앞판·뒤판·소매가 그려지는 화면", kind: "video-wide" },
      { label: "핏 조절", clip: "핏과 여유량을 조절하는 화면", kind: "video-wide" },
      { label: "게이지", clip: "게이지를 넣어 코수·단수를 보는 화면", kind: "video-wide" },
      { label: "도안 올리기", clip: "도안 레이어를 앞판 위에 올리는 화면", kind: "video-wide" },
    ],
  },
];

export function Features() {
  const id = useId();
  const [active, setActive] = useState(0);
  const [steps, setSteps] = useState<number[]>(() => tabs.map(() => 0));

  const onTabKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const delta = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
    if (!delta) return;
    e.preventDefault();
    const next = (active + delta + tabs.length) % tabs.length;
    setActive(next);
    document.getElementById(`${id}-tab-${next}`)?.focus();
  };

  return (
    <section id="landing-features" className="scroll-mt-20 sm:scroll-mt-24">
      <div className="page-shell lp-section">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="lp-h2">{"기호를 놓거나 글로 적어\n도안을 완성하세요"}</h2>
          <p className="lp-lead mt-x4">코바늘, 대바늘, 배색·방안까지 한 계정에서 만들어요.</p>
        </div>
        <div className="mt-x10 md:mt-x16">
          <div
            role="tablist"
            aria-label="기능"
            className="grid gap-x1 md:gap-x3"
            style={{ gridTemplateColumns: `repeat(${tabs.length}, minmax(0, 1fr))` }}
            onKeyDown={onTabKey}
          >
            {tabs.map((t, i) => {
              const on = i === active;
              return (
                <button
                  key={t.id}
                  id={`${id}-tab-${i}`}
                  type="button"
                  role="tab"
                  aria-selected={on}
                  aria-controls={`${id}-panel-${i}`}
                  tabIndex={on ? 0 : -1}
                  onClick={() => setActive(i)}
                  className={`flex min-w-0 cursor-pointer flex-col items-center gap-x1 rounded-[12px] border px-x1 py-x2 text-center text-[0.75rem] leading-tight font-medium break-keep transition-colors md:gap-x2 md:rounded-[16px] md:px-x3 md:py-x5 md:text-[0.875rem] ${
                    on ? "border-stroke-neutral-muted bg-bg-layer-fill text-fg-neutral" : "border-transparent text-fg-neutral-muted hover:text-fg-neutral"
                  }`}
                >
                  {icon(t.icon, on)}
                  {t.label}
                </button>
              );
            })}
          </div>

          {tabs.map((t, i) => {
            const cur = steps[i];
            const step = t.steps[cur];
            return (
              <div
                key={t.id}
                id={`${id}-panel-${i}`}
                role="tabpanel"
                aria-labelledby={`${id}-tab-${i}`}
                hidden={i !== active}
                className="lp-panel mt-x4 flex flex-col overflow-hidden lg:mt-x6"
              >
                <div className="no-scrollbar flex gap-x0_5 overflow-x-auto border-b border-stroke-neutral-muted px-x2 py-x3 sm:gap-x1 sm:px-x4">
                  {t.steps.map((s, j) => {
                    const on = j === cur;
                    return (
                      <button
                        key={s.label}
                        type="button"
                        aria-pressed={on}
                        onClick={() => setSteps((prev) => prev.map((v, k) => (k === i ? j : v)))}
                        className={`inline-flex h-9 shrink-0 cursor-pointer items-center gap-x1_5 rounded-full px-x3 text-[0.8125rem] font-semibold transition-colors sm:h-10 sm:gap-x2 sm:px-x4 sm:text-[0.875rem] ${
                          on ? "bg-bg-neutral-inverted text-fg-neutral-inverted" : "text-fg-neutral-muted hover:bg-bg-layer-fill hover:text-fg-neutral"
                        }`}
                      >
                        <span
                          aria-hidden="true"
                          className={`flex size-5 items-center justify-center rounded-full text-[0.75rem] ${on ? "bg-bg-layer-default/20" : "bg-bg-layer-fill"}`}
                        >
                          {j + 1}
                        </span>
                        {s.label}
                      </button>
                    );
                  })}
                </div>
                <div className="p-x3 md:p-x6">
                  <div className="mx-auto max-w-[960px]">
                    {step.kind === "grid" ? (
                      <GridMock step={cur} label={step.clip} />
                    ) : (
                      <div className="overflow-hidden rounded-[12px] border border-stroke-neutral-muted bg-bg-layer-default">
                        <VideoSlot
                          key={step.label}
                          src={step.src}
                          poster={step.poster}
                          label={step.clip}
                          variant={t.id === "crochet" || t.id === "knitting" ? "editor" : "canvas"}
                          className={`${step.kind === "video-wide" ? "aspect-[16/10]" : "aspect-[4/3]"} flex w-full object-cover`}
                        />
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
