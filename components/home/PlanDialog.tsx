"use client";

import { Button, Dialog, cx } from "@/components/app/ui";
import { LocalNote, Tag } from "@/components/app/form";
import { Check } from "@/components/app/icons";

type Plan = { id: string; name: string; badge?: string; price: string; per?: string; billing: string; blurb: string; features: string[]; current?: boolean };

// Same tiers and prices as the landing page (Plan strings).
const PLANS: Plan[] = [
  {
    id: "free",
    name: "Free",
    price: "₩0",
    billing: "누구나 무료",
    blurb: "가볍게 시작하기 좋은 기본 플랜",
    features: ["도안 종류별 3개", "페이퍼 5개", "기본 기호 사용", "JPG 내보내기", "가입 시 1개월 Pro 체험"],
  },
  {
    id: "basic",
    name: "Basic",
    badge: "추천",
    price: "₩8,900",
    per: "/ 월",
    billing: "매월 결제 · 부가세 포함",
    blurb: "도안과 페이퍼를 제한 없이 만드는 플랜",
    features: ["Free의 모든 기능 포함", "무제한 도안", "무제한 페이퍼", "내보내기 (PNG / JPG)", "AI 크레딧 매달 300"],
  },
  {
    id: "pro",
    name: "Pro",
    price: "₩14,900",
    per: "/ 월",
    billing: "매월 결제 · 부가세 포함",
    blurb: "AI로 더 편하게 만들고, 새 기능을 먼저 쓰는 플랜",
    features: ["Basic의 모든 기능 포함", "레이어 무제한", "버전 관리", "내보내기 (PNG / PDF / JPG)", "AI 크레딧 매달 800", "신규 기능 최우선 사용"],
    current: true,
  },
  {
    id: "enterprise",
    name: "Enterprise",
    price: "맞춤 견적",
    billing: "별도 협의",
    blurb: "프로그램 사용, 팀·교육·브랜드 제휴 등 맞춤 이용이 필요하시면 문의해 주세요.",
    features: ["Pro의 모든 기능 포함", "전용 내부 서버 구축 가능", "AI 모델 고도화 가능", "팀·교육 기관 단위 이용", "브랜드 제휴"],
  },
];

/** 플랜 구매: shows tiers and prices only. This copy takes no payments and asks for no card. */
export function PlanDialog({ open, onClose, onContact }: { open: boolean; onClose: () => void; onContact: () => void }) {
  return (
    <Dialog open={open} onClose={onClose} title="나에게 맞는 플랜을 선택하세요" width={1000}>
      <LocalNote className="mb-x4">
        이 사본은 결제를 받지 않아요. 카드 정보도 묻지 않고, 구매 버튼은 꺼져 있어요. 지금 화면의 모든 기능은 플랜과 상관없이 그대로 쓸 수 있어요.
      </LocalNote>
      <ul className="grid gap-x3 sm:grid-cols-2 lg:grid-cols-4">
        {PLANS.map((p) => (
          <li
            key={p.id}
            className={cx("flex flex-col rounded-r4 border p-x4", p.current ? "border-stroke-brand-solid" : "border-stroke-neutral-muted")}
            aria-label={`${p.name} 플랜`}
          >
            <div className="flex items-center gap-x1_5">
              <h3 className="t5-bold text-fg-neutral">{p.name}</h3>
              {p.badge && <Tag tone="brand">{p.badge}</Tag>}
              {p.current && <Tag tone="brand">현재 플랜 · 체험 중</Tag>}
            </div>
            <p className="mt-x1 min-h-[2.75rem] t3-regular text-fg-neutral-muted">{p.blurb}</p>
            <p className="mt-x3 flex items-baseline gap-x1">
              <span className="t7-bold text-fg-neutral">{p.price}</span>
              {p.per && <span className="t3-regular text-fg-neutral-muted">{p.per}</span>}
            </p>
            <p className="t2-regular text-fg-neutral-subtle">{p.billing}</p>
            <ul className="mt-x4 flex flex-1 flex-col gap-x2">
              {p.features.map((f) => (
                <li key={f} className="flex items-start gap-x1_5 t3-regular text-fg-neutral">
                  <Check className="mt-0.5 size-4 shrink-0 text-fg-brand" />
                  {f}
                </li>
              ))}
            </ul>
            <div className="mt-x4">
              {p.id === "enterprise" ? (
                <Button className="w-full" onClick={onContact}>
                  문의하기
                </Button>
              ) : p.id === "free" || p.current ? (
                <Button className="w-full" onClick={onClose}>
                  작업으로 돌아가기
                </Button>
              ) : (
                <Button className="w-full" variant="primary" disabled title="이 사본에서는 결제할 수 없어요">
                  구독 결제 준비 중
                </Button>
              )}
            </div>
          </li>
        ))}
      </ul>
      <p className="mt-x3 t2-regular text-fg-neutral-subtle">* 이 사본에는 결제 기능이 없어요. 요금제는 비교용으로만 보여 드려요.</p>
    </Dialog>
  );
}
