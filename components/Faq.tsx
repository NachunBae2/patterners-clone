"use client";

import { useId, useState } from "react";
import { ChevronDown, ChevronUp } from "./icons";

const faqs = [
  { q: "코바늘과 대바늘을 한 계정에서 쓰나요?", a: "네. 도안마다 종류가 나뉘고, 홈에서 코바늘·대바늘·페이퍼 탭으로 모아 봐요." },
  {
    q: "의류 도안은 무엇을 만들 수 있나요?",
    a: "치수·핏·게이지를 넣으면 앞판·뒤판·소매 패턴이 코수·단수까지 그려지고, 코바늘·대바늘 도안을 그 위에 올려 볼 수 있어요. Pro 플랜에서 쓸 수 있어요.",
  },
  {
    q: "휴대폰에서도 쓸 수 있나요?",
    a: "휴대폰에서는 글로 코바늘·대바늘 도안을 만들고 AI로 변환할 수 있어요. 기호를 캔버스에 놓고 고치는 작업과 페이퍼 편집은 태블릿과 컴퓨터에서 할 수 있어요.",
  },
  { q: "가입하면 바로 쓸 수 있나요?", a: "이메일 인증 후 프로필을 정하면 바로 시작할 수 있어요. 가입한 날부터 1개월 동안 Pro를 무료로 체험해요." },
];

export function Faq() {
  const id = useId();
  const [open, setOpen] = useState<number | null>(null);

  return (
    <section>
      <div className="page-shell lp-section">
        <h2 className="lp-h2 text-center">자주 묻는 질문</h2>
        <div className="flex w-full flex-col mx-auto mt-x8 max-w-3xl gap-x2 md:mt-x12">
          {faqs.map((f, i) => {
            const isOpen = open === i;
            const state = isOpen ? "open" : "closed";
            return (
              <div key={f.q} data-state={state} className="not-last:border-stroke-neutral-muted lp-panel rounded-[16px] px-x5 not-last:border-b">
                <h3 className="flex">
                  <button
                    type="button"
                    id={`${id}-q-${i}`}
                    aria-expanded={isOpen}
                    aria-controls={`${id}-a-${i}`}
                    onClick={() => setOpen(isOpen ? null : i)}
                    className="relative flex flex-1 cursor-pointer justify-between leading-t5 text-fg-neutral transition-all outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--lp-focus) items-center gap-x3 rounded-none py-x4 text-left text-[1rem] leading-[1.5] font-semibold"
                  >
                    <span className="pr-x2">{f.q}</span>
                    {isOpen ? (
                      <ChevronUp className="pointer-events-none ml-auto size-5 shrink-0 text-fg-neutral-muted" />
                    ) : (
                      <ChevronDown className="pointer-events-none ml-auto size-5 shrink-0 text-fg-neutral-muted" />
                    )}
                  </button>
                </h3>
                <div
                  id={`${id}-a-${i}`}
                  role="region"
                  aria-labelledby={`${id}-q-${i}`}
                  data-state={state}
                  inert={!isOpen}
                  className="lp-accordion-panel text-sm"
                >
                  <div>
                    <div className="lp-body pb-x4">
                      <p>{f.a}</p>
                    </div>
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
