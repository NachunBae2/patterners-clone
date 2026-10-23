/**
 * Stand-in for the original screen-recording videos.
 * Pass `src` (e.g. "/landing/intro.mp4" placed in public/) to play a real clip;
 * without it, an editor-canvas style placeholder with the clip caption is shown.
 */
export function VideoSlot({ src, poster, label, className }: { src?: string; poster?: string; label: string; className: string }) {
  if (src) {
    return <video className={className} src={src} poster={poster} autoPlay muted loop playsInline preload="none" aria-label={label} />;
  }
  return (
    <div
      role="img"
      aria-label={label}
      className={`${className} relative flex items-center justify-center bg-bg-layer-default bg-[radial-gradient(var(--seed-color-stroke-neutral-weak)_1px,transparent_1.2px)] bg-[length:24px_24px]`}
    >
      <span className="rounded-full border border-stroke-neutral-muted bg-bg-layer-default px-x3 py-x1_5 text-[0.8125rem] font-medium text-fg-neutral-muted">
        {label}
      </span>
    </div>
  );
}
