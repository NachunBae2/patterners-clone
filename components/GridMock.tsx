// Illustrated panels for the 배색·방안 tutorial steps (the reference uses drawings here, not clips).

const card = "rounded-[12px] border border-stroke-neutral-weak bg-bg-layer-default shadow-s2";

// 18×12 chart spelling "Aa"
const ROWS = [
  "..................",
  "....##............",
  "...#..#...........",
  "..#....#..........",
  "..#....#....###...",
  "..######.......#..",
  "..#....#....####..",
  "..#....#...#...#..",
  "..#....#...#...#..",
  "..#....#....###.#.",
  "..................",
  "..................",
];
const COLS = ROWS[0].length;
const NAVY = "#24365c";
const CREAM = "#efe7d6";

function Chart({ floats = false }: { floats?: boolean }) {
  const s = 10;
  return (
    <svg viewBox={`0 0 ${COLS * s} ${ROWS.length * s}`} className="block h-auto w-full">
      {ROWS.map((row, r) =>
        [...row].map((c, x) => (
          <rect key={`${r}-${x}`} x={x * s} y={r * s} width={s} height={s} fill={c === "#" ? NAVY : CREAM} stroke="#0000001f" strokeWidth={0.5} />
        )),
      )}
      {floats && (
        <g fill="none" stroke="#d9480f" strokeWidth={1.6}>
          <rect x={3 * s} y={5 * s} width={5 * s} height={s} rx={2} />
          <rect x={8 * s} y={7 * s} width={3 * s} height={s} rx={2} />
          <rect x={12 * s} y={8 * s} width={3 * s} height={s} rx={2} />
        </g>
      )}
    </svg>
  );
}

function Yarns() {
  const yarns: [string, number][] = [
    [CREAM, 162],
    [NAVY, 54],
  ];
  return (
    <div className={`${card} flex w-[30%] flex-col gap-x2 p-[3%]`}>
      {yarns.map(([c, n]) => (
        <div key={c} className="flex items-center gap-x2">
          <span className="size-5 shrink-0 rounded-full border border-black/10" style={{ background: c }} />
          <span className="h-[5px] flex-1 rounded-full bg-stroke-neutral-weak" />
          <span className="text-[0.75rem] text-fg-neutral-muted tabular-nums">{n}</span>
        </div>
      ))}
    </div>
  );
}

export function GridMock({ step, label }: { step: number; label: string }) {
  return (
    <div role="img" aria-label={label} className="lp-panel relative flex aspect-[4/3] items-center justify-center overflow-hidden p-[6%] gap-[4%]">
      {step === 0 && (
        <>
          <div className="flex w-[20%] shrink-0 flex-col gap-x2">
            <div className={`${card} flex aspect-square items-center justify-center text-[1.125rem] font-bold text-fg-neutral sm:text-[1.5rem]`}>Aa</div>
            <div className={`${card} flex aspect-square items-center justify-center text-fg-neutral`}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="size-5 sm:size-7" aria-hidden="true">
                <rect width="18" height="18" x="3" y="3" rx="2" />
                <circle cx="9" cy="9" r="2" />
                <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
              </svg>
            </div>
          </div>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="size-4 shrink-0 text-fg-neutral-muted sm:size-5" aria-hidden="true">
            <path d="M5 12h14" />
            <path d="m12 5 7 7-7 7" />
          </svg>
          <div className={`${card} w-[54%] p-[3%]`}>
            <Chart />
          </div>
        </>
      )}
      {step === 1 && (
        <>
          <div className={`${card} w-[46%] p-[3%]`}>
            <Chart />
          </div>
          <Yarns />
        </>
      )}
      {step === 2 && (
        <>
          <div className={`${card} w-[48%] p-[3%]`}>
            <Chart floats />
          </div>
          <div className={`${card} flex w-[30%] flex-col gap-x2 p-[3%]`}>
            {[0, 1, 2].map((i) => (
              <div key={i} className="flex items-center gap-x2">
                <span className="h-[10px] w-[10px] shrink-0 rounded-[3px] border-[1.5px] border-[#d9480f]" />
                <span className="h-[5px] flex-1 rounded-full bg-stroke-neutral-weak" />
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
