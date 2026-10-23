import type { ReactNode } from "react";
import { ArtCableChart, ArtDoily, ArtFilet, ArtMotif, ArtSnowflakeChart } from "./art";

type Item = { title: string; kind: string; visual: ReactNode };

const swatch = (name: string) => (
  <img alt="" loading="lazy" width={580} height={520} className="h-full w-full object-contain p-x4" src={`/landing/swatch-${name}.svg`} />
);
const art = (pad: string, node: ReactNode) => <div className={`h-full w-full ${pad}`}>{node}</div>;

const bar = "h-1 rounded-[2px] bg-stroke-neutral-weak";
const paper = (
  <div className="flex h-full w-full items-end justify-center pt-x5">
    <div aria-hidden="true" className="flex h-full w-[58%] flex-col gap-2 rounded-t-[6px] border border-b-0 border-stroke-neutral-weak bg-bg-layer-default px-4 pt-4">
      <div className="h-1.5 w-1/2 rounded-[2px] bg-fg-neutral" />
      <div className={`${bar} w-4/5`} />
      <div className={`${bar} w-3/5`} />
      <div className="mx-auto mt-1 aspect-square w-3/5">
        <ArtMotif />
      </div>
      <div className="mt-1 grid grid-cols-[1fr_3fr] gap-x-2 gap-y-1.5">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className={bar} />
        ))}
      </div>
    </div>
  </div>
);

const rows: Item[][] = [
  [
    { title: "케이블 무늬 편물", kind: "대바늘", visual: swatch("cable") },
    { title: "눈꽃 배색 차트", kind: "배색·방안", visual: art("p-x5", <ArtSnowflakeChart />) },
    { title: "원형 모티브", kind: "코바늘", visual: art("p-x2", <ArtMotif />) },
    { title: "눈꽃 배색 편물", kind: "배색·방안", visual: swatch("star") },
    { title: "모티브 페이퍼", kind: "페이퍼", visual: paper },
    { title: "2코 고무뜨기", kind: "대바늘", visual: swatch("rib") },
  ],
  [
    { title: "방안뜨기 무늬", kind: "배색·방안", visual: art("p-x5", <ArtFilet />) },
    { title: "체크 배색 편물", kind: "배색·방안", visual: swatch("checks") },
    { title: "케이블 차트", kind: "대바늘", visual: art("p-x5", <ArtCableChart />) },
    { title: "도일리", kind: "코바늘", visual: art("p-x1", <ArtDoily />) },
    { title: "페어아일 밴드", kind: "배색·방안", visual: swatch("bands") },
    { title: "멍석뜨기", kind: "대바늘", visual: swatch("seed") },
  ],
];

export function Gallery() {
  return (
    <section className="lp-section overflow-hidden">
      <div className="page-shell">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="lp-h2">{"코바늘부터 대바늘까지\n모든 도안을 만들 수 있어요"}</h2>
          <p className="lp-lead mt-x4">패터너스로 만든 다양한 예시를 확인하세요.</p>
        </div>
      </div>
      <div className="mt-x10 md:mt-x16">
        <div className="flex flex-col gap-x8">
          {rows.map((items, r) => (
            <div key={r} className="lp-marquee">
              {/* Items render twice so the track can loop by translating -50%. */}
              <ul className="lp-marquee-track" data-reverse={r === 1 ? "true" : undefined}>
                {[0, 1].flatMap((copy) =>
                  items.map((it) => (
                    <li key={`${copy}-${it.title}`} className="w-[220px] shrink-0 pr-x4 sm:w-[276px] sm:pr-x6" aria-hidden={copy === 1}>
                      <div className="lp-panel aspect-[4/3] overflow-hidden">{it.visual}</div>
                      <p className="mt-x3 text-[0.9375rem] leading-[1.4] font-semibold text-fg-neutral">{it.title}</p>
                      <p className="lp-caption">{it.kind}</p>
                    </li>
                  )),
                )}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
