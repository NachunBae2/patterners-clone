/**
 * Text wordmark standing in for the original logo image.
 * To use a real logo, replace the <svg> with an <img src="/brand/logo-wordmark.png" />
 * that fills the same 888:240 box.
 */
export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={`relative inline-block w-auto ${className ?? ""}`} style={{ aspectRatio: "888 / 240" }}>
      <svg viewBox="0 0 888 240" className="absolute inset-0 h-full w-full" aria-hidden="true">
        <text
          x="6"
          y="178"
          textLength="876"
          lengthAdjust="spacingAndGlyphs"
          fontSize="196"
          fontWeight="800"
          fontStyle="italic"
          fontFamily='"Pretendard Variable", Pretendard, sans-serif'
          fill="currentColor"
          letterSpacing="-6"
        >
          PATTERNERS
        </text>
      </svg>
    </span>
  );
}
