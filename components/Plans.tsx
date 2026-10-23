"use client";

import { useState } from "react";
import { Check } from "./icons";

type Plan = {
  name: string;
  badge?: string;
  price: string;
  per?: string;
  vat?: string;
  billing: string;
  note?: string;
  features: string[];
  cta: { label: string; href: string; primary?: boolean };
};

const plans: Plan[] = [
  {
    name: "Free",
    price: "₩0",
    billing: "누구나 무료",
    features: [
      "코바늘·대바늘·배색·방안 각 3개, 페이퍼(문서+게시물 합산) 5개",
      "코바늘·대바늘·배색·방안 도안 모두 사용",
      "JPG로 내보내기 (워터마크 포함)",
      "아뜰리에에 무료로 공유",
    ],
    cta: { label: "무료로 시작하기", href: "/home" },
  },
  {
    name: "Basic",
    badge: "추천",
    price: "₩8,900",
    per: "/ 월",
    vat: "부가세 포함",
    billing: "매월 결제",
    features: ["Free의 모든 기능 포함", "도안·페이퍼 개수 제한 없음", "PNG·JPG·PDF로 내보내기", "AI 도안 변환 일부 사용"],
    cta: { label: "시작하기", href: "/home", primary: true },
  },
  {
    name: "Pro",
    price: "₩14,900",
    per: "/ 월",
    vat: "부가세 포함",
    billing: "매월 결제",
    note: "지금 가입하면 한 달 무료 체험",
    features: [
      "Basic의 모든 기능 포함",
      "AI 도안 변환·편집",
      "일러스트레이터(AI) 파일로 내보내기",
      "대바늘 도안 실체화",
      "뜨개옷 패턴 제도 (의류)",
      "신규 기능 최우선 사용",
    ],
    cta: { label: "Pro 시작하기", href: "/home" },
  },
  {
    name: "Enterprise",
    price: "맞춤 견적",
    billing: "별도 협의",
    features: ["Pro의 모든 기능 포함", "전용 내부 서버 구축 가능", "AI 모델 고도화 가능", "팀·교육 기관 단위 이용", "브랜드 제휴"],
    cta: { label: "문의하기", href: "/contact/sales" },
  },
];

export function Plans() {
  // Mobile shows one tier at a time; md+ shows all.
  const [shown, setShown] = useState(1);

  return (
    <section id="landing-plans" className="scroll-mt-20 sm:scroll-mt-24">
      <div className="lp-section">
        <div className="page-shell">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-[0.875rem] leading-[1.5] font-semibold text-fg-brand">요금</p>
            <h2 className="lp-h2 mt-x2">{"필요한 만큼\n플랜을 골라 쓰세요"}</h2>
            <p className="lp-lead mt-x4">지금 가입하고 Pro 기능을 한 달 무료로 체험해 보세요</p>
          </div>
        </div>
        <div className="page-shell-wide mt-x12 md:mt-x16">
          <div role="group" aria-label="이용요금" className="mb-x6 flex rounded-r2 bg-bg-layer-fill p-0.5 md:hidden">
            {plans.map((p, i) => (
              <button
                key={p.name}
                type="button"
                aria-pressed={i === shown}
                onClick={() => setShown(i)}
                className={`h-9 min-w-0 flex-1 truncate rounded-r1_5 px-x1 t3-bold ${
                  i === shown ? "bg-bg-layer-default text-fg-neutral shadow-s1" : "text-fg-neutral-muted"
                }`}
              >
                {p.name}
              </button>
            ))}
          </div>
          <ul className="lp-tiers-tabbed grid md:grid-cols-2 lg:grid-cols-4">
            {plans.map((p, i) => (
              <li
                key={p.name}
                data-shown={i === shown ? "" : undefined}
                className="lp-tier grid max-md:not-data-shown:hidden md:row-span-4 md:grid-rows-subgrid"
              >
                <div>
                  <div className="flex min-h-9 flex-wrap items-center gap-x-x2 gap-y-x1">
                    <h3 className="lp-tier-name">{p.name}</h3>
                    {p.badge && <span className="lp-plan-badge">{p.badge}</span>}
                  </div>
                  <p className="mt-x3 text-[1.125rem] leading-[1.4] font-semibold text-fg-neutral tabular-nums">
                    {p.price}
                    {p.per && <span className="ml-x1_5 font-normal text-fg-neutral-muted">{p.per}</span>}
                  </p>
                  <p className="lp-caption mt-x1 min-h-5 tabular-nums">{p.vat}</p>
                </div>
                <div className="mt-x5 flex min-h-[4.5rem] flex-col items-start justify-center gap-x1_5 border-y border-stroke-neutral-muted py-x4 text-[0.9375rem] leading-[1.4] text-fg-neutral-muted">
                  {p.billing}
                  {p.note && <span className="lp-plan-note">{p.note}</span>}
                </div>
                <ul className="mt-x7 flex flex-col gap-x4">
                  {p.features.map((f) => (
                    <li key={f} className="flex items-start gap-x3 text-[0.9375rem] leading-[1.5] text-fg-neutral">
                      <span className="mt-0.5 inline-flex size-[1.125rem] shrink-0 items-center justify-center rounded-full bg-bg-brand-solid text-fg-neutral-inverted">
                        <Check className="size-3" />
                      </span>
                      {f}
                    </li>
                  ))}
                </ul>
                <a
                  className={`lp-btn ${p.cta.primary ? "lp-btn-primary" : "lp-btn-secondary"} w-full rounded-full mt-x12 self-end`}
                  href={p.cta.href}
                >
                  {p.cta.label}
                </a>
              </li>
            ))}
          </ul>
        </div>
        <div className="page-shell mt-x8 flex justify-center md:mt-x10">
          <a className="lp-btn lp-btn-secondary" href="/plans">
            요금 자세히 보기
          </a>
        </div>
      </div>
    </section>
  );
}
