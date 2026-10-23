import { VideoSlot } from "./VideoSlot";

const introLabel = "코바늘 원형 도안을 그리는 편집 화면 영상";

export function Intro() {
  return (
    <section className="scroll-mt-20 sm:scroll-mt-24">
      <div className="page-shell lp-section">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="lp-h2">간단하게 만들고, 바로 공유해요</h2>
          <p className="lp-lead mt-x4">설치 없이 브라우저에서 모두 가능해요.</p>
        </div>
        <div className="lp-panel mt-x10 p-x2 sm:p-x4 md:mt-x16">
          <div className="overflow-hidden rounded-[14px] border border-stroke-neutral-muted bg-bg-layer-default">
            <VideoSlot label={introLabel} className="hidden aspect-video w-full object-cover md:flex" />
            <VideoSlot label={introLabel} className="flex aspect-[9/16] w-full object-cover md:hidden" />
          </div>
        </div>
      </div>
    </section>
  );
}

export function BottomCta() {
  return (
    <section className="relative overflow-hidden">
      <div className="lp-floor absolute inset-x-[-30%] bottom-0 h-[70%]" aria-hidden="true" />
      <div className="page-shell lp-section relative flex flex-col items-center text-center">
        <h2 className="lp-h2">첫 도안을 그려 보세요</h2>
        <p className="lp-lead mt-x3 max-w-md">지금 가입하고 Pro 기능을 한 달 동안 무료로 체험해 보세요.</p>
        <div className="mt-x8 flex flex-wrap justify-center gap-x2">
          <a className="lp-btn lp-btn-primary" href="/signup">
            무료로 시작하기
          </a>
          <a href="#landing-features" className="lp-btn lp-btn-secondary bg-bg-layer-default">
            기능 둘러보기
          </a>
        </div>
      </div>
    </section>
  );
}
