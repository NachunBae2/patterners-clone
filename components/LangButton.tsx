import { ChevronDown, Globe } from "./icons";

export function LangButton({ className = "" }: { className?: string }) {
  return (
    <button
      type="button"
      aria-label="언어"
      aria-haspopup="menu"
      className={`h-9 shrink-0 items-center gap-1 rounded-r2 px-2 text-xs font-medium tracking-wide text-fg-neutral-muted outline-none transition-colors hover:text-fg-neutral focus-visible:ring-2 focus-visible:ring-stroke-neutral-contrast ${className}`}
    >
      <Globe className="size-4" />
      <span>KOR</span>
      <ChevronDown className="size-3.5" />
    </button>
  );
}
