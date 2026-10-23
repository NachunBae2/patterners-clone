import { site } from "@/lib/site";
import { LangButton } from "./LangButton";
import { Wordmark } from "./Wordmark";

const link = "transition-colors duration-color-transition hover:text-fg-neutral";
const social = "inline-flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground";

const serviceLinks = [
  ["/features/crochet", "코바늘"],
  ["/features/knitting", "대바늘"],
  ["/features/grid", "배색·방안"],
  ["/features/apparel", "의류 (beta)"],
  ["/features/atelier", "아뜰리에 (beta)"],
  ["/blog", "블로그"],
  ["/updates", "패치노트"],
  ["/plans", "이용요금"],
];

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <p>
      <span className="text-fg-neutral-subtle">{label}</span> {children}
    </p>
  );
}

export function SiteFooter() {
  return (
    <footer className="landing mt-auto border-t border-stroke-neutral-muted bg-bg-layer-fill">
      <div className="page-shell py-x12 sm:py-x16">
        <div className="flex flex-col gap-x8 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex flex-wrap items-center gap-x4">
            <a className="flex items-center" aria-label="PATTERNERS" href="/">
              <Wordmark className="-ml-2 h-7" />
            </a>
            <nav aria-label="소셜 미디어" className="flex items-center gap-1.5">
              <a href={site.instagramUrl} target="_blank" rel="noopener noreferrer" aria-label="인스타그램" className={social}>
                <svg viewBox="0 0 24 24" fill="none" className="size-4" aria-hidden="true">
                  <rect x="3.5" y="3.5" width="17" height="17" rx="5" stroke="currentColor" strokeWidth="1.7" />
                  <circle cx="12" cy="12" r="3.6" stroke="currentColor" strokeWidth="1.7" />
                  <circle cx="17.2" cy="6.8" r="1" fill="currentColor" />
                </svg>
              </a>
              <a href={site.youtubeUrl} target="_blank" rel="noopener noreferrer" aria-label="유튜브" className={social}>
                <svg viewBox="0 0 24 24" fill="currentColor" className="size-4" aria-hidden="true">
                  <path d="M22.5 7.2a3.1 3.1 0 0 0-2.2-2.2C18.4 4.5 12 4.5 12 4.5s-6.4 0-8.3.5A3.1 3.1 0 0 0 1.5 7.2 32 32 0 0 0 1 12a32 32 0 0 0 .5 4.8 3.1 3.1 0 0 0 2.2 2.2c1.9.5 8.3.5 8.3.5s6.4 0 8.3-.5a3.1 3.1 0 0 0 2.2-2.2A32 32 0 0 0 23 12a32 32 0 0 0-.5-4.8ZM10 15.2V8.8L15.5 12 10 15.2Z" />
                </svg>
              </a>
            </nav>
            <LangButton className="inline-flex" />
          </div>
          <nav className="t4-regular flex flex-wrap gap-x-x6 gap-y-x2 text-fg-neutral-muted">
            {serviceLinks.map(([href, label]) => (
              <a key={href} className={link} href={href}>
                {label}
              </a>
            ))}
          </nav>
        </div>

        <nav className="flex flex-wrap gap-x-x4 gap-y-x1_5 t4-regular mt-x10 text-fg-neutral-muted">
          <a className={link} href="/terms">이용약관</a>
          <a className={link} href="/terms/atelier">아뜰리에 이용약관</a>
          <a className={`${link} font-bold text-fg-neutral`} href="/privacy">개인정보 처리방침</a>
          <a className={link} href="/refund">취소·환불 규정</a>
          <a className={link} href="/contact">고객문의</a>
        </nav>

        <div className="grid gap-x6 sm:grid-cols-2 t3-regular mt-x6 text-fg-neutral-muted">
          <div className="flex flex-col gap-x1">
            <p className="t4-bold text-fg-neutral">사업자 정보</p>
            <Row label="상호">{site.companyName}</Row>
            <Row label="대표자">{site.representative}</Row>
            <Row label="주소">{site.address}</Row>
            <Row label="사업자등록번호">
              {site.businessNumber}{" "}
              <a href={site.businessCheckUrl} target="_blank" rel="noopener noreferrer" className={`${link} underline underline-offset-2`}>
                사업자정보 확인
              </a>
            </Row>
            <Row label="통신판매업 신고번호">{site.mailOrderNumber}</Row>
            <Row label="호스팅서비스 제공자">{site.hosting}</Row>
          </div>
          <div className="flex flex-col gap-x1">
            <p className="t4-bold text-fg-neutral">고객문의</p>
            <Row label="이메일">
              <a href={`mailto:${site.email}`} className={link}>{site.email}</a>
            </Row>
            <Row label="전화">
              <a href={`tel:${site.phone}`} className={link}>{site.phone}</a>
            </Row>
            <Row label="1:1 문의">
              <a className={`${link} underline underline-offset-2`} href="/contact">문의 남기기</a>
            </Row>
            <p>이메일·1:1 문의로 접수된 순서대로 답변드려요.</p>
            <Row label="개인정보보호책임자">{site.privacyOfficer}</Row>
          </div>
        </div>
        <p className="t3-regular mt-x6 max-w-3xl text-fg-neutral-muted">
          {site.companyName}는 아뜰리에에서 통신판매중개자로서 통신판매의 당사자가 아니며, 작가가 등록한 도안 정보와 거래에 대한 책임은 각 작가에게 있습니다. 다만{" "}
          {site.companyName}의 고의 또는 과실로 인한 손해는 관련 법령에 따라 책임집니다.
        </p>
        <p className="t2-regular mt-x8 text-fg-neutral-muted">
          © {site.year} {site.companyNameEn}
        </p>
      </div>
    </footer>
  );
}
