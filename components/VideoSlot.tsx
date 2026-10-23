/**
 * Stand-in for the original screen-recording videos.
 * Pass `src` (e.g. "/landing/intro.mp4" placed in public/) to play a real clip.
 * Without it a still "poster" is drawn in the same box:
 *  - "canvas": the editor's dotted canvas
 *  - "editor": a symbol palette on the left + dotted canvas (first frame of the tutorials)
 */
export function VideoSlot({
  src,
  poster,
  label,
  className,
  variant = "canvas",
}: {
  src?: string;
  poster?: string;
  label: string;
  className: string;
  variant?: "canvas" | "editor";
}) {
  if (src) {
    return <video className={className} src={src} poster={poster} autoPlay muted loop playsInline preload="none" aria-label={label} />;
  }
  return (
    <div role="img" aria-label={label} className={`${className} relative bg-bg-layer-default`}>
      {variant === "editor" && <PalettePoster />}
      <div className="relative min-w-0 flex-1 bg-[radial-gradient(var(--seed-color-stroke-neutral-weak)_1px,transparent_1.2px)] bg-[length:24px_24px]" />
    </div>
  );
}

// Grey "palette" column: section headers and rows of stitch glyphs, no text.
const glyphs = [
  <circle key="o" cx="12" cy="12" r="5" />,
  <path key="s" d="M12 6v12M9 6h6" />,
  <path key="t" d="M12 6v12M9 6h6M10 11l4-2" />,
  <ellipse key="c" cx="12" cy="12" rx="5" ry="3" />,
  <path key="x" d="m8 8 8 8M16 8l-8 8" />,
  <circle key="d" cx="12" cy="12" r="2" fill="currentColor" />,
];

function PalettePoster() {
  return (
    <div aria-hidden="true" className="flex w-[22%] shrink-0 flex-col gap-[3%] border-r border-stroke-neutral-muted px-[2.2%] py-[3%]">
      {[6, 6, 3, 6].map((n, s) => (
        <div key={s} className="flex flex-col gap-[6px]">
          <div className="flex items-center justify-between border-b border-stroke-neutral-muted pb-[4px]">
            <span className="h-[6px] w-[34%] rounded-full bg-fg-neutral/70" />
            <span className="h-[5px] w-[6%] rounded-full bg-stroke-neutral-weak" />
          </div>
          <div className="grid grid-cols-3 gap-[4px]">
            {Array.from({ length: n }, (_, i) => (
              <div key={i} className="flex flex-col items-center gap-[2px] py-[2px] text-fg-neutral">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" className="h-auto w-[60%] max-w-[18px]">
                  {glyphs[(i + s * 2) % glyphs.length]}
                </svg>
                <span className="h-[3px] w-[60%] rounded-full bg-stroke-neutral-weak" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
